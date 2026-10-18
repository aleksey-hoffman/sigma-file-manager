// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::remote::error::{RemoteError, RemoteErrorKind};
use base64::Engine;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;
use fast_socks5::client::{Config as Socks5Config, Socks5Stream};
use fast_socks5::{AuthenticationMethod, ReplyError, Socks5Command, SocksError};
use serde::{Deserialize, Serialize};
use std::io;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Duration;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadBuf};
use tokio::net::TcpStream;

/// 连不上目标时等多久。必须有上限 —— 否则一个挂死的代理会把界面卡住。
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

/// HTTP CONNECT 响应头最多读多少字节。超过就判为畸形，不再无限读。
const MAX_HTTP_HEADER_BYTES: usize = 8 * 1024;

/// 代理类型。三种出口对上层看起来一模一样 —— 这是本模块存在的全部理由。
///
/// 刻意不带 `Default`：忘记配代理的代码路径应该在编译期就说不出来。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProxyConfig {
    Direct,
    Socks5 {
        host: String,
        port: u16,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
    HttpConnect {
        host: String,
        port: u16,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
}

impl ProxyConfig {
    fn credentials(&self) -> Option<(&str, &str)> {
        match self {
            Self::Direct => None,
            Self::Socks5 {
                username, password, ..
            }
            | Self::HttpConnect {
                username, password, ..
            } => username.as_deref().zip(password.as_deref()),
        }
    }
}

/// SOCKS5 命令。FTP 被动模式的数据通道必须用 `Bind`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Socks5CommandKind {
    Connect,
    Bind,
}

impl Socks5CommandKind {
    fn to_socks5_command(self) -> Socks5Command {
        match self {
            Self::Connect => Socks5Command::TCPConnect,
            Self::Bind => Socks5Command::TCPBind,
        }
    }
}

/// 拼 HTTP CONNECT 请求。**独立成纯函数**，因为握手是这里最容易出错的部分。
pub fn build_http_connect_request(
    target_host: &str,
    target_port: u16,
    auth: Option<(&str, &str)>,
) -> String {
    let authority = format!("{target_host}:{target_port}");
    let mut request = format!("CONNECT {authority} HTTP/1.1\r\nHost: {authority}\r\n");

    if let Some((username, password)) = auth {
        // 按 UTF-8 编码后再 base64：代理账号允许 Unicode，逐字节截断会产出垃圾
        let credentials = BASE64_STANDARD.encode(format!("{username}:{password}"));
        request.push_str(&format!("Proxy-Authorization: Basic {credentials}\r\n"));
    }

    request.push_str("\r\n");
    request
}

/// 从 HTTP CONNECT 响应判定成功。**必须要求状态行是 2xx**，
/// 不能只判断「收到了响应」—— 407 与 403 也是响应。
pub fn is_http_connect_success(status_line: &str) -> bool {
    let mut parts = status_line.split_whitespace();

    // 版本、状态码、原因短语三段齐全；多余段忽略
    let (Some(version), Some(code), Some(_reason)) = (parts.next(), parts.next(), parts.next()) else {
        return false;
    };

    if !version.starts_with("HTTP/") {
        return false;
    }

    // 状态码必须是**恰好三位**十进制数：`-` 拒绝 `20`、`2xx`、`2000`
    let is_three_digits = code.len() == 3 && code.bytes().all(|byte| byte.is_ascii_digit());
    if !is_three_digits {
        return false;
    }

    matches!(code.parse::<u16>(), Ok(status) if (200..=299).contains(&status))
}

/// SOCKS5 `REP` → `RemoteErrorKind`。`0x00` 返回 `None` —— 它是成功，不是错误，
/// 混进 `Unknown` 会让上层把成功当失败。
pub fn map_socks5_reply_to_kind(rep: u8) -> Option<RemoteErrorKind> {
    match rep {
        0x00 => None,
        0x01 => Some(RemoteErrorKind::Protocol),   // GeneralFailure
        0x02 => Some(RemoteErrorKind::Permission), // ConnectionNotAllowed
        0x03 => Some(RemoteErrorKind::Unreachable), // NetworkUnreachable
        0x04 => Some(RemoteErrorKind::Unreachable), // HostUnreachable
        0x05 => Some(RemoteErrorKind::Unreachable), // ConnectionRefused
        0x06 => Some(RemoteErrorKind::Unreachable), // TtlExpired
        0x07 => Some(RemoteErrorKind::Protocol),   // CommandNotSupported
        0x08 => Some(RemoteErrorKind::Protocol),   // AddressTypeNotSupported
        _ => Some(RemoteErrorKind::Unknown),
    }
}

