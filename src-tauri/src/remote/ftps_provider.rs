// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! FTPS（显式 / 隐式）远程目录的读取。
//!
//! # 与 `connection_test.rs` 的 `AcceptAnyCertificate` 的差别：只有一处，但那是全部
//!
//! 「测试连接」无条件放行证书是**刻意的**：用户在测的是刚填进去的地址，
//! 此刻手上没有可对照的指纹，强校验只会一律失败。
//! 本文件的 [`PinnedCertificate`] 走 [`known_hosts::decide`]：
//! 只有指纹与已信任记录**一致**时才放行；首次见到就让握手失败，
//! 对不上同样失败，但报的是 `HostKeyChanged`。
//!
//! **握手失败后必须先看观测槽再报错误** —— 与 `sftp_provider.rs` 完全同构。
//! 反过来的话，「这张证书还没被信任过」会被报成「TLS 握手失败」，
//! 用户去查网络，而网络明明是好的。
//!
//! # 协议层不复制
//!
//! 控制通道整个复用 [`ftp_provider::FtpControl`] 与
//! [`ftp_provider::list_via_control`]，只在外面套一层 TLS。
//! 复制一份的后果是：明文 FTP 修好了一个 bug，FTPS 里还留着同一个 ——
//! 而这两个 bug 用户会分别遇到，且只有其中一半被测到。
//!
//! # 显式与隐式的差别
//!
//! - **隐式**（RFC 4217 §4.2，默认端口 990）：连上第一件事就是 TLS 握手，
//!   **明文阶段**一条命令也没有。
//! - **显式**（§4.1，默认端口 21）：先明文登录，`AUTH TLS` 得到 234 之后升级，
//!   **然后必须重新 `USER`/`PASS`** —— 服务器把升级当作新会话的开始。
//!
//! ⚠️ 隐式**不等于**「没有欢迎语」。TLS 层**里面**仍然有 `220`：
//! §4.2 说的是「握手之后的会话与普通 FTP 相同」，而 FTP 会话以 `220` 开始。
//! 两种模式都要 `read_greeting()`；按「隐式没有欢迎语」跳过它，
//! 客户端就会对着一条永远不来的 `220` 一直等到超时。
//!
//! 「升级后要重新登录」忘了不会有编译错误，只会有一个真机上
//! 「登录成功了但列目录全 530」的现象，而且没有任何报错指向真正的原因。
//!
//! # 已知边界：数据通道没有加密
//!
//! RFC 2228 的 `PBSZ` / `PROT P` 才能让数据通道也走 TLS。
//! **本实现不发那两条命令**，即采用服务器的默认值。
//! 对显式 FTPS，主流服务器的默认是**明文数据通道**；
//! 也就是说控制通道受证书固定保护，而文件内容的传输不额外加密。
//!
//! 这是**已知的取舍，不是疏漏**：发 `PROT P` 的前提是服务器支持，
//! 而「服务器不支持时怎么办」有两个答案 —— 报错（很多连不上）或
//! 明文降级（静默不安全）。本轮选了报错之外的那条路：
//! 不发，交给默认值，并在这一段里写清楚。补 `PROT` 时要做的是
//! 「先 `PBSZ 0` 再 `PROT P`，失败就**明确报错**」，绝不静默退回明文。

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;

use super::error::{HostKeyIdentity, RemoteError};
use super::ftp_provider::{list_via_control, FtpControl};
use super::known_hosts::{self, HostKeyDecision, KnownHostEntry, TrustKind};
use super::path::{build_remote_path, normalize_remote_path};
use super::provider::{RemoteEntry, RemoteProvider};
use super::registry::{self, ResolvedConnection};
use super::sftp_provider::is_hidden_remote_name;
use super::transport::{self, Socks5CommandKind, TransportStream};

/// 与明文 FTP 共用同一个上限。**故意不为 FTPS 单开一个**：
/// 两者的用户体感应当一致，「FTP 慢一点是正常的」这种偏袒不该写进超时里。
pub const FTPS_OPERATION_TIMEOUT: Duration = super::ftp_provider::FTP_OPERATION_TIMEOUT;

/// 一次握手里观测到的证书与判定结果。
#[derive(Debug, Clone)]
struct CertificateObservation {
    fingerprint: String,
    key_type: String,
    decision: HostKeyDecision,
}

impl CertificateObservation {
    /// 指纹与类型**成对**交给错误构造器：单给一串 `SHA256:AB:CD` 的话，
    /// 弹窗里用户无从判断那是什么。
    fn identity(&self) -> HostKeyIdentity {
        HostKeyIdentity::new(&self.fingerprint, &self.key_type)
    }
}

/// 握手里的结论。握手失败之后由调用方把它翻译成可操作的两条错误。
///
/// 与 `sftp_provider::host_key_rejection` 同名同形状 —— 两处**必须**一致：
/// 不一致的话「首见」与「变更」在 SFTP 和 FTPS 上会表现成不同的文案，
/// 而信任弹窗是同一个组件，用户会以为有两个不同的错误类型。
fn certificate_rejection(
    observed: &Arc<Mutex<Option<CertificateObservation>>>,
    host: &str,
) -> Option<RemoteError> {
    let slot = observed.lock().ok().and_then(|guard| guard.clone())?;

    // **先取身份再匹配**：`slot.decision` 按值匹配，取完之后 slot 被部分移动，
    // 再去读它的指纹会编译不过。
    let identity = slot.identity();

    match slot.decision {
        HostKeyDecision::Trusted => None,
        HostKeyDecision::Unknown => Some(RemoteError::host_key_unknown(host, identity)),
        HostKeyDecision::Changed { expected } => {
            Some(RemoteError::host_key_changed(host, identity, expected))
        }
    }
}

/// 只认「与已信任记录**完全一致**的那一张证书」的校验器。
///
/// # 为什么签名验证是直接放行的
///
/// `AcceptAnyCertificate` 也是这么做的，而这里**不是**同一个漏洞：
/// 固定的是叶证书的 SHA-256，而握手过程本身仍由协商出的密钥保护。
/// 中间人拿不到那张证书的私钥，就完不成握手 —— 所以固定住「这张证书」
/// 之后，证书链能不能验证、主机名对不对，都已经不重要了。
///
/// 反过来说，如果这里**严格**验证主机名，自签名证书会被直接拒掉，
/// 而用户恰恰要用的就是自签名证书（内网设备默认如此）。
/// 换来的安全增益是零：主机名校验能发现的东西，固定已经全挡住了。
///
/// # 算不出指纹 = 拒绝
///
/// 而不是放行。放行等于「指纹算不出来时信任一切」，
/// 那正是这个文件存在的意义要避免的事。
#[derive(Debug)]
pub struct PinnedCertificate {
    known_hosts: Arc<Vec<KnownHostEntry>>,
    host: String,
    port: u16,
    observed: Arc<Mutex<Option<CertificateObservation>>>,
}

