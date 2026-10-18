// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 「测试连接」的内核：真的去连一次，把**卡在哪一步**报回来。
//!
//! # 为什么返回 `Ok(report)` 而不是 `Err`
//!
//! 「密码错了」是一次**成功完成的测试**，只是结论是否定的。若把它塞进 `Err`，
//! 前端就得从错误文案里反推结论，测试「连通了但认证被拒」与「压根没连上」会退化成
//! 两段字符串，界面无从配色、也做不了「重试」以外的处置。
//! 所以：**只有入参本身非法才返回 `Err`**（空主机、端口 0），
//! 其余一切 —— 连不上、协议不对、密码错、全部通过 —— 都走 `Ok`。
//!
//! # ⚠️ 本模块**不校验服务器身份**，这是「测试连接」的刻意取舍
//!
//! SSH 走 russh 的 `check_server_key`，这里无条件放行；FTPS 的证书校验器也放行。
//! 理由是用户在测的是**自己刚填进去的地址**，此时还没有可对照的指纹，
//! 拿不到 known_hosts 就强校验只会一律失败。
//!
//! **代价必须写在明面上**：`tls_verified` 字段恒为 `false`，报告里能看到。
//! 阶段 2 真正读取远端目录时**不得复用本模块**，那时必须先落地 known_hosts /
//! 证书固定，否则就是一次静默的中间人窗口。

use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt};

use super::connection::RemoteProtocol;
use super::error::{RemoteError, RemoteErrorKind};
use super::transport::{self, ProxyConfig, Socks5CommandKind, TransportStream};

/// 整个探测的上限。用户点一次按钮不该等更久。
pub const PROBE_TIMEOUT: Duration = Duration::from_secs(15);

/// 先替 russh 替我们看一眼「这个端口上跑的是什么」的时限。
const BANNER_TIMEOUT: Duration = Duration::from_secs(5);

/// 标识串预读的字节上限，与 russh 的 `SSH_ID_MAX_LINE_LEN` 对齐。
const BANNER_MAX_BYTES: usize = 255;

/// 允许的前导行数，与 russh 的 `SSH_ID_MAX_PRE_BANNER_LINES` 对齐。
const BANNER_MAX_PRE_LINES: usize = 20;

/// 单条 FTP 回复的上限。防「服务端一直不发换行」把内存吃光。
const MAX_REPLY_BYTES: usize = 1024;

/// 测试结论。前端按这个分支配色与措辞，不解析 `message`。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProbeOutcome {
    /// 协议握手与凭据都过了。
    Verified,
    /// 连上了、协议也对，但服务器拒了这组凭据 —— 去改密码。
    AuthRejected,
    /// 服务器要求密码/凭据，但这次没提供。匿名 FTP 不算这种情况。
    MissingCredential,
    /// 连上了，但这不是该协议的服务（把 SFTP 指到了 FTP 上等）。
    WrongProtocol,
    /// 网络层没通：DNS、连接被拒、超时、代理失败。
    Unreachable,
    /// 连上了也认得协议，但后续交互出不来预期结果。
    ProtocolError,
}

impl ProbeOutcome {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Verified => "verified",
            Self::AuthRejected => "auth_rejected",
            Self::MissingCredential => "missing_credential",
            Self::WrongProtocol => "wrong_protocol",
            Self::Unreachable => "unreachable",
            Self::ProtocolError => "protocol_error",
        }
    }

    /// 归到 `RemoteErrorKind`。
    ///
    /// ⚠️ **当前没有生产调用方**，前端是按 `outcome` 字符串分派的。
    /// 留着是因为阶段 2 把「结论」接进统一错误提示时会用到；
    /// 但在那之前它只有测试在调，**别把它当成已经接上的映射表**。
    pub fn error_kind(self) -> RemoteErrorKind {
        match self {
            Self::Verified | Self::AuthRejected | Self::MissingCredential => {
                RemoteErrorKind::Auth
            }
            Self::WrongProtocol | Self::ProtocolError => RemoteErrorKind::Protocol,
            Self::Unreachable => RemoteErrorKind::Unreachable,
        }
    }
}

/// 一次测试的结果。字段名 camelCase，与前端 `types/remote.ts` 对齐。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionTestReport {
    pub outcome: ProbeOutcome,
    /// 服务端自报身份：SFTP 是主机公钥，FTP 是 220 那行文本。拿不到就是 `None`。
    pub server_identity: Option<String>,
    /// 本次**是否真的提交并核验了密码**。
    ///
    /// 缺这个字段的话，「通过」会被读成「密码没问题」——
    /// 而匿名 FTP、免密 SFTP 同样会通过，那是在骗人。
    pub password_checked: bool,
    /// TLS 证书**没有**校验。恒为 `false`，见模块顶部。
    pub tls_verified: bool,
    /// 给用户看的一句话。**不要拿它做逻辑判断**，用 `outcome`。
    pub message: String,
}

impl ConnectionTestReport {
    fn new(outcome: ProbeOutcome, message: impl Into<String>) -> Self {
        Self {
            outcome,
            server_identity: None,
            password_checked: false,
            tls_verified: false,
            message: message.into(),
        }
    }

    fn with_identity(mut self, identity: Option<String>) -> Self {
        self.server_identity = identity;
        self
    }

    fn with_password_checked(mut self, checked: bool) -> Self {
        self.password_checked = checked;
        self
    }
}

/// 一次探测的目标。`password` 为 `None` 表示「不打算提交凭据」
/// （表单里密码框留空、且这条连接也没存过），而不是「空密码」。
#[derive(Debug, Clone)]
pub struct ProbeTarget {
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: Option<String>,
    pub proxy: ProxyConfig,
}

// ---------------------------------------------------------------------------
// 纯函数：回复分类。单测只碰这一层，不碰网络。
// ---------------------------------------------------------------------------