/// 已建立连接的字节流。三种出口统一成一种，协议层不需要知道走的哪条路。
#[derive(Debug)]
pub enum TransportStream {
    Direct(TcpStream),
    Socks5(Socks5Stream<TcpStream>),
    HttpConnect(TcpStream),
}

/// 三个底层类型都实现了 `Unpin`，所以委托不需要 `pin-project`：`Pin::new` 直接拿到
/// `&mut`。若哪天引入了自引用类型，这里会编译失败并要求改用 pin-project —— 那是对的。
impl AsyncRead for TransportStream {
    fn poll_read(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &mut ReadBuf<'_>,
    ) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Self::Direct(stream) => Pin::new(stream).poll_read(context, buffer),
            Self::Socks5(stream) => Pin::new(stream).poll_read(context, buffer),
            Self::HttpConnect(stream) => Pin::new(stream).poll_read(context, buffer),
        }
    }
}

impl AsyncWrite for TransportStream {
    fn poll_write(
        self: Pin<&mut Self>,
        context: &mut Context<'_>,
        buffer: &[u8],
    ) -> Poll<io::Result<usize>> {
        match self.get_mut() {
            Self::Direct(stream) => Pin::new(stream).poll_write(context, buffer),
            Self::Socks5(stream) => Pin::new(stream).poll_write(context, buffer),
            Self::HttpConnect(stream) => Pin::new(stream).poll_write(context, buffer),
        }
    }

    fn poll_flush(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Self::Direct(stream) => Pin::new(stream).poll_flush(context),
            Self::Socks5(stream) => Pin::new(stream).poll_flush(context),
            Self::HttpConnect(stream) => Pin::new(stream).poll_flush(context),
        }
    }

    fn poll_shutdown(self: Pin<&mut Self>, context: &mut Context<'_>) -> Poll<io::Result<()>> {
        match self.get_mut() {
            Self::Direct(stream) => Pin::new(stream).poll_shutdown(context),
            Self::Socks5(stream) => Pin::new(stream).poll_shutdown(context),
            Self::HttpConnect(stream) => Pin::new(stream).poll_shutdown(context),
        }
    }
}

impl TransportStream {
    /// 拿到底层 socket 的本地地址。
    ///
    /// FTP 被动模式必须用它：客户端通过 BIND 让代理开监听后，需要把**这个地址**交给
    /// FTP 服务器，服务器再反向连回来。没有它就没法在测试里模拟那次反向连接。
    pub fn local_addr(&self) -> io::Result<std::net::SocketAddr> {
        match self {
            Self::Direct(stream) => stream.local_addr(),
            Self::HttpConnect(stream) => stream.local_addr(),
            Self::Socks5(stream) => stream.get_socket_ref().local_addr(),
        }
    }
}

/// 建立一条到 `target_host:target_port` 的字节流。
///
/// **目标地址原样交给代理解析**（SOCKS5 走 `ATYP=0x03` 域名）：本地做 DNS 会泄漏
/// 访问意图，也让很多内网部署失败。代理地址本身才在本地解析。
pub async fn connect(
    proxy: &ProxyConfig,
    target_host: &str,
    target_port: u16,
    command: Socks5CommandKind,
) -> Result<TransportStream, RemoteError> {
    match proxy {
        ProxyConfig::Direct => {
            let stream = connect_tcp(target_host, target_port, "直连目标").await?;
            Ok(TransportStream::Direct(stream))
        }
        ProxyConfig::Socks5 { host, port, .. } => {
            let mut config = Socks5Config::default();
            config.set_connect_timeout(CONNECT_TIMEOUT);

            let auth = match proxy.credentials() {
                Some((username, password)) => Some(AuthenticationMethod::Password {
                    username: username.to_string(),
                    password: password.to_string(),
                }),
                None => Some(AuthenticationMethod::None),
            };

            let stream = Socks5Stream::<TcpStream>::connect_raw(
                command.to_socks5_command(),
                (host.as_str(), *port),
                target_host.to_string(),
                target_port,
                auth,
                config,
            )
            .await
            .map_err(map_socks_error)?;

            Ok(TransportStream::Socks5(stream))
        }
        ProxyConfig::HttpConnect { host, port, .. } => {
            let stream = http_connect_tunnel(host, *port, target_host, target_port, proxy).await?;
            Ok(TransportStream::HttpConnect(stream))
        }
    }
}