impl rustls::client::danger::ServerCertVerifier for PinnedCertificate {
    fn verify_server_cert(
        &self,
        end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        let Ok((fingerprint, key_type)) = known_hosts::describe_certificate(end_entity) else {
            return Err(rustls::Error::General("无法计算证书指纹".to_string()));
        };

        let decision = known_hosts::decide(
            &self.known_hosts,
            &self.host,
            self.port,
            TrustKind::X509,
            &fingerprint,
        );

        if let Ok(mut slot) = self.observed.lock() {
            *slot = Some(CertificateObservation {
                fingerprint,
                key_type,
                decision: decision.clone(),
            });
        }

        match decision {
            HostKeyDecision::Trusted => {
                Ok(rustls::client::danger::ServerCertVerified::assertion())
            }
            // 拒绝时**不**带具体原因：带上的话 rustls 会把它原样抛给上层，
            // 而我们要让上层用自己的措辞说「没被信任过 / 变了」。
            HostKeyDecision::Unknown => {
                Err(rustls::Error::General("certificate is not trusted".into()))
            }
            HostKeyDecision::Changed { .. } => {
                Err(rustls::Error::General("certificate has changed".into()))
            }
        }
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}

/// 建 TLS 连接所需的全部上下文。
#[derive(Debug)]
struct TlsContext {
    host: String,
    port: u16,
    known_hosts: Arc<Vec<KnownHostEntry>>,
    observed: Arc<Mutex<Option<CertificateObservation>>>,
}

impl TlsContext {
    fn new(host: &str, port: u16, known_hosts: Arc<Vec<KnownHostEntry>>) -> Self {
        Self {
            host: host.to_string(),
            port,
            known_hosts,
            observed: Arc::new(Mutex::new(None)),
        }
    }
}

/// 把一条字节流包成 TLS。**不是** `connection_test::upgrade_tls` ——
/// 那个无条件放行证书，用在这里等于把这三页的功夫全作废。
async fn connect_pinned<S>(stream: S, context: &TlsContext) -> Result<TlsStream<S>, RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send + 'static,
{
    // `ClientConfig::builder()` 需要一个 process-level `CryptoProvider`。
    //
    // 本仓库里**两个 provider 同时可用**（`Cargo.lock` 里 rustls 同时依赖
    // `aws-lc-rs` 与 `ring`），而 rustls 的 `from_crate_features()` 三个分支全是
    // 互斥条件 —— 这种情况下它返回 `None`，`builder()` 随即 `expect` 失败。
    // 也就是说：**只要没人先装过 provider，这里就是 panic 而不是错误。**
    //
    // 全项目唯一的 `install_default()` 在 `lan_share/tls.rs` 的一个运行时函数里，
    // 于是「没用过 LAN 分享就点 FTPS」这条路上会崩。
    //
    // 显式装 `ring`：与 [`PinnedCertificate::supported_verify_schemes`] 用的是
    // 同一个 provider，意图一致。重复安装返回 `Err`，`let _` 忽略即可。
    let _ = rustls::crypto::ring::default_provider().install_default();

    let verifier = Arc::new(PinnedCertificate {
        known_hosts: Arc::clone(&context.known_hosts),
        host: context.host.clone(),
        port: context.port,
        observed: Arc::clone(&context.observed),
    });

    let config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(verifier)
        .with_no_client_auth();

    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let server_name = rustls::pki_types::ServerName::try_from(context.host.clone())
        .map_err(|error| RemoteError::protocol(format!("主机名无法用于 TLS：{error}")))?;

    connector.connect(server_name, stream).await.map_err(|error| {
        // 握手失败后**先看是不是我们自己拒绝的**。反过来就会把
        // 「这张证书还没被信任过」报成「TLS 握手失败」，用户去查网络。
        if let Some(rejection) = certificate_rejection(&context.observed, &context.host) {
            return rejection;
        }

        RemoteError::protocol(format!("TLS 握手失败：{error}"))
    })
}

/// TLS 流。显式 FTPS 里流会被**换掉一次**（明文 → TLS），
/// 所以中间那一段用一个自己的类型统一起来。
type TlsStream<S> = tokio_rustls::client::TlsStream<S>;

/// 显式与隐式的差异只有这一个枚举值。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum FtpsMode {
    /// 明文登录 → `AUTH TLS` → 升级 → **重新登录**。
    Explicit,
    /// 连上就是 TLS，没有明文阶段。
    Implicit,
}

/// FTPS 的远程目录 provider。
///
/// 与另两个 provider 一样**每次调用都重新建连**：
/// 方案 C 的已知代价，换来「关掉远程界面一定断开」今天就成立。
pub struct FtpsRemoteProvider {
    user_data_dir: PathBuf,
    app_data_dir: PathBuf,
    known_hosts: Arc<Vec<KnownHostEntry>>,
    timeout: Duration,
}

impl FtpsRemoteProvider {
    pub fn new(user_data_dir: &Path, app_data_dir: &Path) -> Self {
        Self {
            user_data_dir: user_data_dir.to_path_buf(),
            app_data_dir: app_data_dir.to_path_buf(),
            // 已知主机在构造时读一次：TLS 校验回调里做文件 I/O 是把 IO 混进
            // 协议状态机，而且它运行在 rustls 的内部线程里，出错没法往上传。
            //
            // 读失败退回「什么都没信任」：那会让下一次连接走到「首次见到，
            // 请确认指纹」，而不是带着一份不可信的记录继续连。
            known_hosts: Arc::new(known_hosts::load(app_data_dir).unwrap_or_default()),
            timeout: FTPS_OPERATION_TIMEOUT,
        }
    }

    /// 开好一条**已经登录过**的 FTPS 控制通道。
    async fn open(
        &self,
        resolved: &ResolvedConnection,
        mode: FtpsMode,
    ) -> Result<FtpControl<SendStream>, RemoteError> {
        let connection = &resolved.connection;
        let host = connection.host.clone();
        let port = connection.port;

        let plain =
            transport::connect(&connection.proxy, &host, port, Socks5CommandKind::Connect).await?;

        let context = TlsContext::new(&host, port, Arc::clone(&self.known_hosts));
        let username = connection.username.clone();
        let password = resolved.password.clone();

        let work = async {
            match mode {
                FtpsMode::Implicit => {
                    // 隐式：**明文阶段**连 220 都没有 —— 连上第一件事就是握手。
                    // 但 TLS 层**里面**仍然读得到欢迎语：RFC 4217 §4.2 规定
                    // 握手之后的会话与普通 FTP 相同，而 FTP 会话以 220 开始。
                    //
                    // 这一点值得写清楚，因为「隐式没有欢迎语」是个很容易被记住、
                    // 又很容易被用错的说法 —— 按它跳过 `read_greeting` 的话，
                    // 客户端会对着一条永远不来的 220 一直等。
                    let tls = connect_pinned(plain, &context).await?;
                    let mut control = FtpControl::new(tls, &host, &connection.proxy);
                    control.read_greeting().await?;
                    control.login(&username, password.as_deref()).await?;
                    Ok(control)
                }
                FtpsMode::Explicit => {
                    let mut control = FtpControl::new(plain, &host, &connection.proxy);
                    control.read_greeting().await?;
                    control.login(&username, password.as_deref()).await?;

                    // 234 = 「可以升级」。502/504 表示服务器不支持，
                    // 那时**必须明确报错**，不能退回明文继续 —— 退回明文就是
                    // 「用户以为连的是 FTPS，实际是裸 FTP」。
                    control.command("AUTH TLS", &[234]).await?;

                    // ⚠️ 升级之后**必须重新登录**（RFC 4217 §4.2）。
                    // 服务器把 TLS 握手当作新会话的开始，不重登的话
                    // 后面每条命令都会得到 530，而用户看到的却只是「530」。
                    let tls = connect_pinned(control.into_stream(), &context).await?;
                    let mut secure = FtpControl::new(tls, &host, &connection.proxy);
                    secure.login(&username, password.as_deref()).await?;
                    Ok(secure)
                }
            }
        };

        match tokio::time::timeout(self.timeout, work).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "建立 FTPS 连接超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    fn mode_of(resolved: &ResolvedConnection) -> FtpsMode {
        match resolved.connection.protocol {
            super::connection::RemoteProtocol::FtpsImplicit => FtpsMode::Implicit,
            _ => FtpsMode::Explicit,
        }
    }