/// 取 FTP 回复行的三位数字。`"220 ready"` → `Some(220)`；空行、乱码 → `None`。
///
/// 多行回复（`230-...` 换行后 `230 `）只取第一行：分类只需要状态码。
pub fn parse_ftp_reply_code(line: &str) -> Option<u16> {
    let bytes = line.trim_start().as_bytes();
    if bytes.len() < 3 || !bytes[..3].iter().all(u8::is_ascii_digit) {
        return None;
    }

    std::str::from_utf8(&bytes[..3]).ok()?.parse().ok()
}

/// 服务端第一句就说自己不是 FTP 时用得上。
///
/// **前置条件：`code` 一定不在 `200..=299` 里。** 两个调用点都在 `220` 这类
/// 正常问候之后才走到这里（见 `probe_inner` 的显式 FTPS 分支与 `ftp_login`），
/// 所以这里**没有 220 这个分支是刻意的**：给它挂一个 `ProtocolError` 看着像
/// 「防止 220 被当成通过」，实际是一条永远走不到的死分支 —— 而它一旦被走到，
/// 一条正常的欢迎语就会被报成协议错误。宁可让它显式落进 `_`。
///
/// `421` / `425` / `450` 都属于「我还在，只是现在不方便」，不是「协议不对」；
/// 把它们误判成 wrong_protocol 会让用户去改协议设置，而真正的原因是稍后重试。
pub fn classify_ftp_greeting(code: u16) -> ProbeOutcome {
    match code {
        421 | 425 | 450 => ProbeOutcome::Unreachable,
        530 => ProbeOutcome::AuthRejected,
        _ => ProbeOutcome::WrongProtocol,
    }
}

/// `PASS` 之后的结论。FTP 里认证成功只有 230，被拒主要是 530。
pub fn classify_ftp_auth_reply(code: u16) -> ProbeOutcome {
    match code {
        230 => ProbeOutcome::Verified,
        530 | 532 => ProbeOutcome::AuthRejected,
        // 421/425/450 是「现在不行」，不是「凭据不对」。
        421 | 425 | 450 => ProbeOutcome::Unreachable,
        _ => ProbeOutcome::ProtocolError,
    }
}

// ---------------------------------------------------------------------------
// 探测入口
// ---------------------------------------------------------------------------

/// 跑一次探测。**只有入参非法返回 `Err`**，其余一律 `Ok`。
pub async fn probe(target: &ProbeTarget) -> Result<ConnectionTestReport, RemoteError> {
    let host = target.host.trim();

    if host.is_empty() {
        return Err(RemoteError::protocol("服务器地址不能为空"));
    }

    if target.port == 0 {
        return Err(RemoteError::protocol("端口必须大于 0"));
    }

    let outcome = match tokio::time::timeout(PROBE_TIMEOUT, probe_inner(target, host)).await {
        Ok(Ok(report)) => return Ok(report),
        Ok(Err(error)) => report_from_error(error),
        Err(_) => ConnectionTestReport::new(
            ProbeOutcome::Unreachable,
            format!("连接超时（{PROBE_TIMEOUT:?}），服务器没有在时限内回应"),
        ),
    };

    Ok(outcome)
}

fn report_from_error(error: RemoteError) -> ConnectionTestReport {
    ConnectionTestReport::new(error.kind.into_outcome(), error.message)
}

impl RemoteErrorKind {
    /// `RemoteErrorKind` → `ProbeOutcome`。只在错误从网络层冒出来时用。
    fn into_outcome(self) -> ProbeOutcome {
        match self {
            Self::Auth => ProbeOutcome::AuthRejected,
            Self::Unreachable | Self::Disconnected => ProbeOutcome::Unreachable,
            Self::Protocol => ProbeOutcome::ProtocolError,
            Self::Permission => ProbeOutcome::AuthRejected,
            _ => ProbeOutcome::ProtocolError,
        }
    }
}

async fn probe_inner(target: &ProbeTarget, host: &str) -> Result<ConnectionTestReport, RemoteError> {
    let command = Socks5CommandKind::Connect;

    match target.protocol {
        RemoteProtocol::Sftp => probe_sftp(target, host, command).await,
        RemoteProtocol::Ftp => {
            let stream =
                transport::connect(&target.proxy, host, target.port, command).await?;
            ftp_login(stream, target).await
        }
        RemoteProtocol::FtpsImplicit => {
            let stream =
                transport::connect(&target.proxy, host, target.port, command).await?;
            let secure = upgrade_tls(stream, host).await?;
            ftp_login(secure, target).await
        }
        RemoteProtocol::FtpsExplicit => {
            let stream =
                transport::connect(&target.proxy, host, target.port, command).await?;
            // RFC 4217：先在明文控制通道上协商，拿到 234 才升级。
            let mut raw = stream;
            let mut reply = Vec::new();
            read_reply(&mut raw, &mut reply).await?;
            let greeting = decode(&reply);
            let Some(code) = parse_ftp_reply_code(&greeting) else {
                return Ok(ConnectionTestReport::new(
                    ProbeOutcome::WrongProtocol,
                    format!("对端不是 FTP 服务：{greeting}"),
                ));
            };
            if !(200..=299).contains(&code) {
                return Ok(greeting_report(greeting, code));
            }

            send_command(&mut raw, "AUTH TLS").await?;
            read_reply(&mut raw, &mut reply).await?;
            let auth_line = decode(&reply);
            if parse_ftp_reply_code(&auth_line) != Some(234) {
                return Ok(ConnectionTestReport::new(
                    ProbeOutcome::WrongProtocol,
                    format!("对端不接受显式 FTPS（AUTH TLS 回复 {auth_line}）"),
                ));
            }

            let secure = upgrade_tls(raw, host).await?;
            ftp_login(secure, target).await
        }
    }
}