async fn connect_tcp(host: &str, port: u16, context: &str) -> Result<TcpStream, RemoteError> {
    match tokio::time::timeout(CONNECT_TIMEOUT, TcpStream::connect((host, port))).await {
        Ok(Ok(stream)) => Ok(stream),
        Ok(Err(error)) => Err(map_io_error(context, &error)),
        Err(_) => Err(RemoteError::unreachable(format!(
            "{context}超时（{CONNECT_TIMEOUT:?}）：{host}:{port}"
        ))),
    }
}

async fn http_connect_tunnel(
    proxy_host: &str,
    proxy_port: u16,
    target_host: &str,
    target_port: u16,
    proxy: &ProxyConfig,
) -> Result<TcpStream, RemoteError> {
    let mut stream = connect_tcp(proxy_host, proxy_port, "连接 HTTP 代理").await?;

    let request = build_http_connect_request(
        target_host,
        target_port,
        proxy
            .credentials()
            .map(|(username, password)| (username, password)),
    );

    stream
        .write_all(request.as_bytes())
        .await
        .map_err(|error| map_io_error("发送 CONNECT 请求", &error))?;
    stream
        .flush()
        .await
        .map_err(|error| map_io_error("发送 CONNECT 请求", &error))?;

    let status_line = read_http_status_line(&mut stream).await?;
    if !is_http_connect_success(&status_line) {
        return Err(RemoteError::new(
            RemoteErrorKind::Permission,
            format!("HTTP 代理拒绝 CONNECT：{status_line}"),
        ));
    }

    Ok(stream)
}

async fn read_http_status_line(stream: &mut TcpStream) -> Result<String, RemoteError> {
    let mut received: Vec<u8> = Vec::with_capacity(256);
    let mut byte = [0_u8; 1];

    loop {
        let read = stream
            .read(&mut byte)
            .await
            .map_err(|error| map_io_error("读取 CONNECT 响应", &error))?;

        if read == 0 {
            return Err(RemoteError::disconnected(
                "HTTP 代理在 CONNECT 响应中途关闭了连接",
            ));
        }

        received.push(byte[0]);
        if received.len() > MAX_HTTP_HEADER_BYTES {
            return Err(RemoteError::protocol(
                "HTTP 代理的 CONNECT 响应头过大，疑似不是 HTTP 代理",
            ));
        }

        // 头部以 \r\n\r\n 结束
        if received.ends_with(b"\r\n\r\n") {
            break;
        }
    }

    let text = String::from_utf8_lossy(&received);
    let status_line = text
        .lines()
        .next()
        .unwrap_or_default()
        .trim_end_matches('\r')
        .to_string();

    if status_line.is_empty() {
        return Err(RemoteError::protocol("HTTP 代理返回了空响应"));
    }

    Ok(status_line)
}

fn map_io_error(context: &str, error: &io::Error) -> RemoteError {
    let kind = match error.kind() {
        io::ErrorKind::ConnectionRefused
        | io::ErrorKind::ConnectionReset
        | io::ErrorKind::ConnectionAborted
        | io::ErrorKind::NotConnected
        | io::ErrorKind::AddrNotAvailable
        | io::ErrorKind::HostUnreachable
        | io::ErrorKind::NetworkUnreachable
        | io::ErrorKind::TimedOut => RemoteErrorKind::Unreachable,
        io::ErrorKind::PermissionDenied => RemoteErrorKind::Permission,
        io::ErrorKind::NotFound => RemoteErrorKind::NotFound,
        _ => RemoteErrorKind::Unknown,
    };

    RemoteError::new(kind, format!("{context}失败：{error}"))
}

fn map_socks_error(error: SocksError) -> RemoteError {
    let kind = match &error {
        // 代理明确拒绝了凭据 —— 用户该去改代理账号，不是去改目标服务器
        SocksError::AuthenticationRejected(_) => RemoteErrorKind::Auth,
        SocksError::AuthMethodUnacceptable(_)
        | SocksError::UnsupportedSocksVersion(_)
        | SocksError::InvalidHeader { .. }
        | SocksError::ExceededMaxDomainLen(_)
        | SocksError::ArgumentInputError(_)
        | SocksError::AddrError(_)
        | SocksError::ServerError(_)
        | SocksError::UdpHeaderError(_) => RemoteErrorKind::Protocol,
        // 连代理本身就没连上
        SocksError::ConnectError(_) | SocksError::Io(_) => {
            match map_io_error_kind(&error) {
                Some(kind) => kind,
                None => RemoteErrorKind::Unreachable,
            }
        }
        SocksError::ReplyError(reply) => {
            return match map_reply_error(*reply) {
                Some(kind) => RemoteError::new(kind, format!("SOCKS5 代理拒绝请求：{reply}")),
                None => RemoteError::protocol(format!("SOCKS5 代理返回了矛盾的结果：{reply}")),
            };
        }
        _ => RemoteErrorKind::Unknown,
    };

    RemoteError::new(kind, format!("SOCKS5 代理错误：{error}"))
}

