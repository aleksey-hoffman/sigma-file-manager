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
//! - **隐式**（RFC 4217 §4.2，默认端口 990）：连上就是 TLS，没有 220 欢迎语。
//! - **显式**（§4.1，默认端口 21）：先明文登录，`AUTH TLS` 得到 234 之后升级，
//!   **然后必须重新 `USER`/`PASS`** —— 服务器把升级当作新会话的开始。
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
                    // 隐式：连上就是 TLS，**没有 220 欢迎语**。
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
}