fn greeting_report(greeting: String, code: u16) -> ConnectionTestReport {
    let outcome = classify_ftp_greeting(code);
    let message = match outcome {
        ProbeOutcome::AuthRejected => "服务器拒绝匿名登录（530）".to_string(),
        ProbeOutcome::Unreachable => format!("服务器暂时不可用：{greeting}"),
        _ => format!("对端不是 FTP 服务：{greeting}"),
    };

    ConnectionTestReport::new(outcome, message).with_identity(Some(greeting))
}

// ---------------------------------------------------------------------------
// SFTP / SSH
// ---------------------------------------------------------------------------

/// 只做「连上 + 验密码」，不开 SFTP 子系统、也不列目录。
///
/// 列目录要到阶段 2 接上 `russh-sftp`，那时这个 handler 必须换成会核对
/// known_hosts 的实现 —— 见模块顶部的告警。
struct ProbeHandler {
    observed_key: Arc<Mutex<Option<String>>>,
}

impl russh::client::Handler for ProbeHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        if let Ok(mut slot) = self.observed_key.lock() {
            // `PublicKeyOrCertificate` 没有 `Display`，只能用 Debug。
            *slot = Some(format!("{server_public_key:?}"));
        }

        // 见模块顶部：测试阶段不校验身份。阶段 2 必须改掉。
        Ok(true)
    }
}

/// 把 SSH 握手失败分成「这不是 SSH 服务」与「网络/其它问题」。
///
/// **按 `russh::Error` 的变体匹配，不匹配错误文案。** 之前那版用
/// `error.to_string().contains("kex" | "identification" | "handshake")`，
/// 实际上 russh 0.63 的任何一条文案里都没有这些词（`Version` 是
/// "invalid SSH version string"），于是「把 SFTP 指到 FTP 端口」永远落进
/// `Unreachable`，界面让用户去检查地址与代理 —— 而那个端口明明有人在应答。
/// 文案是 russh 的实现细节，变体才是契约。
fn classify_ssh_handshake_error(error: russh::Error) -> RemoteError {
    match error {
        // 版本协商失败 = 对端第一句不是 SSH 标识串。
        russh::Error::Version => RemoteError::protocol(format!(
            "对端没有报出 SSH 标识串，可能不是 SSH 服务：{error}"
        )),
        // 换密钥失败：这台机器不认我们支持的算法，或它压根不是 SSH。
        russh::Error::Kex | russh::Error::KexInit => {
            RemoteError::protocol(format!("SSH 密钥交换失败，可能不是 SSH 服务：{error}"))
        }
        other => RemoteError::unreachable(format!("SSH 握手失败：{other}")),
    }
}

/// 预读阶段对「这个端口上跑的是什么」的判断。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SshBanner {
    /// 数据还不够，再读。
    Pending,
    /// 对端报出了 SSH 标识串。
    Identified,
    /// 对端说了很多话，但没有一行是 SSH 标识串。
    Foreign,
}

/// 预读之后要不要继续握手。
enum BannerCheck {
    /// 是 SSH 服务（或对端还没开口），继续交给 russh。
    Continue(ReplayStream<TransportStream>),
    /// 对端有回应，但一直没报出 SSH 标识串。
    NotSsh,
}

/// 从已收到的字节判断对端是不是 SSH 服务。**纯函数**，便于逐个字节钉住。
///
/// 逐行看：命中 `SSH-1.99-` / `SSH-2.0-` 前缀就是 SSH。RFC 4253 §4.2 允许
/// 服务端在标识串之前先发几行前导文案，所以前若干行不是 SSH 并不下结论，
/// 攒满 `BANNER_MAX_PRE_LINES` 行、或字节数触到 `BANNER_MAX_BYTES` 才判否。
/// 最后一片还没换行时保持 `Pending`，等下一片。
fn classify_ssh_banner(bytes: &[u8]) -> SshBanner {
    let mut complete_lines = 0_usize;

    for line in bytes.split_inclusive(|byte| *byte == b'\n') {
        if !line.ends_with(b"\n") {
            return SshBanner::Pending;
        }
        complete_lines += 1;
        let text = String::from_utf8_lossy(line);
        let text = text.trim_end_matches(['\r', '\n']);
        if text.starts_with("SSH-1.99-") || text.starts_with("SSH-2.0-") {
            return SshBanner::Identified;
        }
        if complete_lines >= BANNER_MAX_PRE_LINES {
            return SshBanner::Foreign;
        }
    }

    if bytes.len() >= BANNER_MAX_BYTES {
        return SshBanner::Foreign;
    }

    SshBanner::Pending
}

/// 把预读时先取走的字节放回给读取方。
///
/// **没有它这一步就不成立**：读过的字节一旦丢掉，russh 会拿不到自己那份标识串，
/// 于是对**每一个** SSH 服务都会失败。
///
/// 刻意做成泛型而不是绑死 `TransportStream`：这样回放逻辑可以脱离 socket
/// 直接用 `Cursor` 验证 —— 一个「连不上就跳过」的测试等于没有测试。
struct ReplayStream<R> {
    prefix: std::io::Cursor<Vec<u8>>,
    inner: R,
}

impl<R> AsyncRead for ReplayStream<R>
where
    R: AsyncRead + Unpin,
{
    fn poll_read(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &mut tokio::io::ReadBuf<'_>,
    ) -> Poll<std::io::Result<()>> {
        let this = self.get_mut();
        let start = this.prefix.position() as usize;
        let available = this.prefix.get_ref().len().saturating_sub(start);

        if available == 0 {
            return Pin::new(&mut this.inner).poll_read(context, buffer);
        }

        let take = available.min(buffer.remaining());
        match this.prefix.get_ref().get(start..start + take) {
            Some(slice) => {
                buffer.put_slice(slice);
                this.prefix.set_position((start + take) as u64);
                Poll::Ready(Ok(()))
            }
            // start..take 的两端都落在已知范围内，这里不可能失败。
            // 真失败了也只能报出去 —— 悄悄返回空会变成永不推进的读循环。
            None => Poll::Ready(Err(std::io::Error::new(
                std::io::ErrorKind::InvalidData,
                "replay prefix out of range",
            ))),
        }
    }
}