/// `ConnectionTimeout` 与 `TtlExpired` 是 `fast-socks5` 在 RFC 1928 八个码之外的扩展，
/// 数值码未公开。**按变体名分类，不猜数字** —— 猜错会把「超时」报成「命令不支持」。
fn map_reply_error(reply: ReplyError) -> Option<RemoteErrorKind> {
    match reply {
        ReplyError::Succeeded => None,
        ReplyError::ConnectionTimeout | ReplyError::TtlExpired => Some(RemoteErrorKind::Unreachable),
        other => {
            let rep = match other {
                ReplyError::GeneralFailure => 0x01,
                ReplyError::ConnectionNotAllowed => 0x02,
                ReplyError::NetworkUnreachable => 0x03,
                ReplyError::HostUnreachable => 0x04,
                ReplyError::ConnectionRefused => 0x05,
                ReplyError::CommandNotSupported => 0x07,
                ReplyError::AddressTypeNotSupported => 0x08,
                ReplyError::Succeeded
                | ReplyError::ConnectionTimeout
                | ReplyError::TtlExpired => return None,
            };
            map_socks5_reply_to_kind(rep)
        }
    }
}

/// `SocksError::Io` 与 `ConnectError` 内嵌的 io 错误要按 `ErrorKind` 再分一次，
/// 否则「代理拒绝连接」会被笼统报成 Unknown。
fn map_io_error_kind(error: &SocksError) -> Option<RemoteErrorKind> {
    let io_error = match error {
        SocksError::Io(io_error) => Some(io_error),
        SocksError::ConnectError(connect_error) => {
            let source: &dyn std::error::Error = connect_error;
            source.downcast_ref::<io::Error>()
        }
        _ => None,
    }?;

    Some(match io_error.kind() {
        io::ErrorKind::PermissionDenied => RemoteErrorKind::Permission,
        io::ErrorKind::NotFound => RemoteErrorKind::NotFound,
        io::ErrorKind::ConnectionRefused
        | io::ErrorKind::ConnectionReset
        | io::ErrorKind::ConnectionAborted
        | io::ErrorKind::NotConnected
        | io::ErrorKind::AddrNotAvailable
        | io::ErrorKind::HostUnreachable
        | io::ErrorKind::NetworkUnreachable
        | io::ErrorKind::TimedOut => RemoteErrorKind::Unreachable,
        _ => RemoteErrorKind::Unknown,
    })
}

#[cfg(test)]
mod socket_fixtures {
    //! 测试用假服务器。
    //!
    //! **为什么不用 `fast-socks5` 自带的 server 模块当夹具**：它的 `Socks5Server`
    //! 从 0.11.0 起已标记 `#[deprecated]`，替代的 `Socks5ServerProtocol` typestate
    //! API 只暴露 `run_tcp_proxy`，**没有 BIND 的服务端路径** —— 而 BIND 恰恰是
    //! FTP 被动模式最需要测的一环。夹具因此自己写，且只存在于测试里。