    /// 列出 `normalized` 下的直接子项。
    pub async fn list(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        let connection_id = resolved.connection.id.clone();
        let parent = normalized.trim_end_matches('/').to_string();
        let mode = Self::mode_of(resolved);

        let mut control = self.open(resolved, mode).await?;
        let records = list_via_control(&mut control, normalized).await?;
        let _ = control.command("QUIT", &[221, 226]).await;

        let mut entries = Vec::with_capacity(records.len());

        for record in records {
            let name = record.name;
            let child = format!("{parent}/{name}");
            // **先算再移**：结构体字面量里 `name` 字段拿走所有权之后
            // 就不能再借用了，所以隐藏判定必须在构造之前完成。
            let is_hidden = is_hidden_remote_name(&name);
            let path = build_remote_path(&connection_id, &child).ok_or_else(|| {
                RemoteError::unknown(format!("拼不出合法的远端路径：{connection_id}{child}"))
            })?;

            entries.push(RemoteEntry {
                path,
                name,
                is_hidden,
                is_dir: record.is_dir,
                is_symlink: record.is_symlink,
                size: record.size,
                modified_time: record.modified_time,
            });
        }

        Ok(entries)
    }

    /// 单个条目的元数据。
    ///
    /// 与明文 FTP 同策略：**列父目录再按名字找**。`MLST` 的回复是多行的，
    /// 而 `read_reply` 一次只读一行（那条理由写在 `ftp_provider.rs` 里，
    /// 这里是**同一个决定**，不是各做各的）。
    pub async fn stat(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<RemoteEntry, RemoteError> {
        let name = normalized
            .rsplit('/')
            .next()
            .filter(|segment| !segment.is_empty())
            .ok_or_else(|| {
                RemoteError::protocol(format!("远端路径不是一个条目：{normalized}"))
            })?
            .to_string();

        let parent = match normalized.rfind('/') {
            Some(0) | None => "/".to_string(),
            Some(index) => normalized[..index].to_string(),
        };

        let siblings = self.list(resolved, &parent).await?;

        // 比 `name` 字段而不是比路径后缀 —— 后缀匹配会把 `a.txt`
        // 误认成 `xa.txt` 的子串，于是「点开 a.txt」拿到的是另一个文件的属性。
        siblings
            .into_iter()
            .find(|entry| entry.name == name)
            .ok_or_else(|| RemoteError::not_found(format!("远端没有这个条目：{normalized}")))
    }

    /// 下载一个远程文件。
    pub async fn read_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let mut control = self.session(resolved, normalized).await?;
        let bytes = super::ftp_provider::retrieve_via_control(&mut control, normalized).await?;
        let _ = control.command("QUIT", &[221, 226]).await;

        Ok(bytes)
    }

    /// 上传一个远程文件（覆盖语义）。
    pub async fn write_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let mut control = self.session(resolved, normalized).await?;
        let outcome =
            super::ftp_provider::store_via_control(&mut control, normalized, &content).await;
        let _ = control.command("QUIT", &[221, 226]).await;

        outcome
    }

    /// 建一个远程目录（已存在视为成功）。
    pub async fn make_dir(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<(), RemoteError> {
        let mut control = self.session(resolved, normalized).await?;
        let outcome = super::ftp_provider::make_dir_via_control(&mut control, normalized).await;
        let _ = control.command("QUIT", &[221, 226]).await;

        outcome
    }

    /// 入参处理 + 建好一条已登录的控制通道。
    ///
    /// 与明文 FTP 的差别只有「通道是在 [`Self::open`] 里开好的」这一点，
    /// 协议部分（`RETR` / `STOR` / `MKD` 的时序）与 `ftp_provider` **逐字共用**。
    async fn session(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<FtpControl<SendStream>, RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        self.open(resolved, Self::mode_of(resolved)).await
    }
}

/// 两条 FTPS 流（明文升级来的、TLS 直连的）在控制层看到的是同一个类型。
///
/// **不是** `enum`：两种流都要 `FtpControl` 的全部方法，而 `FtpControl<S>`
/// 只要求 `S: AsyncRead + AsyncWrite`。`tls_stream(S)` 是一个**自由类型别名**，
/// 让签名里能写出来 —— `enum` 的话每个方法都要手写一遍委托。
pub type SendStream = tokio_rustls::client::TlsStream<TransportStream>;

#[async_trait]
impl RemoteProvider for FtpsRemoteProvider {
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        let normalized = normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved =
            registry::resolve_connection(&self.user_data_dir, &self.app_data_dir, connection_id)?;