impl<R> AsyncWrite for ReplayStream<R>
where
    R: AsyncWrite + Unpin,
{
    fn poll_write(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &[u8],
    ) -> Poll<std::io::Result<usize>> {
        Pin::new(&mut self.get_mut().inner).poll_write(context, buffer)
    }

    fn poll_flush(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_flush(context)
    }

    fn poll_shutdown(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
    ) -> Poll<std::io::Result<()>> {
        Pin::new(&mut self.get_mut().inner).poll_shutdown(context)
    }
}

/// 先自己读一眼对方的标识串，再决定要不要把它交给 russh。
///
/// # 为什么不能只靠 `classify_ssh_handshake_error`
///
/// russh 的 `read_ssh_id` 对客户端**允许 20 行前导行**（RFC 4253 §4.2 的
/// pre-banner），只有先撞满这个上限才会吐 `Error::Version`。真实 FTP 服务
/// 恰恰只发一行 `220 ...` 然后静静等待 —— 这一行被当前导行丢掉，russh 就
/// 一直等，等到我们 15 秒后超时。用户看到的是「连接超时，服务器没有在时限内
/// 回应」，于是去查地址和代理，可地址明明是对的，错的只是协议。
///
/// 所以这里**先读一眼**：读到的东西会由 `ReplayStream` 原样喂回去，
/// 对真正的 SSH 服务完全透明；只有「对方说了话且不是 SSH 标识串」才提前下结论。
async fn read_ssh_banner(
    mut stream: TransportStream,
) -> Result<BannerCheck, RemoteError> {
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = [0_u8; 256];

    let read = tokio::time::timeout(BANNER_TIMEOUT, async {
        let outcome: std::io::Result<()> = loop {
            let taken = stream.read(&mut chunk).await?;
            if taken == 0 {
                // 对端关了连接：它连一句话都没说，交给 russh 报更准。
                break Ok(());
            }
            buf.extend_from_slice(&chunk[..taken]);

            if classify_ssh_banner(&buf) != SshBanner::Pending || buf.len() >= BANNER_MAX_BYTES {
                break Ok(());
            }
        };
        outcome
    })
    .await;

    if let Ok(Err(error)) = read {
        return Err(RemoteError::unreachable(format!("读取 SSH 标识串失败：{error}")));
    }

    // 一个字节都没收到 = 服务器没应答（例如 HTTP 这类「等你先说话」的服务）。
    // 这种情况下 russh 自己再等一轮更合适，不要抢着下结论。
    if buf.is_empty() {
        return Ok(BannerCheck::Continue(ReplayStream {
            prefix: std::io::Cursor::new(Vec::new()),
            inner: stream,
        }));
    }

    let identified = classify_ssh_banner(&buf) == SshBanner::Identified;

    if !identified {
        return Ok(BannerCheck::NotSsh);
    }

    Ok(BannerCheck::Continue(ReplayStream {
        prefix: std::io::Cursor::new(buf),
        inner: stream,
    }))
}

async fn probe_sftp(
    target: &ProbeTarget,
    host: &str,
    command: Socks5CommandKind,
) -> Result<ConnectionTestReport, RemoteError> {
    let stream = transport::connect(&target.proxy, host, target.port, command).await?;

    // 与 FTP 路径的「对端不是 FTP 服务」同一个结论码，用户拿到的处置一致：
    // 去改协议或端口，而不是去查地址与代理。
    let stream = match read_ssh_banner(stream).await? {
        BannerCheck::Continue(stream) => stream,
        BannerCheck::NotSsh => {
            return Ok(ConnectionTestReport::new(
                ProbeOutcome::WrongProtocol,
                "该端口有回应，但对方没有报出 SSH 标识串 —— 多半不是 SSH 服务（协议选错，或端口填成了 FTP 等其它服务）",
            ));
        }
    };

    let observed = Arc::new(Mutex::new(None));
    let handler = ProbeHandler {
        observed_key: Arc::clone(&observed),
    };

    let mut session = russh::client::connect_stream(
        Arc::new(russh::client::Config::default()),
        stream,
        handler,
    )
    .await
    .map_err(classify_ssh_handshake_error)?;

    let identity = observed
        .lock()
        .ok()
        .and_then(|slot| slot.clone());

    let Some(password) = target.password.as_deref() else {
        // 没有密码就只验到「这个 SSH 服务能完成握手」为止。
        // 不能报 Verified —— 那会被读成「密码没问题」。
        return Ok(ConnectionTestReport::new(
            ProbeOutcome::MissingCredential,
            "SSH 握手成功，但未提供密码，无法验证认证",
        )
        .with_identity(identity));
    };

    let username = if target.username.trim().is_empty() {
        "anonymous".to_string()
    } else {
        target.username.clone()
    };

    let result = session
        .authenticate_password(username, password)
        .await
        .map_err(|error| RemoteError::auth(format!("SSH 认证失败：{error}")))?;

    if result.success() {
        return Ok(
            ConnectionTestReport::new(ProbeOutcome::Verified, "连接成功，服务器已接受该凭据")
                .with_identity(identity)
                .with_password_checked(true),
        );
    }

    Ok(
        ConnectionTestReport::new(ProbeOutcome::AuthRejected, "服务器拒绝了该用户名或密码")
            .with_identity(identity)
            .with_password_checked(true),
    )
}

// ---------------------------------------------------------------------------
// FTP / FTPS
// ---------------------------------------------------------------------------