    use super::*;
    use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr};
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    pub struct FakeServer {
        pub addr: SocketAddr,
    }

    /// BIND 时代理侧实际开的监听地址。
    ///
    /// 客户端拿不到这个值（`connect_raw` 不把 BND.ADDR 交出来），而**这正是 BIND 的语义**：
    /// 代理回报一个地址，FTP 服务器再去连它。所以只能由夹具把它记下来给测试断言。
    #[derive(Clone, Default)]
    pub struct BoundAddress(pub std::sync::Arc<std::sync::Mutex<Option<SocketAddr>>>);

    impl BoundAddress {
        pub async fn wait_for(&self) -> SocketAddr {
            for _ in 0..200 {
                if let Some(address) = *self.0.lock().expect("bound address lock") {
                    return address;
                }
                tokio::time::sleep(std::time::Duration::from_millis(10)).await;
            }
            panic!("代理在 2 秒内没有回报 BIND 监听地址");
        }
    }

    /// 目标端 echo 服务：收到什么原样吐回什么。
    pub async fn spawn_echo_server() -> SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind echo");
        let addr = listener.local_addr().expect("echo local addr");

        tokio::spawn(async move {
            while let Ok((mut stream, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut buffer = [0_u8; 1024];
                    loop {
                        match stream.read(&mut buffer).await {
                            Ok(0) | Err(_) => break,
                            Ok(read) => {
                                if stream.write_all(&buffer[..read]).await.is_err() {
                                    break;
                                }
                            }
                        }
                    }
                });
            }
        });

        addr
    }

    /// 最小 SOCKS5 服务端。支持 CONNECT、BIND、用户名密码认证，以及「按需拒绝」。
    pub async fn spawn_socks5_server(
        auth: Option<(String, String)>,
        reject_reply: u8,
    ) -> (FakeServer, BoundAddress) {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind socks5");
        let addr = listener.local_addr().expect("socks5 local addr");
        let bound_address = BoundAddress::default();

        tokio::spawn({
            let bound_address = bound_address.clone();
            async move {
                while let Ok((stream, _)) = listener.accept().await {
                    let auth = auth.clone();
                    let bound_address = bound_address.clone();
                    tokio::spawn(async move {
                        let _ = handle_socks5(stream, auth, reject_reply, bound_address).await;
                    });
                }
            }
        });

        (FakeServer { addr }, bound_address)
    }

    async fn handle_socks5(
        mut socket: TcpStream,
        auth: Option<(String, String)>,
        reject_reply: u8,
        bound_address: BoundAddress,
    ) -> io::Result<()> {
        // 握手：VER NMETHODS METHODS...
        let mut greeting = [0_u8; 2];
        socket.read_exact(&mut greeting).await?;
        let mut methods = vec![0_u8; greeting[1] as usize];
        socket.read_exact(&mut methods).await?;

        match auth {
            Some((username, password)) => {
                socket.write_all(&[0x05, 0x02]).await?;

                let mut version = [0_u8; 2];
                socket.read_exact(&mut version).await?;
                let mut name = vec![0_u8; version[1] as usize];
                socket.read_exact(&mut name).await?;
                let mut secret_length = [0_u8; 1];
                socket.read_exact(&mut secret_length).await?;
                let mut secret = vec![0_u8; secret_length[0] as usize];
                socket.read_exact(&mut secret).await?;

                let accepted =
                    String::from_utf8_lossy(&name) == username && String::from_utf8_lossy(&secret) == password;
                socket
                    .write_all(&[0x01, if accepted { 0x00 } else { 0x01 }])
                    .await?;
                if !accepted {
                    return Ok(());
                }
            }
            None => {
                socket.write_all(&[0x05, 0x00]).await?;
            }
        }

        // 请求：VER CMD RSV ATYP ADDR PORT
        let mut request = [0_u8; 4];
        socket.read_exact(&mut request).await?;
        let command = request[1];
        let host = read_target(&mut socket, request[3]).await?;

        let mut port_bytes = [0_u8; 2];
        socket.read_exact(&mut port_bytes).await?;
        let port = u16::from_be_bytes(port_bytes);

        if reject_reply != 0 {
            return reply(&mut socket, reject_reply, "0.0.0.0", 0).await;
        }

        if command == 0x02 {
            // BIND：请代理侧开监听，把地址回传，然后等 FTP 服务器反向连回来
            let bound = TcpListener::bind("127.0.0.1:0").await?;
            let bound_addr = bound.local_addr()?;
            reply(&mut socket, 0x00, &bound_addr.ip().to_string(), bound_addr.port()).await?;
            *bound_address.0.lock().expect("bound address lock") = Some(bound_addr);

            let (mut inbound, _) = bound.accept().await?;

            // 这里只验证两件事：回报的监听地址真的可连、连上后通道双向可用。
            // 完整的三方中继（inbound 同时对接 FTP 服务器与 FTP 数据源）属于 FTP 阶段，
            // 不在传输层职责范围内。第一版误写了三方中继，又因为 borrow checker
            // 不允许 `join!` 里两次可变借用 inbound 而挂起 —— 比断言失败更难查。
            let _ = tokio::io::copy_bidirectional(&mut socket, &mut inbound).await;
            return Ok(());
        }

        let mut outbound = TcpStream::connect((host.as_str(), port)).await?;
        reply(&mut socket, 0x00, "0.0.0.0", 0).await?;
        tokio::io::copy_bidirectional(&mut socket, &mut outbound)
            .await
            .map(|_| ())
    }

    async fn reply(
        socket: &mut TcpStream,
        rep: u8,
        address: &str,
        port: u16,
    ) -> io::Result<()> {
        let mut response = vec![0x05, rep, 0x00];

        match address.parse::<IpAddr>() {
            Ok(IpAddr::V4(v4)) => {
                response.push(0x01);
                response.extend_from_slice(&v4.octets());
            }
            Ok(IpAddr::V6(v6)) => {
                response.push(0x04);
                response.extend_from_slice(&v6.octets());
            }
            Err(_) => {
                response.push(0x01);
                response.extend_from_slice(&[0, 0, 0, 0]);
            }
        }

        response.extend_from_slice(&port.to_be_bytes());
        socket.write_all(&response).await
    }

    async fn read_target(socket: &mut TcpStream, address_type: u8) -> io::Result<String> {
        match address_type {
            0x01 => {
                let mut bytes = [0_u8; 4];
                socket.read_exact(&mut bytes).await?;
                Ok(Ipv4Addr::from(bytes).to_string())
            }
            0x03 => {
                let mut length = [0_u8; 1];
                socket.read_exact(&mut length).await?;
                let mut bytes = vec![0_u8; length[0] as usize];
                socket.read_exact(&mut bytes).await?;
                Ok(String::from_utf8_lossy(&bytes).into_owned())
            }
            0x04 => {
                let mut bytes = [0_u8; 16];
                socket.read_exact(&mut bytes).await?;
                Ok(Ipv6Addr::from(bytes).to_string())
            }
            other => Err(io::Error::new(
                io::ErrorKind::InvalidData,
                format!("未知 ATYP: {other}"),
            )),
        }
    }

    /// 最小 HTTP CONNECT 代理。`accept` 为真时回 200 并转发，否则回 `reject_status`。
    pub async fn spawn_http_connect_proxy(accept: bool, reject_status: &'static str) -> FakeServer {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind http proxy");
        let addr = listener.local_addr().expect("http proxy local addr");

        tokio::spawn(async move {
            while let Ok((mut socket, _)) = listener.accept().await {
                tokio::spawn(async move {
                    let mut received = Vec::new();
                    let mut byte = [0_u8; 1];
                    loop {
                        match socket.read(&mut byte).await {
                            Ok(0) | Err(_) => return,
                            Ok(_) => received.push(byte[0]),
                        }
                        if received.ends_with(b"\r\n\r\n") {
                            break;
                        }
                    }

                    if !accept {
                        let _ = socket
                            .write_all(format!("{reject_status}\r\nContent-Length: 0\r\n\r\n").as_bytes())
                            .await;
                        return;
                    }

                    if socket
                        .write_all(b"HTTP/1.1 200 Connection established\r\n\r\n")
                        .await
                        .is_err()
                    {
                        return;
                    }

                    let request = String::from_utf8_lossy(&received).into_owned();
                    let Some(authority) = request.split_whitespace().nth(1) else {
                        return;
                    };
                    let Some((host, port)) = authority.rsplit_once(':') else {
                        return;
                    };
                    let Ok(port) = port.parse::<u16>() else {
                        return;
                    };
                    if let Ok(mut outbound) = TcpStream::connect((host, port)).await {
                        let _ = tokio::io::copy_bidirectional(&mut socket, &mut outbound).await;
                    }
                });
            }
        });

        FakeServer { addr }
    }

    /// 一个确定连不上的地址：绑定后立刻 drop，端口几乎肯定没有监听者。
    pub async fn unused_port() -> u16 {
        let listener = TcpListener::bind("127.0.0.1:0").await.expect("bind probe");
        let port = listener.local_addr().expect("probe addr").port();
        drop(listener);
        port
    }
}