        self.list(&resolved, &normalized).await
    }

    async fn read_file(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let normalized = normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved =
            registry::resolve_connection(&self.user_data_dir, &self.app_data_dir, connection_id)?;

        self.read_file(&resolved, &normalized).await
    }

    async fn write_file(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let normalized = normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved =
            registry::resolve_connection(&self.user_data_dir, &self.app_data_dir, connection_id)?;

        self.write_file(&resolved, &normalized, content).await
    }

    async fn make_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<(), RemoteError> {
        let normalized = normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved =
            registry::resolve_connection(&self.user_data_dir, &self.app_data_dir, connection_id)?;

        self.make_dir(&resolved, &normalized).await
    }

    /// FTPS 同样没有 `SITE CHMOD`，也没有可靠的权限位。
    /// **在解析连接之前就拒绝**，理由与明文 FTP 完全相同。
    async fn set_permissions(
        &self,
        _connection_id: &str,
        _remote_path: &str,
        _mode: u32,
    ) -> Result<(), RemoteError> {
        Err(super::transfer::unsupported_set_permissions("FTPS"))
    }

    async fn get_permissions(
        &self,
        _connection_id: &str,
        _remote_path: &str,
    ) -> Result<Option<u32>, RemoteError> {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::error::RemoteErrorKind;
    use crate::remote::known_hosts::KnownHostEntry;

    fn entry(host: &str, port: u16, fingerprint: &str, kind: TrustKind) -> KnownHostEntry {
        KnownHostEntry {
            host: host.to_string(),
            port,
            fingerprint: fingerprint.to_string(),
            key_type: "X509".to_string(),
            added_at: 0,
            kind,
        }
    }

    fn observed(
        decision: HostKeyDecision,
    ) -> Arc<Mutex<Option<CertificateObservation>>> {
        Arc::new(Mutex::new(Some(CertificateObservation {
            fingerprint: "SHA256:AA:BB".to_string(),
            key_type: "X509".to_string(),
            decision,
        })))
    }

    #[test]
    fn an_untrusted_certificate_becomes_host_key_unknown() {
        // 这是整个文件存在的理由：握手失败**必须**被翻译成
        // 「这张证书还没被信任过」，而不是「TLS 握手失败」。
        // 后者会把用户送去查网络，而网络是好的。
        let slot = observed(HostKeyDecision::Unknown);
        let error = certificate_rejection(&slot, "nas.example.com").expect("must reject");

        assert_eq!(error.kind, RemoteErrorKind::HostKeyUnknown);
        assert_eq!(error.fingerprint.as_deref(), Some("SHA256:AA:BB"));
    }

    #[test]
    fn a_changed_certificate_reports_the_previously_trusted_one() {
        // 变了这一条必须带出**当初信任的那一份**，用户才能并排比对。
        // 只给新指纹的话，用户无从判断该重新信任还是该报警。
        let slot = observed(HostKeyDecision::Changed {
            expected: "SHA256:OLD".to_string(),
        });
        let error = certificate_rejection(&slot, "nas.example.com").expect("must reject");

        assert_eq!(error.kind, RemoteErrorKind::HostKeyChanged);
        assert_eq!(error.expected_fingerprint.as_deref(), Some("SHA256:OLD"));
    }

    #[test]
    fn a_trusted_certificate_produces_no_rejection() {
        // 阳性对照：前两条才有意义。观测槽里是 Trusted 时**不能**报错 ——
        // 否则每一次正常连接都会被自己的守卫挡下来。
        let slot = observed(HostKeyDecision::Trusted);

        assert!(certificate_rejection(&slot, "nas.example.com").is_none());
    }

    #[test]
    fn an_empty_observation_produces_no_rejection() {
        // 观测槽为空 = 我们**没有**拒绝过。TLs 层自己的失败（协议版本不匹配等）
        // 要按它自己的错误报，不能被这里伪装成「证书未信任」。
        let slot: Arc<Mutex<Option<CertificateObservation>>> = Arc::new(Mutex::new(None));

        assert!(certificate_rejection(&slot, "nas.example.com").is_none());
    }

    #[test]
    fn an_ssh_record_never_authorises_a_certificate() {
        // 与 known_hosts 的那条用例配对：从**校验器这一侧**再看一遍。
        // 只在 decide 里挡是不够的 —— 万一有人在校验器里绕过 decide
        // 直接比指纹，这一条会转红。
        let entries = vec![entry("nas", 990, "SHA256:SSHKEY", TrustKind::Ssh)];

        let decision = known_hosts::decide(
            &entries,
            "nas",
            990,
            TrustKind::X509,
            "SHA256:SSHKEY",
        );

        assert_eq!(decision, HostKeyDecision::Unknown);
    }

    #[test]
    fn the_default_port_comes_from_the_protocol_not_from_here() {
        // 隐式 990、显式 21。端口由 `RemoteProtocol::default_port` 决定，
        // 这里不重复 —— 重复一份就会有两个地方能改同一个默认值。
        assert_eq!(
            super::super::connection::RemoteProtocol::FtpsImplicit
                .default_port(),
            990
        );
        assert_eq!(
            super::super::connection::RemoteProtocol::FtpsExplicit
                .default_port(),
            21
        );
    }

    // -- 校验器本体 -----------------------------------------------------
    //
    // 直接调 `verify_server_cert` 而不是起一个真 TLS 服务器：
    // 固定判定只需要「证书的 DER 字节」这一项输入，
    // 而起服务器要生成证书、要握手，测到的其实是 rustls 而不是我们。

    fn verifier(
        entries: Vec<KnownHostEntry>,
        observed: Arc<Mutex<Option<CertificateObservation>>>,
    ) -> PinnedCertificate {
        PinnedCertificate {
            known_hosts: Arc::new(entries),
            host: "nas".to_string(),
            port: 990,
            observed,
        }
    }

    /// 一段确定内容的「证书」。内容随便 —— 固定判定只看它的摘要。
    fn fake_cert() -> rustls::pki_types::CertificateDer<'static> {
        rustls::pki_types::CertificateDer::from(vec![0x30, 0x82, 0x01, 0x02, 0xff, 0xee])
    }

    fn fingerprint_of(der: &[u8]) -> String {
        known_hosts::format_openssl_fingerprint(
            &<sha2::Sha256 as sha2::Digest>::digest(der),
        )
    }

    fn server_name() -> rustls::pki_types::ServerName<'static> {
        rustls::pki_types::ServerName::try_from("nas").expect("static name")
    }

    #[test]
    fn a_matching_pinned_certificate_is_accepted() {
        let der = fake_cert();
        let trusted = entry("nas", 990, &fingerprint_of(der.as_ref()), TrustKind::X509);
        let observed: Arc<Mutex<Option<CertificateObservation>>> = Arc::new(Mutex::new(None));
        let verifier = verifier(vec![trusted], Arc::clone(&observed));

        let result = rustls::client::danger::ServerCertVerifier::verify_server_cert(
            &verifier,
            &der,
            &[],
            &server_name(),
            &[],
            rustls::pki_types::UnixTime::now(),
        );

        assert!(result.is_ok(), "a matching pin must be accepted");
        // 观测槽也必须记下 Trusted —— `certificate_rejection` 靠它区分
        // 「我们自己放行的」与「rustls 自己失败的」。
        assert!(matches!(
            observed.lock().expect("lock").as_ref().map(|o| &o.decision),
            Some(HostKeyDecision::Trusted)
        ));
    }

    #[test]
    fn a_certificate_we_have_never_seen_is_refused() {
        // **这一条是这个文件存在的全部理由。** 换成 `AcceptAnyCertificate` 的话，
        // 任何一张证书都会通过，而用户看到的连接仍然是「成功」的。
        let der = fake_cert();
        let observed: Arc<Mutex<Option<CertificateObservation>>> = Arc::new(Mutex::new(None));
        let verifier = verifier(Vec::new(), Arc::clone(&observed));

        let result = rustls::client::danger::ServerCertVerifier::verify_server_cert(
            &verifier,
            &der,
            &[],
            &server_name(),
            &[],
            rustls::pki_types::UnixTime::now(),
        );

        assert!(result.is_err(), "an unknown certificate must be refused");
        // 且必须能翻译成 host_key_unknown，而不是笼统的握手失败。
        let error = certificate_rejection(&observed, "nas").expect("must be a rejection");
        assert_eq!(error.kind, RemoteErrorKind::HostKeyUnknown);
        assert_eq!(error.fingerprint.as_deref(), Some(fingerprint_of(der.as_ref()).as_str()));
    }

    #[test]
    fn a_certificate_that_does_not_match_the_pin_is_refused_with_the_old_one_attached() {
        let der = fake_cert();
        let observed: Arc<Mutex<Option<CertificateObservation>>> = Arc::new(Mutex::new(None));
        let verifier = verifier(
            vec![entry("nas", 990, "SHA256:AA:BB:CC", TrustKind::X509)],
            Arc::clone(&observed),
        );

        let result = rustls::client::danger::ServerCertVerifier::verify_server_cert(
            &verifier,
            &der,
            &[],
            &server_name(),
            &[],
            rustls::pki_types::UnixTime::now(),
        );

        assert!(result.is_err());

        let error = certificate_rejection(&observed, "nas").expect("must be a rejection");
        assert_eq!(error.kind, RemoteErrorKind::HostKeyChanged);
        // 「当初信任的那一份」必须带出去，用户才能并排比对。
        assert_eq!(error.expected_fingerprint.as_deref(), Some("SHA256:AA:BB:CC"));
    }

    #[test]
    fn an_ssh_pin_never_accepts_a_certificate() {
        // 从**校验器这一侧**再验一次。已知主机里只有一条 SSH 记录时，
        // 任何一张证书都必须被拒。
        let der = fake_cert();
        let observed: Arc<Mutex<Option<CertificateObservation>>> = Arc::new(Mutex::new(None));
        let verifier = verifier(
            vec![entry("nas", 990, &fingerprint_of(der.as_ref()), TrustKind::Ssh)],
            Arc::clone(&observed),
        );

        let result = rustls::client::danger::ServerCertVerifier::verify_server_cert(
            &verifier,
            &der,
            &[],
            &server_name(),
            &[],
            rustls::pki_types::UnixTime::now(),
        );

        assert!(result.is_err(), "an SSH pin must not authorise a certificate");
        assert_eq!(
            certificate_rejection(&observed, "nas")
                .expect("must be a rejection")
                .kind,
            RemoteErrorKind::HostKeyUnknown
        );
    }

    // -----------------------------------------------------------------
    // 假 FTPS 服务端
    //
    // 上面那些测试量的是**零件**：校验器接受什么、`certificate_rejection`
    // 怎么翻译。零件都对、拼起来照样可能是错的 —— 而且这里有三个地方
    // 只有真握手才碰得到：
    //
    //   1. `AUTH TLS` 拿不到 `234` 时到底报不报错；
    //   2. 升级之后**必须重新 `USER`/`PASS`**（RFC 4217 §4.2），
    //      忘了不会编译报错，真机上是「登录成功了但列目录全 530」；
    //   3. 握手失败有没有被翻译成「这张证书还没被信任过」，
    //      而不是笼统的「TLS 握手失败」。
    //
    // 这三条此前**一条测试都碰不到**：`no-relogin-after-auth-tls` /
    // `ignore-auth-tls-failure` / `report-tls-error-before-rejection`
    // 三条注入验证全绿，就是这个原因。
    // -----------------------------------------------------------------

    /// 假服务端记下客户端依次发了什么命令（含明文阶段与 TLS 阶段）。
    #[derive(Clone, Default)]
    struct StubLog(Arc<Mutex<Vec<String>>>);

    impl StubLog {
        fn commands(&self) -> Vec<String> {
            self.0.lock().expect("log lock").clone()
        }
    }

    /// 假服务端的配置。
    struct StubOptions {
        mode: FtpsMode,
        /// `AUTH TLS` 的回复。回 `500` 模拟「这台服务器不支持 FTPS」。
        auth_tls_reply: &'static str,
        listing: &'static str,
        /// **升级之后是否必须重新登录**（RFC 4217 §4.2 的真实行为）。
        ///
        /// 打开时，TLS 层里没收到过 `USER`/`PASS` 就发别的命令 → 回 `530`。
        /// 这条开关是 `no-relogin-after-auth-tls` 那条注入唯一的着力点：
        /// 没有它，客户端漏掉重登，桩照样把列表送上来，红不了。
        require_relogin: bool,
    }

    impl StubOptions {
        fn explicit(listing: &'static str) -> Self {
            Self {
                mode: FtpsMode::Explicit,
                auth_tls_reply: "234 AUTH TLS ok",
                listing,
                require_relogin: true,
            }
        }

        fn implicit(listing: &'static str) -> Self {
            Self {
                mode: FtpsMode::Implicit,
                auth_tls_reply: "234 AUTH TLS ok",
                listing,
                require_relogin: false,
            }
        }
    }

    /// 一张自签证书 + 它对应的服务端配置。
    struct StubCertificate {
        der: rustls::pki_types::CertificateDer<'static>,
        config: Arc<rustls::ServerConfig>,
    }

    fn stub_certificate() -> StubCertificate {
        let key_pair = rcgen::KeyPair::generate().expect("generate key pair");
        let certificate = rcgen::CertificateParams::new(vec!["127.0.0.1".to_string()])
            .expect("cert params")
            .self_signed(&key_pair)
            .expect("self signed");

        let der = certificate.der().clone();
        // rcgen 的 `serialize_der` 给的是 PKCS#8，所以**必须**包成
        // `PrivatePkcs8KeyDer` 再进 `PrivateKeyDer`。
        // 私钥的具体编码不是这里能糊弄过去的细节 ——
        // 包错的话 `with_single_cert` 直接失败，而错误信息只会说「key is invalid」。
        let key = rustls::pki_types::PrivateKeyDer::Pkcs8(
            rustls::pki_types::PrivatePkcs8KeyDer::from(key_pair.serialize_der()),
        );

        // `builder_with_provider` 而不是 `builder()` —— **刻意不碰进程级默认 provider**。
        //
        // 夹具一旦调了 `install_default()`，下面那四条端到端测试就永远绿：
        // 客户端的 `ClientConfig::builder()` 会顺手捡到夹具装好的那个 provider，
        // 于是「生产代码自己装 provider」这件事根本不需要成立，测试照样通过。
        // 那正是本轮真实踩过的坑 —— 夹具兜底会把生产路径上的同一个洞盖掉。
        let config = rustls::ServerConfig::builder_with_provider(Arc::new(
            rustls::crypto::ring::default_provider(),
        ))
        .with_safe_default_protocol_versions()
        .expect("protocol versions")
        .with_no_client_auth()
        .with_single_cert(vec![der.clone()], key)
        .expect("server config");

        StubCertificate {
            der,
            config: Arc::new(config),
        }
    }

    /// 同步（阻塞）读一行。rustls 的 reader 在数据没到齐时返回 `WouldBlock`，
    /// 所以这里是一个「读到 WouldBlock 就往 socket 里再灌一次」的循环。
    /// 同步（阻塞）读一行。rustls 的 reader 在数据没到齐时返回 `WouldBlock`，
    /// 所以这里是一个「读到 WouldBlock 就往 socket 里再灌一次」的循环。
    ///
    /// **`line` 必须跨 `WouldBlock` 保留。**
    ///
    /// `read_line` 遇到不完整的一行时返回 `Err`，但它**已经从 rustls 的 Reader
    /// 里读走的那些字节不会回来** —— `Reader` 的位置在 `read` 返回 `Ok(n)` 那一刻
    /// 就前进了。而 `read_line` 把已读的部分 append 进了传入的 String。
    ///
    /// 所以每次循环新建一个 String，等于把半条命令扔掉：下一次从「剩下那截」
    /// 接着读，读出来就是一个孤零零的 `\r\n`。命令于是永远匹配不上 `USER`/`PASS`，
    /// 桩只能回 `500`/`530` —— 症状像协议错了，根因却在这个夹具里。
    fn read_secure_line(
        connection: &mut rustls::ServerConnection,
        socket: &mut std::net::TcpStream,
    ) -> Option<String> {
        use std::io::BufRead;

        let mut line = String::new();

        loop {
            match connection.reader().read_line(&mut line) {
                Ok(0) => return None,
                Ok(_) => return Some(line),
                Err(_) => {
                    // 同 [`server_handshake`]：**只**调 `read_tls`，
                    // 不要先 `socket.read()` —— 那会把字节吃掉。
                    match connection.read_tls(socket) {
                        Ok(0) | Err(_) => return None,
                        Ok(_) => {}
                    }
                    connection.process_new_packets().ok()?;
                }
            }
        }
    }

    fn write_secure_line(
        connection: &mut rustls::ServerConnection,
        socket: &mut std::net::TcpStream,
        text: &str,
    ) {
        use std::io::Write;

        let mut writer = connection.writer();
        let _ = writer.write_all(text.as_bytes());
        let _ = writer.flush();
        let _ = connection.write_tls(socket);
    }

    /// 明文阶段读一行。**刻意不用 `BufReader`** ——
    /// 它的预读会把字节吞进内部缓冲，于是 `AUTH TLS` 之后
    /// `server_handshake` 直接读原始 socket 时，明文阶段的那些字节已经不在那儿了。
    /// 两边就此错位：客户端等一条永远不会来的回复，桩等一条永远认不出的明文命令。
    /// 那种「整整 30 秒超时」和「无法识别的 FTP 回复」都是它的产物，
    /// 而不是被测代码的问题。
    fn read_plain_line(
        socket: &mut std::net::TcpStream,
        buffer: &mut Vec<u8>,
    ) -> Option<String> {
        use std::io::Read;

        loop {
            if let Some(position) = buffer.iter().position(|byte| *byte == b'\n') {
                let line = String::from_utf8_lossy(&buffer[..=position])
                    .trim_end()
                    .to_string();
                buffer.drain(..=position);

                return Some(line);
            }

            let mut chunk = [0u8; 4096];

            match socket.read(&mut chunk) {
                Ok(0) | Err(_) => return None,
                Ok(read) => buffer.extend_from_slice(&chunk[..read]),
            }
        }
    }

    /// 在**已经连上**的那条 socket 上完成服务端握手。
    ///
    /// `pending` 是明文阶段缓冲里剩下的字节 —— **必须先喂给 rustls**。
    /// 客户端收到 `234` 之后立刻发 ClientHello；如果明文读取时多读了几字节，
    /// 那几字节就只存在于桩的缓冲里，不喂进去的话握手永远等不到那一段。
    fn server_handshake(
        socket: &mut std::net::TcpStream,
        config: &Arc<rustls::ServerConfig>,
        pending: &[u8],
    ) -> Option<rustls::ServerConnection> {
        use std::io::Read;

        let mut connection = rustls::ServerConnection::new(Arc::clone(config)).ok()?;

        if !pending.is_empty() {
            let mut cursor = std::io::Cursor::new(pending.to_vec());
            connection.read_tls(&mut cursor).ok()?;
        }

        while connection.is_handshaking() {
            // **不要**先 `socket.read()` 探测有没有数据。
            //
            // 那一次读会把字节吃进本地缓冲，而紧接着的 `read_tls(socket)` 再读
            // socket 时已经空了 —— 它就一直阻塞到对端超时，握手永远完不成。
            // 表现是「整整 30 秒然后报超时」，看上去像网络问题，
            // 实际是桩自己把数据吃了。
            match connection.read_tls(socket) {
                Ok(0) | Err(_) => return None,
                Ok(_) => {}
            }

            connection.process_new_packets().ok()?;
            let _ = connection.write_tls(socket);
        }

        Some(connection)
    }

    /// 往当前那条通道回一句话 —— 有 TLS 层就走 TLS，没有就写明文。
    ///
    /// 抽成函数而不是在 `spawn_stub_ftps` 里写闭包：闭包会把 `secure` 与 `socket`
    /// 的可变借用一直持到作用域结束，而 `EPSV` 分支在回过 `229` 之后**还要**
    /// 继续用这两个（读传输命令、accept 数据连接）。编译不过只是表象，
    /// 真正的形状是「一个函数，两个调用点都要用」。
    ///
    /// `text` **必须自带结尾换行**：明文分支是直接 `write_all`，
    /// 再套一层 `writeln!` 会多出一个空行，而客户端读到的第一个空行
    /// 会被报成「无法识别的 FTP 回复」。
    fn reply_to_client(
        secure: &mut Option<rustls::ServerConnection>,
        socket: &mut std::net::TcpStream,
        text: &str,
    ) {
        use std::io::Write;

        match secure.as_mut() {
            Some(connection) => write_secure_line(connection, socket, text),
            None => {
                let _ = socket.write_all(text.as_bytes());
                let _ = socket.flush();
            }
        }
    }

    /// 起一个假 FTPS 服务端，跑完一次列目录就返回端口。
    ///
    /// 同步阻塞版，跑在独立线程上 —— 与 `ftp_provider` 里的假 FTP 服务端同一套形状，
    /// 刻意不去开第二个 tokio runtime，免得两个调度器互相干扰，
    /// 那样「测试没红」就分不清是代码没写对还是调度出了岔子。
    fn spawn_stub_ftps(
        certificate: StubCertificate,
        options: StubOptions,
        log: StubLog,
    ) -> u16 {
        use std::io::Write;
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind control");
        let port = listener.local_addr().expect("addr").port();

        std::thread::spawn(move || {
            let (mut socket, _) = listener.accept().expect("accept control");

            // 隐式：连上就是 TLS，**明文阶段没有 220**。
            // 显式：先明文 220，等 `AUTH TLS`。
            let mut secure = match options.mode {
                FtpsMode::Implicit => {
                    let mut connection = server_handshake(&mut socket, &certificate.config, &[]);

                    // 但 TLS 层**里面**仍然有欢迎语。RFC 4217 §4.2 说的是
                    // 「握手之后的会话与普通 FTP 相同」，而 FTP 会话以 220 开始。
                    // 少这一句的话，客户端的 `read_greeting()` 会一直等下去 ——
                    // 双方各等一条对方不会发的东西，30 秒后一起超时。
                    if let Some(connection) = connection.as_mut() {
                        write_secure_line(connection, &mut socket, "220 stub ready (implicit)\r\n");
                    }

                    connection
                }
                FtpsMode::Explicit => {
                    let _ = writeln!(socket, "220 stub ready");
                    let _ = socket.flush();
                    None
                }
            };

            // 当前会话是否已登录。**TLS 升级把它清回 false** ——
            // 这正是 RFC 4217 §4.2 说的「服务器把 TLS 当成新会话的开始」。
            let mut logged_in = false;
            // 明文阶段的残留。升级时整份交给 rustls（见 [`server_handshake`]）。
            let mut plain: Vec<u8> = Vec::new();

            loop {
                let command = match secure.as_mut() {
                    Some(connection) => read_secure_line(connection, &mut socket),
                    None => read_plain_line(&mut socket, &mut plain),
                };

                let Some(raw) = command else { break };

                // **在** `AUTH` 判断**之前**记账，并且记原始字节。
                // 之前 `AUTH` 因为提前 `continue` 从来不记账，
                // 「桩到底收到过什么」这个问题就少了一半证据 —— 而
                // 「没红」和「没测到」在输出里长得一模一样。
                log.0.lock().expect("log lock").push(format!(
                    "[{}] {raw:?}",
                    if secure.is_some() { "TLS" } else { "PLAIN" }
                ));

                let command = raw.trim_end().to_string();
                let verb = command.split_whitespace().next().unwrap_or("").to_string();

                // 显式 FTPS 的升级点。回 `234` 之后**不再补一个 220**：
                // 握手一结束就直接进新会话（RFC 4217 §4.2）。
                if options.mode == FtpsMode::Explicit && verb == "AUTH" {
                    let allowed = options.auth_tls_reply.starts_with("234");

                    // 升级只允许一次 —— `AUTH` 在 TLS 层里再次出现是异常，
                    // 当成重复命令忽略即可，不要再拿明文 socket 去握手。
                    if secure.is_some() {
                        continue;
                    }

                    // 明文阶段回 `234`，然后握手。
                    let _ = writeln!(socket, "{}", options.auth_tls_reply);
                    let _ = socket.flush();

                    if !allowed {
                        continue;
                    }

                    secure = server_handshake(&mut socket, &certificate.config, &plain);
                    plain.clear();
                    logged_in = false;
                    continue;
                }

                if verb == "QUIT" {
                    reply_to_client(&mut secure, &mut socket, "221 bye\r\n");
                    break;
                }

                let reply: &'static str = match verb.as_str() {
                    "USER" => {
                        logged_in = false;
                        "331 need password"
                    }
                    "PASS" => {
                        logged_in = true;
                        "230 logged in"
                    }
                    "TYPE" => "200 ok",
                    "CWD" => "250 ok",
                    // 升级后没重登的话，真实服务器回的就是这个。
                    _ if options.require_relogin && !logged_in => "530 not logged in",
                    "EPSV" => {
                        // 数据端口另开一个监听 —— 这正是被动模式的要点。
                        let data_listener = TcpListener::bind("127.0.0.1:0").expect("bind data");
                        let data_port = data_listener.local_addr().expect("addr").port();

                        reply_to_client(
                            &mut secure,
                            &mut socket,
                            &format!("229 Entering Extended Passive Mode (|||{data_port}|)\r\n"),
                        );

                        // 传输命令在这里一起处理完。现在就 accept 会死锁 ——
                        // 客户端还在等 `229` 的回包。
                        let read_next = match secure.as_mut() {
                            Some(connection) => read_secure_line(connection, &mut socket),
                            None => read_plain_line(&mut socket, &mut plain),
                        };
                        let Some(next) = read_next else { break };

                        log.0.lock().expect("log lock").push(format!(
                            "[{}] {next:?}",
                            if secure.is_some() { "TLS" } else { "PLAIN" }
                        ));

                        let Ok((data, _)) = data_listener.accept() else { break };
                        let mut data_writer = data;
                        let _ = data_writer.write_all(options.listing.as_bytes());
                        let _ = data_writer.flush();
                        drop(data_writer);

                        reply_to_client(&mut secure, &mut socket, "226 transfer complete\r\n");
                        continue;
                    }
                    _ => "500 unknown command",
                };

                reply_to_client(&mut secure, &mut socket, &format!("{reply}\r\n"));
            }
        });

        port
    }

    fn ftps_resolved(port: u16, mode: FtpsMode) -> ResolvedConnection {
        ResolvedConnection {
            connection: super::super::connection::RemoteConnection {
                id: "conn-ftps".to_string(),
                name: "FTPS stub".to_string(),
                protocol: match mode {
                    FtpsMode::Implicit => super::super::connection::RemoteProtocol::FtpsImplicit,
                    FtpsMode::Explicit => super::super::connection::RemoteProtocol::FtpsExplicit,
                },
                host: "127.0.0.1".to_string(),
                port,
                username: "tester".to_string(),
                initial_path: "/".to_string(),
                local_path: None,
                proxy: super::transport::ProxyConfig::Direct,
                credential_key: None,
            },
            password: Some("pw".to_string()),
        }
    }

    /// 一个 provider，它的 `known_hosts` 里**已经信任**了 `certificate`。
    fn provider_trusting(certificate: &StubCertificate, port: u16) -> (FtpsRemoteProvider, tempfile::TempDir) {
        let directory = tempfile::tempdir().expect("tempdir");
        let fingerprint =
            known_hosts::describe_certificate(certificate.der.as_ref()).expect("fingerprint");
        let (fingerprint, _) = fingerprint;

        let entries = vec![entry("127.0.0.1", port, &fingerprint, TrustKind::X509)];
        let file = serde_json::json!({ "version": 1, "entries": entries });

        std::fs::write(
            known_hosts::known_hosts_path_in(directory.path()),
            serde_json::to_string_pretty(&file).expect("serialise"),
        )
        .expect("write known hosts");

        let provider = FtpsRemoteProvider::new(directory.path(), directory.path());

        (provider, directory)
    }

    /// 一个 provider，它的 `known_hosts` 是**空的**。
    fn provider_trusting_nothing() -> (FtpsRemoteProvider, tempfile::TempDir) {
        let directory = tempfile::tempdir().expect("tempdir");
        let provider = FtpsRemoteProvider::new(directory.path(), directory.path());

        (provider, directory)
    }

    #[tokio::test]
    async fn an_explicit_session_is_upgraded_and_then_logged_in_again() {
        let certificate = stub_certificate();
        let log = StubLog::default();
        let port = spawn_stub_ftps(
            StubCertificate {
                der: certificate.der.clone(),
                config: Arc::clone(&certificate.config),
            },
            StubOptions::explicit(
                "type=file;size=7;modify=20230101120000; secret.txt\n\
                 type=dir;modify=20230101120000; priv\n",
            ),
            log.clone(),
        );

        let (provider, _directory) = provider_trusting(&certificate, port);

        let entries = provider
            .list(&ftps_resolved(port, FtpsMode::Explicit), "/")
            .await
            .unwrap_or_else(|error| {
                panic!(
                    "the stub session must complete, got {error:?}\nstub saw: {:#?}",
                    log.commands()
                )
            });

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "secret.txt");
        assert_eq!(entries[1].name, "priv");
        assert!(entries[1].is_dir);

        let commands = log.commands();
        // 桩把每条命令记成 `[TLS] "USER tester\r\n"` 这样，**带引号、带转义**。
        // 所以一律用 `contains`，不用 `starts_with` ——
        // 后者会因为格式里多了前缀而永远匹配不上，
        // 症状是「客户端明明发了，断言说没发」。
        let index_of = |verb: &str| commands.iter().position(|c| c.contains(verb));

        let auth = index_of("AUTH TLS").expect("AUTH TLS must be sent");
        let user = index_of("USER").expect("USER must be sent");
        let pass = index_of("PASS").expect("PASS must be sent");

        // 升级前**和**升级后都要有 `USER`/`PASS`。
        //
        // `index_of` 只拿得到**第一条**，而这里要验的是「`AUTH` 之后还有一条」——
        // 「至少有一条 USER」和「升级后重登了」是两件事。
        let after_upgrade: Vec<&String> = commands[auth + 1..].iter().collect();

        assert!(
            after_upgrade.iter().any(|command| command.contains("USER")),
            "USER must be re-sent after AUTH TLS, got {commands:#?}"
        );
        assert!(
            after_upgrade.iter().any(|command| command.contains("PASS")),
            "PASS must be re-sent after AUTH TLS, got {commands:#?}"
        );
        // 阳性对照：升级前那次登录也确实发生过，否则上面两条只是在测「重登一次」。
        assert!(
            user < auth && pass < auth,
            "clear-text login must precede AUTH TLS, got {commands:#?}"
        );
        // 而升级之后那组必须排在 `AUTH` 之后 —— 否则「重登」可能发生在错误的一侧。
        assert!(
            after_upgrade
                .iter()
                .any(|command| command.contains("PASS") && command.contains("[TLS]")),
            "the second PASS must travel inside TLS, got {commands:#?}"
        );
    }

    #[tokio::test]
    async fn an_implicit_session_starts_with_tls_and_lists_the_same_way() {
        let certificate = stub_certificate();
        let log = StubLog::default();
        let port = spawn_stub_ftps(
            StubCertificate {
                der: certificate.der.clone(),
                config: Arc::clone(&certificate.config),
            },
            StubOptions::implicit("type=file;size=3;modify=20230101120000; implicit.txt\n"),
            log.clone(),
        );

        let (provider, _directory) = provider_trusting(&certificate, port);

        let entries = provider
            .list(&ftps_resolved(port, FtpsMode::Implicit), "/")
            .await
            .expect("the implicit stub session must complete");

        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "implicit.txt");

        let commands = log.commands();

        // 隐式**没有** `AUTH TLS`：上来就已经是 TLS 了。
        // 有的话说明模式判断错了 —— 用户配的隐式却按显式走。
        assert!(
            !commands.iter().any(|c| c.contains("AUTH")),
            "an implicit session must not send AUTH TLS, got {commands:#?}"
        );
        assert!(
            commands.iter().any(|c| c.contains("USER")),
            "an implicit session must still log in, got {commands:#?}"
        );
        // 整条会话都必须在 TLS 层里 —— 明文里出现任何一条命令就是降级了。
        assert!(
            commands.iter().all(|c| c.starts_with("[TLS]")),
            "nothing may travel in the clear, got {commands:#?}"
        );
    }

    #[tokio::test]
    async fn a_server_that_refuses_auth_tls_names_that_refusal_itself() {
        let certificate = stub_certificate();
        let log = StubLog::default();
        let mut options = StubOptions::explicit("type=file;size=1; a.txt\n");
        // 桩回 500 之后**继续待在明文里**（真实服务器此时在等下一条明文命令，
        // 而客户端会开始发 TLS ClientHello），于是客户端的握手必然失败。
        options.auth_tls_reply = "500 AUTH not understood by this server";
        let port = spawn_stub_ftps(
            StubCertificate {
                der: certificate.der.clone(),
                config: Arc::clone(&certificate.config),
            },
            options,
            log.clone(),
        );

        let (provider, _directory) = provider_trusting(&certificate, port);

        let error = provider
            .list(&ftps_resolved(port, FtpsMode::Explicit), "/")
            .await
            .expect_err("a server without AUTH TLS must not yield a listing");

        // 判据是**消息**，不是 `kind`。
        //
        // 「AUTH TLS 被拒」（`服务器拒绝了这条命令：500 AUTH not understood…`）
        // 与「后面握手失败」（`TLS 握手失败：…`）**都是 `Protocol`** ——
        // 只断言 `kind` 的话两种行为都通过，那条断言等于没有。
        //
        // 静默降级**不会**真的成功：客户端紧接着发 ClientHello，而服务器在等明文
        // 命令，握手照样失败。真实危害在消息里 —— 用户看到「TLS 握手失败」会去查
        // 网络与证书，而真正的原因是这台服务器压根不支持 FTPS。
        assert!(
            error.message.contains("AUTH not understood"),
            "the error must name the AUTH TLS refusal, got {:?}: {}",
            error.kind,
            error.message
        );
        assert!(
            !error.message.contains("TLS 握手失败"),
            "the follow-up handshake failure must not be what the user sees, got {}",
            error.message
        );
    }

    #[tokio::test]
    async fn an_untrusted_certificate_reaches_the_user_as_a_prompt_not_a_network_error() {
        let certificate = stub_certificate();
        let log = StubLog::default();
        let port = spawn_stub_ftps(
            StubCertificate {
                der: certificate.der.clone(),
                config: Arc::clone(&certificate.config),
            },
            StubOptions::explicit("type=file;size=1; a.txt\n"),
            log,
        );

        // 阳性对照的前提：这一台主机**一张证书都没信任过**。
        let (provider, _directory) = provider_trusting_nothing();

        let error = provider
            .list(&ftps_resolved(port, FtpsMode::Explicit), "/")
            .await
            .expect_err("an unknown certificate must not yield a listing");

        // 整个文件存在的理由就在这一行：必须是 `HostKeyUnknown`
        // （前端据此弹指纹确认窗），而不是 `Protocol`（用户去查网络）。
        assert_eq!(
            error.kind,
            RemoteErrorKind::HostKeyUnknown,
            "an unknown certificate must be reported as a trust prompt"
        );
        assert!(error.fingerprint.is_some(), "the prompt needs a fingerprint");
    }
}