async fn ftp_login<S>(
    mut stream: S,
    target: &ProbeTarget,
) -> Result<ConnectionTestReport, RemoteError>
where
    S: AsyncRead + AsyncWrite + Unpin + Send,
{
    let mut reply = Vec::new();
    read_reply(&mut stream, &mut reply).await?;
    let greeting = decode(&reply);
    let Some(code) = parse_ftp_reply_code(&greeting) else {
        return Ok(ConnectionTestReport::new(
            ProbeOutcome::WrongProtocol,
            format!("对端不是 FTP 服务：{greeting}"),
        ));
    };

    if !(200..=299).contains(&code) {
        return Ok(greeting_report(greeting, code));
    }

    let identity = Some(greeting);
    let username = if target.username.trim().is_empty() {
        "anonymous".to_string()
    } else {
        target.username.clone()
    };

    send_command(&mut stream, &format!("USER {username}")).await?;
    read_reply(&mut stream, &mut reply).await?;
    let user_line = decode(&reply);
    let user_code = parse_ftp_reply_code(&user_line).unwrap_or(0);

    // 230：USER 阶段就已经登录成功（例如某些服务器认 USER 匿名）。
    if user_code == 230 {
        return Ok(
            ConnectionTestReport::new(ProbeOutcome::Verified, "连接成功，服务器已接受该用户名")
                .with_identity(identity),
        );
    }

    // 530 在 USER 阶段就出来 = **用户名**被拒，不是「没提供密码」。
    // 漏掉这一支会把它报成 missing_credential，让用户去检查密码框，
    // 而密码一个字都没错。
    if user_code == 530 || user_code == 532 {
        return Ok(
            ConnectionTestReport::new(ProbeOutcome::AuthRejected, "服务器拒绝了该用户名")
                .with_identity(identity),
        );
    }

    let Some(password) = target.password.as_deref() else {
        return Ok(ConnectionTestReport::new(
            ProbeOutcome::MissingCredential,
            format!("服务器要求密码（回复 {user_line}），但未提供"),
        )
        .with_identity(identity));
    };

    send_command(&mut stream, &format!("PASS {password}")).await?;
    read_reply(&mut stream, &mut reply).await?;
    let pass_line = decode(&reply);
    let pass_code = parse_ftp_reply_code(&pass_line).unwrap_or(0);
    let outcome = classify_ftp_auth_reply(pass_code);

    let message = match outcome {
        ProbeOutcome::Verified => "连接成功，服务器已接受该凭据".to_string(),
        ProbeOutcome::AuthRejected => "服务器拒绝了该用户名或密码".to_string(),
        ProbeOutcome::Unreachable => format!("服务器暂时不可用：{pass_line}"),
        _ => format!("无法识别的登录结果：{pass_line}"),
    };

    Ok(
        ConnectionTestReport::new(outcome, message)
            .with_identity(identity)
            .with_password_checked(true),
    )
}

async fn read_reply<S: AsyncRead + Unpin>(
    stream: &mut S,
    buffer: &mut Vec<u8>,
) -> Result<(), RemoteError> {
    buffer.clear();
    let mut byte = [0_u8; 1];

    loop {
        let read = stream.read(&mut byte).await.map_err(|error| {
            RemoteError::disconnected(format!("读取服务器回复失败：{error}"))
        })?;

        if read == 0 {
            // 对端在换行之前就关了连接。
            return Err(RemoteError::disconnected("服务器在回复完成前关闭了连接"));
        }

        buffer.push(byte[0]);

        if byte[0] == b'\n' || buffer.len() >= MAX_REPLY_BYTES {
            return Ok(());
        }
    }
}

async fn send_command<S: AsyncWrite + Unpin>(
    stream: &mut S,
    line: &str,
) -> Result<(), RemoteError> {
    stream
        .write_all(line.as_bytes())
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送命令失败：{error}")))?;
    stream
        .write_all(b"\r\n")
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送命令失败：{error}")))?;
    stream
        .flush()
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送命令失败：{error}")))
}

fn decode(bytes: &[u8]) -> String {
    String::from_utf8_lossy(bytes).trim().to_string()
}

// ---------------------------------------------------------------------------
// FTPS 的 TLS 升级
// ---------------------------------------------------------------------------

/// 把任意字节流包成 TLS。
///
/// 用 `TransportStream` 而不是 `tokio::net::TcpStream` 是刻意的：前者能穿过
/// SOCKS5 / HTTP CONNECT 代理，后者不能。协议层不该知道走的哪条路。
async fn upgrade_tls<S>(
    stream: S,
    host: &str,
) -> Result<tokio_rustls::client::TlsStream<S>, RemoteError>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let config = rustls::ClientConfig::builder()
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(AcceptAnyCertificate))
        .with_no_client_auth();

    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    let server_name = rustls::pki_types::ServerName::try_from(host.to_string())
        .map_err(|error| RemoteError::protocol(format!("主机名无法用于 TLS：{error}")))?;

    connector
        .connect(server_name, stream)
        .await
        .map_err(|error| RemoteError::protocol(format!("TLS 握手失败：{error}")))
}

/// 测试期间放行一切证书。**只在「测试连接」里用**，见模块顶部。
#[derive(Debug)]
struct AcceptAnyCertificate;

impl rustls::client::danger::ServerCertVerifier for AcceptAnyCertificate {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_three_digit_reply_code() {
        assert_eq!(parse_ftp_reply_code("220 ready"), Some(220));
        assert_eq!(parse_ftp_reply_code("  530 Login incorrect"), Some(530));
        assert_eq!(parse_ftp_reply_code("230-多行\r\n230 结束"), Some(230));
    }

    #[test]
    fn rejects_lines_that_are_not_ftp_replies() {
        // SSH 服务误指到 FTP 是高频误配，必须能认出来而不是当成 0。
        assert_eq!(parse_ftp_reply_code("SSH-2.0-OpenSSH_9.6"), None);
        assert_eq!(parse_ftp_reply_code(""), None);
        assert_eq!(parse_ftp_reply_code("22"), None);
        assert_eq!(parse_ftp_reply_code("<html>"), None);
    }