#[cfg(test)]
mod connect_tests {
    use super::socket_fixtures::*;
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};

    async fn round_trip(mut stream: TransportStream, payload: &[u8]) {
        stream
            .write_all(payload)
            .await
            .expect("write through transport");
        stream.flush().await.expect("flush");

        let mut buffer = vec![0_u8; payload.len()];
        stream
            .read_exact(&mut buffer)
            .await
            .expect("read through transport");
        assert_eq!(buffer, payload);
    }

    #[tokio::test]
    async fn direct_transport_reaches_the_target() {
        let echo = spawn_echo_server().await;
        let stream = connect(&ProxyConfig::Direct, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect("direct connect");

        round_trip(stream, b"hello direct").await;
    }

    #[tokio::test]
    async fn socks5_transport_reaches_the_target_without_auth() {
        let echo = spawn_echo_server().await;
        let (proxy, _bound_address) = spawn_socks5_server(None, 0).await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: None,
            password: None,
        };

        let stream = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect("socks5 connect");

        round_trip(stream, b"hello socks5").await;
    }

    #[tokio::test]
    async fn socks5_transport_reaches_the_target_with_username_password() {
        let echo = spawn_echo_server().await;
        let (proxy, _bound_address) = spawn_socks5_server(Some(("user".into(), "pass".into())), 0).await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: Some("user".to_string()),
            password: Some("pass".to_string()),
        };

        let stream = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect("socks5 connect with auth");

        round_trip(stream, b"hello auth").await;
    }

    #[tokio::test]
    async fn socks5_bind_lets_the_peer_connect_back() {
        let echo = spawn_echo_server().await;
        let (proxy, bound_address) = spawn_socks5_server(None, 0).await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: None,
            password: None,
        };

        let mut stream = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Bind)
            .await
            .expect("socks5 bind");

        // BIND 的语义是「代理回报一个地址，FTP 服务器再去连它」——
        // 那个地址是代理开的监听端口，**不是**客户端 socket 的本地地址。
        // 连后者必然 ConnectionRefused，这是第一次写这条测试时踩的坑。
        let advertised = bound_address.wait_for().await;
        assert_ne!(advertised, stream.local_addr().expect("local addr"));

        let mut callback = TcpStream::connect(advertised)
            .await
            .expect("callback connect");
        callback.write_all(b"hello bind").await.expect("callback write");

        let mut buffer = [0_u8; 10];
        stream.read_exact(&mut buffer).await.expect("read through bind");
        assert_eq!(&buffer, b"hello bind");

        // 回写回去，确认这条通道真的是双向的
        stream.write_all(b"pong").await.expect("write back");
        let mut echoed = [0_u8; 4];
        callback.read_exact(&mut echoed).await.expect("callback read");
        assert_eq!(&echoed, b"pong");
    }

    #[tokio::test]
    async fn socks5_bad_credentials_are_reported_as_auth_not_unknown() {
        let echo = spawn_echo_server().await;
        let (proxy, _bound_address) = spawn_socks5_server(Some(("user".into(), "pass".into())), 0).await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: Some("user".to_string()),
            password: Some("wrong".to_string()),
        };

        let error = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect_err("wrong password must fail");

        assert_eq!(error.kind, RemoteErrorKind::Auth);
    }

    #[tokio::test]
    async fn socks5_rule_refusal_is_reported_as_permission() {
        let echo = spawn_echo_server().await;
        // REP=0x02 ConnectionNotAllowed
        let (proxy, _bound_address) = spawn_socks5_server(None, 0x02).await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: None,
            password: None,
        };

        let error = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect_err("refused request must fail");

        assert_eq!(error.kind, RemoteErrorKind::Permission);
    }

    #[tokio::test]
    async fn unreachable_proxy_is_reported_as_unreachable() {
        let port = unused_port().await;
        let config = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port,
            username: None,
            password: None,
        };

        let error = connect(&config, "example.com", 21, Socks5CommandKind::Connect)
            .await
            .expect_err("unreachable proxy must fail");

        assert_eq!(error.kind, RemoteErrorKind::Unreachable);
    }

    #[tokio::test]
    async fn http_connect_tunnel_reaches_the_target() {
        let echo = spawn_echo_server().await;
        let proxy = spawn_http_connect_proxy(true, "HTTP/1.1 403 Forbidden").await;
        let config = ProxyConfig::HttpConnect {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: None,
            password: None,
        };

        let stream = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect("http connect");

        round_trip(stream, b"hello http").await;
    }

    #[tokio::test]
    async fn http_connect_rejection_is_reported_as_permission() {
        let echo = spawn_echo_server().await;
        let proxy = spawn_http_connect_proxy(false, "HTTP/1.1 403 Forbidden").await;
        let config = ProxyConfig::HttpConnect {
            host: "127.0.0.1".to_string(),
            port: proxy.addr.port(),
            username: None,
            password: None,
        };

        let error = connect(&config, "127.0.0.1", echo.port(), Socks5CommandKind::Connect)
            .await
            .expect_err("rejected CONNECT must fail");

        assert_eq!(error.kind, RemoteErrorKind::Permission);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::error::RemoteErrorKind;

    #[test]
    fn builds_http_connect_request_without_auth() {
        let request = build_http_connect_request("example.com", 21, None);

        assert_eq!(
            request,
            "CONNECT example.com:21 HTTP/1.1\r\nHost: example.com:21\r\n\r\n"
        );
    }

    #[test]
    fn builds_http_connect_request_with_basic_auth() {
        let request = build_http_connect_request("proxy.internal", 8080, Some(("user", "pass")));

        assert_eq!(
            request,
            "CONNECT proxy.internal:8080 HTTP/1.1\r\n\
             Host: proxy.internal:8080\r\n\
             Proxy-Authorization: Basic dXNlcjpwYXNz\r\n\r\n"
        );
    }

    #[test]
    fn builds_http_connect_request_with_non_ascii_credentials() {
        // 代理账号密码允许 Unicode，必须按 UTF-8 编码后再 base64，不能逐字节截断
        let request = build_http_connect_request("h", 1, Some(("用户", "密码")));

        assert!(request.contains("Proxy-Authorization: Basic "));
        assert!(!request.contains("Proxy-Authorization: Basic \r"));
    }

    #[test]
    fn accepts_any_2xx_connect_response() {
        assert!(is_http_connect_success("HTTP/1.1 200 Connection established"));
        assert!(is_http_connect_success("HTTP/1.0 200 Connection established"));
        assert!(is_http_connect_success("HTTP/1.1 204 No Content"));
    }

    #[test]
    fn rejects_non_2xx_connect_response() {
        assert!(!is_http_connect_success("HTTP/1.1 407 Proxy Authentication Required"));
        assert!(!is_http_connect_success("HTTP/1.1 403 Forbidden"));
        assert!(!is_http_connect_success("HTTP/1.1 404 Not Found"));
        assert!(!is_http_connect_success("HTTP/1.1 500 Internal Server Error"));
    }

    #[test]
    fn rejects_malformed_status_lines_instead_of_guessing() {
        // 「收到了响应」不等于「握手成功」。这些都不能被当成成功。
        assert!(!is_http_connect_success(""));
        assert!(!is_http_connect_success("garbage"));
        assert!(!is_http_connect_success("200 Connection established"));
        assert!(!is_http_connect_success("HTTP/1.1 20 OK"));
        assert!(!is_http_connect_success("HTTP/1.1 2000 Too Many Digits"));
        assert!(!is_http_connect_success("HTTP/1.1 2xx"));
    }

    #[test]
    fn tolerates_extra_whitespace_around_a_real_2xx() {
        // 这里刻意宽松：`split_whitespace` 会折叠连续空白，所以双空格与首尾空白都能通过。
        // 宽松是安全的 —— 状态码仍然是 2xx，不可能把 407/403 误判成成功。
        // 要守的性质是「非 2xx 绝不放行」，不是「逐字节比对」。
        assert!(is_http_connect_success("HTTP/1.1  200 Connection established"));
        assert!(is_http_connect_success("  HTTP/1.1 200 Connection established  "));
        // 但状态码本身不能有歧义
        assert!(!is_http_connect_success("HTTP/1.1  4 07 Proxy Authentication Required"));
    }

    #[test]
    fn maps_socks5_reply_codes_per_rfc1928() {
        assert_eq!(map_socks5_reply_to_kind(0x01), Some(RemoteErrorKind::Protocol));
        assert_eq!(map_socks5_reply_to_kind(0x02), Some(RemoteErrorKind::Permission));
        assert_eq!(map_socks5_reply_to_kind(0x03), Some(RemoteErrorKind::Unreachable));
        assert_eq!(map_socks5_reply_to_kind(0x04), Some(RemoteErrorKind::Unreachable));
        assert_eq!(map_socks5_reply_to_kind(0x05), Some(RemoteErrorKind::Unreachable));
        assert_eq!(map_socks5_reply_to_kind(0x06), Some(RemoteErrorKind::Unreachable));
        assert_eq!(map_socks5_reply_to_kind(0x07), Some(RemoteErrorKind::Protocol));
        assert_eq!(map_socks5_reply_to_kind(0x08), Some(RemoteErrorKind::Protocol));
    }

    #[test]
    fn treats_socks5_success_and_unknown_codes_distinctly() {
        // 0x00 不是错误，必须与「无法归类」区分开，否则上层会把成功当失败
        assert_eq!(map_socks5_reply_to_kind(0x00), None);
        assert_eq!(map_socks5_reply_to_kind(0xFF), Some(RemoteErrorKind::Unknown));
    }

    #[test]
    fn proxy_config_round_trips_through_json() {
        let direct = ProxyConfig::Direct;
        let socks = ProxyConfig::Socks5 {
            host: "127.0.0.1".to_string(),
            port: 1080,
            username: Some("u".to_string()),
            password: Some("p".to_string()),
        };

        assert_eq!(serde_json::to_string(&direct).expect("serialize"), r#"{"kind":"direct"}"#);
        assert_eq!(
            serde_json::to_string(&socks).expect("serialize"),
            r#"{"kind":"socks5","host":"127.0.0.1","port":1080,"username":"u","password":"p"}"#
        );
        assert_eq!(
            serde_json::from_str::<ProxyConfig>(r#"{"kind":"direct"}"#).expect("deserialize"),
            direct
        );
        assert_eq!(
            serde_json::from_str::<ProxyConfig>(
                r#"{"kind":"socks5","host":"h","port":1080}"#
            )
            .expect("deserialize"),
            ProxyConfig::Socks5 {
                host: "h".to_string(),
                port: 1080,
                username: None,
                password: None,
            }
        );
    }
}