    #[test]
    fn greeting_classifier_only_ever_sees_non_2xx_replies() {
        // 220 是「欢迎」，不是通过也不是失败。两个调用点都在 2xx 之后才调用，
        // 所以这里刻意没有 220 分支 —— 加一个只会被误读成「代码处理过 220」。
        assert_eq!(classify_ftp_greeting(421), ProbeOutcome::Unreachable);
        assert_eq!(classify_ftp_greeting(530), ProbeOutcome::AuthRejected);
        assert_eq!(classify_ftp_greeting(500), ProbeOutcome::WrongProtocol);
    }

    #[test]
    fn greeting_temporary_failures_are_not_protocol_mismatches() {
        // 421/425/450 的处置是稍后重试，不是去改协议设置。
        for code in [421, 425, 450] {
            assert_eq!(
                classify_ftp_greeting(code),
                ProbeOutcome::Unreachable,
                "{code} 应归为暂时不可用"
            );
        }
        assert_eq!(classify_ftp_greeting(500), ProbeOutcome::WrongProtocol);
    }

    #[test]
    fn only_230_counts_as_verified() {
        assert_eq!(classify_ftp_auth_reply(230), ProbeOutcome::Verified);
        assert_eq!(classify_ftp_auth_reply(530), ProbeOutcome::AuthRejected);
        assert_eq!(classify_ftp_auth_reply(532), ProbeOutcome::AuthRejected);
        assert_eq!(classify_ftp_auth_reply(421), ProbeOutcome::Unreachable);
        assert_eq!(classify_ftp_auth_reply(200), ProbeOutcome::ProtocolError);
    }

    #[test]
    fn outcomes_serialize_as_snake_case_and_round_trip() {
        let outcomes = [
            ProbeOutcome::Verified,
            ProbeOutcome::AuthRejected,
            ProbeOutcome::MissingCredential,
            ProbeOutcome::WrongProtocol,
            ProbeOutcome::Unreachable,
            ProbeOutcome::ProtocolError,
        ];
        let names = [
            "verified",
            "auth_rejected",
            "missing_credential",
            "wrong_protocol",
            "unreachable",
            "protocol_error",
        ];

        for (outcome, name) in outcomes.iter().zip(names) {
            assert_eq!(serde_json::to_string(outcome).expect("serialize"), format!("\"{name}\""));
            assert_eq!(outcome.as_str(), name);
        }
    }

    #[test]
    fn report_serializes_in_camel_case_for_the_frontend() {
        let report = ConnectionTestReport {
            outcome: ProbeOutcome::Verified,
            server_identity: Some("SSH-2.0-x".to_string()),
            password_checked: true,
            tls_verified: false,
            message: "连接成功".to_string(),
        };
        let json = serde_json::to_value(&report).expect("serialize");

        assert_eq!(json["outcome"], "verified");
        assert_eq!(json["serverIdentity"], "SSH-2.0-x");
        assert_eq!(json["passwordChecked"], true);
        // 恒为 false，但**必须在字段里**，让前端没法默默当成校验通过。
        assert_eq!(json["tlsVerified"], false);
        assert_eq!(json["message"], "连接成功");
    }

    #[test]
    fn every_outcome_maps_to_an_error_kind() {
        assert_eq!(ProbeOutcome::AuthRejected.error_kind(), RemoteErrorKind::Auth);
        assert_eq!(ProbeOutcome::MissingCredential.error_kind(), RemoteErrorKind::Auth);
        assert_eq!(ProbeOutcome::Unreachable.error_kind(), RemoteErrorKind::Unreachable);
        assert_eq!(ProbeOutcome::WrongProtocol.error_kind(), RemoteErrorKind::Protocol);
        assert_eq!(ProbeOutcome::ProtocolError.error_kind(), RemoteErrorKind::Protocol);
    }

    #[tokio::test]
    async fn rejects_a_blank_host_before_touching_the_network() {
        let target = ProbeTarget {
            protocol: RemoteProtocol::Sftp,
            host: "   ".to_string(),
            port: 22,
            username: "u".to_string(),
            password: Some("p".to_string()),
            proxy: ProxyConfig::Direct,
        };

        let error = probe(&target).await.expect_err("空主机必须在入参阶段被拒");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    #[tokio::test]
    async fn rejects_port_zero_before_touching_the_network() {
        let target = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "192.0.2.1".to_string(),
            port: 0,
            username: "u".to_string(),
            password: Some("p".to_string()),
            proxy: ProxyConfig::Direct,
        };

        let error = probe(&target).await.expect_err("端口 0 必须在入参阶段被拒");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    /// 阳性对照：确认上面两条不是因为「探测一律失败」才过的。
    ///
    /// 127.0.0.1:1 上必然没有监听，探测应当**成功返回一个报告**（结论为不可达），
    /// 而不是 Err。这同时钉住「除入参外一律 Ok」这条契约。
    #[tokio::test]
    async fn network_failure_is_reported_as_an_outcome_not_an_error() {
        let target = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "127.0.0.1".to_string(),
            port: 1,
            username: "u".to_string(),
            password: Some("p".to_string()),
            proxy: ProxyConfig::Direct,
        };

        let report = probe(&target).await.expect("网络失败必须落在 Ok 分支");

        assert_eq!(report.outcome, ProbeOutcome::Unreachable);
        assert!(!report.password_checked);
        assert!(!report.tls_verified);
    }

    /// 对着一个真的 FTP 假服务端跑完整流程。
    ///
    /// 这条是「测试连接」的核心保证：不只是分类函数对，而是真的按 FTP 的规矩
    /// 收发了一遍，并对成功密码与错误密码给出相反的结论。
    #[tokio::test]
    async fn logs_in_against_a_stub_ftp_server_and_verifies_the_password() {
        let (address, expected_password, mut accepted) = spawn_stub_ftp("230 已登录", "530 密码不对");

        let good = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "127.0.0.1".to_string(),
            port: address.port(),
            username: "user".to_string(),
            password: Some(expected_password.clone()),
            proxy: ProxyConfig::Direct,
        };
        let report = probe(&good).await.expect("探测应当成功返回报告");

        assert_eq!(report.outcome, ProbeOutcome::Verified);
        assert!(report.password_checked);
        assert_eq!(
            report.server_identity.as_deref(),
            Some("220 test server ready")
        );

        let wrong = ProbeTarget {
            password: Some("not-it".to_string()),
            ..good
        };
        let report = probe(&wrong).await.expect("密码错也应当成功返回报告");

        assert_eq!(report.outcome, ProbeOutcome::AuthRejected);
        assert!(report.password_checked);

        // 假服务端确实收到了两次 PASS，且值就是各自送进去的那个。
        let seen = commands_seen(&accepted);
        assert_eq!(
            seen,
            vec![
                format!("PASS {expected_password}"),
                "PASS not-it".to_string()
            ]
        );
    }

    #[tokio::test]
    async fn a_530_on_the_user_stage_is_a_rejected_username_not_a_missing_password() {
        // 少了这条支路，它会落进 missing_credential，界面叫用户去检查密码框 ——
        // 而密码一个字都没错，错的是用户名。
        let (address, _, accepted) =
            spawn_stub_ftp_with("230 已登录", "530 密码不对", "530 that account is not allowed");

        let target = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "127.0.0.1".to_string(),
            port: address.port(),
            username: "banned".to_string(),
            password: Some("whatever".to_string()),
            proxy: ProxyConfig::Direct,
        };
        let report = probe(&target).await.expect("探测应当成功返回报告");

        assert_eq!(report.outcome, ProbeOutcome::AuthRejected);
        assert!(
            report.message.contains("用户名"),
            "提示应当指向用户名，实际是：{}",
            report.message
        );
        // 密码压根没被发出去，所以不能声称核验过。
        assert!(!report.password_checked);
        assert!(!commands_seen(&accepted)
            .iter()
            .any(|line| line.starts_with("PASS")));
    }

    #[tokio::test]
    async fn reports_missing_credential_instead_of_claiming_success() {
        let (address, _, mut accepted) = spawn_stub_ftp("230 已登录", "530 密码不对");

        let target = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "127.0.0.1".to_string(),
            port: address.port(),
            username: "user".to_string(),
            password: None,
            proxy: ProxyConfig::Direct,
        };
        let report = probe(&target).await.expect("探测应当成功返回报告");

        // USER 回 331（要密码），没密码就到此为止。
        assert_eq!(report.outcome, ProbeOutcome::MissingCredential);
        assert!(!report.password_checked);
        assert!(!commands_seen(&accepted)
            .iter()
            .any(|line| line.starts_with("PASS")));
    }

    #[tokio::test]
    async fn recognizes_a_non_ftp_service() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let address = listener.local_addr().expect("addr");

        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept");
            // 一条 SSH 标识串：用户把 SFTP 端口填到了 FTP 里。
            let _ = socket.write_all(b"SSH-2.0-OpenSSH_9.6\r\n").await;
            let mut sink = Vec::new();
            let _ = tokio::io::AsyncReadExt::read_to_end(&mut socket, &mut sink).await;
        });

        let target = ProbeTarget {
            protocol: RemoteProtocol::Ftp,
            host: "127.0.0.1".to_string(),
            port: address.port(),
            username: "u".to_string(),
            password: Some("p".to_string()),
            proxy: ProxyConfig::Direct,
        };
        let report = probe(&target).await.expect("探测应当成功返回报告");

        assert_eq!(report.outcome, ProbeOutcome::WrongProtocol);
    }

    /// 起一个只会说「220 / USER / PASS」的最小 FTP 假服务端。
    ///
    /// 返回 `(地址, 正确口令, 收到的命令日志)`。日志用 `Arc` 回传：
    /// **不能**在这里 `lock().clone()` 一次就返回 —— 那一刻服务线程还没跑，
    /// 拿到的是空数组，两条断言会一起变成「断言一个永远为空的列表」。
    type StubLog = Arc<Mutex<Vec<String>>>;

    fn spawn_stub_ftp(
        login_reply: &'static str,
        reject_reply: &'static str,
    ) -> (std::net::SocketAddr, String, StubLog) {
        spawn_stub_ftp_with(login_reply, reject_reply, "331 need password")
    }

    /// `user_reply` 可变，是为了钉住「USER 阶段就回 530」这条支路 ——
    /// 有些服务器在用户名上就拒绝，根本走不到 PASS。
    fn spawn_stub_ftp_with(
        login_reply: &'static str,
        reject_reply: &'static str,
        user_reply: &'static str,
    ) -> (std::net::SocketAddr, String, StubLog) {
        use std::net::TcpListener;

        const EXPECTED: &str = "s3cret";

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind");
        let address = listener.local_addr().expect("addr");
        let accepted: StubLog = Arc::new(Mutex::new(Vec::new()));

        let sink = Arc::clone(&accepted);
        std::thread::spawn(move || {
            // **必须循环 accept**：一次探测只用一个连接，而有两个测试会对同一个
            // 假服务端探测两次（先对密码、再错密码）。只 accept 一次的话第二次
            // 直接 connection refused，断言读到的是 Unreachable ——
            // 看起来像「认证分类写错了」，其实压根没走到认证那一步。
            for incoming in listener.incoming() {
                let Ok(socket) = incoming else {
                    break;
                };
                let log = Arc::clone(&sink);
                std::thread::spawn(move || {
                    serve_one_ftp_session(socket, login_reply, reject_reply, user_reply, EXPECTED, log);
                });
            }
        });

        (address, EXPECTED.to_string(), accepted)
    }

    fn serve_one_ftp_session(
        socket: std::net::TcpStream,
        login_reply: &'static str,
        reject_reply: &'static str,
        user_reply: &'static str,
        expected_password: &str,
        sink: StubLog,
    ) {
        use std::io::{BufRead, BufReader, Write};

        let Ok(clone) = socket.try_clone() else {
            return;
        };
        let mut reader = BufReader::new(clone);
        let mut writer = socket;

        let _ = writer.write_all(b"220 test server ready\r\n");

        let mut line = String::new();
        while reader.read_line(&mut line).unwrap_or(0) > 0 {
            let command = line.trim_end().to_string();
            let reply = if command.starts_with("USER") {
                user_reply
            } else if command.starts_with("PASS") {
                if let Ok(mut log) = sink.lock() {
                    log.push(command.clone());
                }
                if command == format!("PASS {expected_password}") {
                    login_reply
                } else {
                    reject_reply
                }
            } else {
                "500 what"
            };
            let _ = writer.write_all(format!("{reply}\r\n").as_bytes());
            let _ = writer.flush();
            line.clear();
        }
    }

    fn commands_seen(log: &StubLog) -> Vec<String> {
        log.lock().map(|entry| entry.clone()).unwrap_or_default()
    }

    // -----------------------------------------------------------------------
    // SSH 标识串预读
    // -----------------------------------------------------------------------

    #[test]
    fn one_foreign_line_alone_does_not_condemn_a_server() {
        // RFC 4253 §4.2 允许 20 行前导文案，所以单独一行非 SSH **不能**判否。
        // 真正判否的是「开口了却始终没报出标识串」——那条由
        // `sftp_against_an_ftp_port_is_reported_as_wrong_protocol` 端到端钉住。
        assert_eq!(
            classify_ssh_banner(b"220 Welcome to my FTP server\r\n"),
            SshBanner::Pending
        );
    }

    #[test]
    fn an_ssh_identifier_is_recognised() {
        assert_eq!(
            classify_ssh_banner(b"SSH-2.0-OpenSSH_9.6\r\n"),
            SshBanner::Identified
        );
        // RFC 4253 允许 SSH-1.99- 的过渡标识串。
        assert_eq!(
            classify_ssh_banner(b"SSH-1.99-Acceptance\r\n"),
            SshBanner::Identified
        );
    }

    #[test]
    fn pre_banner_lines_do_not_condemn_a_real_ssh_server() {
        let mut payload = Vec::new();
        for index in 0..5 {
            payload.extend_from_slice(format!("banner line {index}\r\n").as_bytes());
        }
        payload.extend_from_slice(b"SSH-2.0-OpenSSH_9.6\r\n");

        assert_eq!(classify_ssh_banner(&payload), SshBanner::Identified);
    }

    #[test]
    fn a_server_that_never_stops_babbling_is_not_ssh() {
        // 20 行是 russh 自己的前导行上限；对齐它才不会两处判断打架。
        let payload = "220 nope\r\n".repeat(BANNER_MAX_PRE_LINES + 1);
        assert_eq!(
            classify_ssh_banner(payload.as_bytes()),
            SshBanner::Foreign
        );
    }

    #[test]
    fn an_incomplete_line_stays_pending() {
        // 只拿到半句时不能判否 —— 下一片数据可能正好补上换行。
        assert_eq!(classify_ssh_banner(b"SSH-2.0-Open"), SshBanner::Pending);
        assert_eq!(classify_ssh_banner(b""), SshBanner::Pending);
    }

    #[tokio::test]
    async fn the_pre_read_bytes_are_handed_back_to_the_next_reader() {
        // 没有回放，预读就会把每个 SSH 服务的标识串吃掉 —— 那比原来的
        // 误判更糟。读完整条流，确认字节一个不少、顺序也不变。
        let banner = b"SSH-2.0-OpenSSH_9.6\r\n".to_vec();
        let mut replay = ReplayStream {
            prefix: std::io::Cursor::new(banner.clone()),
            inner: std::io::Cursor::new(b"after-the-banner".to_vec()),
        };

        let mut seen = Vec::new();
        tokio::io::AsyncReadExt::read_to_end(&mut replay, &mut seen)
            .await
            .expect("read replay stream");

        assert!(seen.starts_with(&banner), "回放字节必须排在最前面");
        assert_eq!(seen, {
            let mut expected = banner.clone();
            expected.extend_from_slice(b"after-the-banner");
            expected
        });
    }

    #[tokio::test]
    async fn the_pre_read_survives_a_small_read_buffer() {
        // 预读的字节可能比读取方的缓冲区还长。若只按 buffer.remaining() 截断就返回，
        // 剩余部分会被丢掉 —— 这里逐字节读，逼出那种错误。
        let banner = vec![b'x'; 300];
        let mut replay = ReplayStream {
            prefix: std::io::Cursor::new(banner.clone()),
            inner: std::io::Cursor::new(Vec::new()),
        };

        let mut seen = Vec::new();
        let mut byte = [0_u8; 1];
        loop {
            let taken = tokio::io::AsyncReadExt::read(&mut replay, &mut byte)
                .await
                .expect("read one byte");
            if taken == 0 {
                break;
            }
            seen.push(byte[0]);
        }

        assert_eq!(seen, banner);
    }

    #[tokio::test]
    async fn sftp_against_an_ftp_port_is_reported_as_wrong_protocol() {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind");
        let address = listener.local_addr().expect("addr");

        tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.expect("accept");
            // 一句 FTP 欢迎语，然后按 FTP 的规矩等 USER。
            let _ = socket.write_all(b"220 test server ready\r\n").await;
            let mut sink = Vec::new();
            let _ = tokio::io::AsyncReadExt::read_to_end(&mut socket, &mut sink).await;
        });

        let target = ProbeTarget {
            protocol: RemoteProtocol::Sftp,
            host: "127.0.0.1".to_string(),
            port: address.port(),
            username: "u".to_string(),
            password: Some("p".to_string()),
            proxy: ProxyConfig::Direct,
        };

        let started = std::time::Instant::now();
        let report = probe(&target).await.expect("probe returns a report");

        assert_eq!(report.outcome, ProbeOutcome::WrongProtocol);
        assert!(
            started.elapsed() < PROBE_TIMEOUT,
            "判协议不符必须当场给出结论，不该拖到整体超时"
        );
    }
}
