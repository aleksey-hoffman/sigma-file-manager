// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! FTP 远程目录的读取。
//!
//! # 红线
//!
//! 本文件被 `cargo test --lib` 的测试二进制链接，**不得出现 `tauri::AppHandle`、
//! `tauri::async_runtime::*` 或 `tauri::` 的任何路径**。两个目录从 [`Path`] 进来，
//! 由 `commands.rs`（唯一允许碰 tauri 的适配层）解析。
//!
//! # 为什么不用 `suppaftp`
//!
//! 它的 `connect_with_stream` 收 `T: TokioTlsStream`（即 `tokio::net::TcpStream`），
//! **绑死 TCP、走不了代理**。用它会让 FTP 测出与实际使用不同的路径 ——
//! 而「测的那条路」正是我们声称支持的那条。
//!
//! # 数据通道：为什么是 `EPSV → Connect`，不是规格里写的 `BIND`
//!
//! 规格 §3.6 写「SOCKS5 + FTP 走 BIND，客户端请代理开监听、通过 `PORT`/`EPRT`
//! 告诉服务器反向连回来」，**同一节的最后一行又写「主动模式（`PORT`）在 NAT 与
//! 代理下基本不可用，代理场景下只支持被动模式」**。这两句互相矛盾。
//!
//! 把它们拆开看：`BIND` 是 SOCKS5 的 **CMD=0x02**，语义是「让代理在**代理侧**开一个
//! 监听端口并把地址返回给我」，它服务的必然是 FTP 的**主动模式** —— 客户端听、
//! 服务器连回来。所以规格第一句描述的其实是主动模式，被第二句否掉了。
//!
//! 而**被动模式过 SOCKS5 根本不需要 BIND**：`EPSV` 拿到端口后，客户端请代理
//! `CONNECT` 到「服务器:数据端口」即可，代理只是转发字节。这条路在远程代理下可用，
//! 不要求服务器能反向连回代理。因此本实现统一走被动模式，数据通道用
//! [`Socks5CommandKind::Connect`]。
//!
//! 附带纠正规格里另一处：HTTP CONNECT **是**能干净支持 FTP 被动模式的 ——
//! 它把 CONNECT 之后的字节原样隧道转发，与直接 TCP 等价。规格说
//! 「HTTP 代理没有 BIND，无法支持远程代理下的被动模式」，混淆了被动与主动。
//! 本实现对 HTTP CONNECT 走同一条被动路径，而不是按规格报「不支持」。
//!
//! # MLSD 与 LIST
//!
//! `MLSD`（RFC 3659）给的是事实列，机器可读且无歧义；`LIST` 给的是 `ls -l` 风格，
//! 只在 `MLSD` 不被支持时用。先 `MLSD` 后 `LIST` 的顺序不能反 —— 反过来的话
//! 会优先用更脆弱的那一种。

use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::Duration;

use async_trait::async_trait;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

use super::connection_test::{decode, read_reply, send_command};
use super::error::{RemoteError, RemoteErrorKind};
use super::ftp_parsing::{parse_epsv_port, parse_list_line, parse_mlsd_line, parse_pasv_endpoint};
use super::path::build_remote_path;
use super::provider::{RemoteEntry, RemoteProvider, REMOTE_WRITE_CHUNK_BYTES};
use super::registry::ResolvedConnection;
use super::sftp_provider::{is_hidden_remote_name, SFTP_OPERATION_TIMEOUT};
use super::transport::{self, ProxyConfig, Socks5CommandKind, TransportStream};

/// 一次远程列目录的总体上限。与 SFTP 共用同一个常量：
/// 两者的用户体感应当一致，不该「FTP 慢一点是正常的」这种偏袒写进超时里。
pub const FTP_OPERATION_TIMEOUT: Duration = SFTP_OPERATION_TIMEOUT;

/// 数据通道上最多读的字节数。
///
/// `MLSD`/`LIST` 的输出理论上与目录项数成正比，但一个**损坏的**或恶意的服务器
/// 可以无限发。没有上限的话，那台服务器能把内存吃光；而超限的表现是
/// 「这个目录太多了」这样一个用户能理解的错误，不是进程崩掉。
const MAX_LISTING_BYTES: usize = 32 * 1024 * 1024;

/// FTP 回复码 → 本项目的错误分类。
///
/// 规格 §6.3 要求区分「没有权限」与「路径不存在」。FTP 上这两者**常常同码**：
/// `550` 既可能是「没有那个目录」，也可能是「你没权限」。这里选 `NotFound`，
/// 因为界面里两条路径的表现更接近（都表现为「这里进不去」），
/// 而选 `Permission` 会让用户去检查一个根本没配过的权限。
pub fn map_ftp_reply_code(code: u16, text: &str) -> RemoteError {
    match code {
        // 421 = 服务端关闭控制连接，这是真的断开了。
        421 => RemoteError::disconnected(format!("服务器关闭了连接：{text}")),
        530 => RemoteError::auth(format!("服务器拒绝了登录：{text}")),
        550 => RemoteError::not_found(format!("服务器说这个路径不可用：{text}")),
        // 5xx 的其余码（500/501/502/504/522）都是「命令层面失败」。
        500..=599 => RemoteError::protocol(format!("服务器拒绝了这条命令：{text}")),
        _ => RemoteError::protocol(format!("服务器回了预期之外的回复 {code}：{text}")),
    }
}

/// 远端路径里出现了控制字符就**不能**拼进 FTP 命令。
///
/// FTP 的控制通道是行文本协议：一条命令以 `\r\n` 结束。所以一个含 `\r\n` 的
/// 路径就不是「一条路径」，而是「两条命令」——
/// `normalize_remote_path` 只挡 `.` / `..`，不挡控制字符，
/// 而路径来自前端（用户在地址栏能敲出 `\r`）。
///
/// 这不是理论问题：它意味着用户可以让服务器去执行第二条命令。
/// 于是所有要拼进命令的路径都必须先过这道闸。
pub fn contains_control_characters(value: &str) -> bool {
    value.chars().any(|character| character.is_control())
}

/// 检查一条「必须是这个码」的回复。
///
/// FTP 的多行回复（`250-` 开头、末行 `250 `）在本实现用到的命令上不会出现，
/// 所以 [`read_reply`] 读一行就够 —— 与 `connection_test.rs` 的既有做法一致。
async fn expect_reply<S>(
    stream: &mut S,
    buffer: &mut Vec<u8>,
    command: &str,
    accepted: &[u16],
) -> Result<String, RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin,
{
    send_command(stream, command).await?;
    read_reply(stream, buffer).await?;
    let text = decode(buffer);

    let code = super::connection_test::parse_ftp_reply_code(&text)
        .ok_or_else(|| RemoteError::protocol(format!("无法识别的 FTP 回复：{text}")))?;

    if accepted.contains(&code) {
        return Ok(text);
    }

    Err(map_ftp_reply_code(code, &text))
}

/// FTP 控制通道。
///
/// 不是 `struct` 上再放一堆方法，而是**持有全部状态**，好让
/// [`open_data_channel`](Self::open_data_channel) 同时看到控制连接与数据连接所需的上下文。
///
/// **泛型是为了让 FTPS 直接复用**：`ftps_provider.rs` 把同一条控制通道包在
/// TLS 里跑，协议部分一个字都不用重写。复制一份的后果是明文 FTP 修好了、
/// FTPS 还留着同一个 bug —— 而这两个 bug 用户会分别遇到。
pub(crate) struct FtpControl<S> {
    stream: S,
    /// **控制连接**的主机名。数据通道用它，而不是 `PASV` 回复里的地址。
    host: String,
    proxy: ProxyConfig,
    buffer: Vec<u8>,
}

/// `PASV` 回复里的 IP 该不该用。
///
/// RFC 2577 §3 明确说：**始终用控制连接的主机**，忽略 `PASV` 里的地址。
/// 现实中确有服务器在这里回内网地址或 `0.0.0.0`（NAT 后的标配），
/// 照着连会失败或连到一台不相干的主机上。所以这里永远返回控制连接的 host。
///
/// 单独抽成函数是为了让这一条能被一条断言钉住 —— 它不是一个「显然成立」的判断：
/// 形式上解析出来的地址被丢弃，正是有人会疑惑的地方。
pub fn pasv_host_to_use(_advertised: std::net::IpAddr, control_host: &str) -> String {
    control_host.to_string()
}

impl<S> FtpControl<S>
where
    S: AsyncReadWrite + Unpin + Send,
{
    /// 发一条命令并要求回复落在 `accepted` 里。
    pub(crate) async fn command(&mut self, command: &str, accepted: &[u16]) -> Result<String, RemoteError> {
        if contains_control_characters(command) {
            // 走到这里说明有人绕过 [`Self::command`] 直接调了 `send_command`，
            // 或者将来新增了一条拼路径的命令没过 [`contains_control_characters`]。
            // 拦在这里而不是信任每个调用点，是为了让这道闸**无法被绕过**。
            return Err(RemoteError::protocol(
                "FTP 命令里出现了控制字符，已拒绝发送",
            ));
        }

        expect_reply(&mut self.stream, &mut self.buffer, command, accepted).await
    }

    /// 读欢迎语。
    ///
    /// 刻意**不发任何命令**：很多服务器在欢迎语之前对空命令回 `500`，
    /// 用「发一个空行去读回复」当欢迎语会把正常服务误判成不兼容。
    pub(crate) async fn read_greeting(&mut self) -> Result<String, RemoteError> {
        read_reply(&mut self.stream, &mut self.buffer).await?;
        let text = decode(&self.buffer);

        let code = super::connection_test::parse_ftp_reply_code(&text).ok_or_else(|| {
            RemoteError::protocol(format!(
                "对端不是 FTP 服务 —— 欢迎语不像 FTP 回复：{text}"
            ))
        })?;

        if code != 220 {
            return Err(map_ftp_reply_code(code, &text));
        }

        Ok(text)
    }

    /// 打开数据通道。
    ///
    /// 顺序是 FTP 协议强制的：**先** `EPSV`/`PASV` 拿到端口，**再**连过去，
    /// 最后才发 `MLSD`/`LIST`。反过来（先发命令再连）会被服务器直接拒掉。
    pub(crate) async fn open_data_channel(&mut self) -> Result<TransportStream, RemoteError> {
        let epsv = self.command("EPSV", &[229]).await;

        if let Ok(text) = epsv {
            let port = parse_epsv_port(&text).ok_or_else(|| {
                RemoteError::protocol(format!("无法从 EPSV 回复里取出数据端口：{text}"))
            })?;

            // EPSV **只给端口、不给地址**，所以主机必然是控制连接那一个。
            return self.connect_data(self.host.clone(), port).await;
        }

        // EPSV 不支持是常态（RFC 2428 是 1998 年的扩展，很多老服务器没有）。
        // 退 PASV 时**必须**换一个错误上报来源：EPSV 的失败原因在这里已经无关了。
        let pasv = self.command("PASV", &[227]).await?;
        let (advertised, port) = parse_pasv_endpoint(&pasv)
            .ok_or_else(|| RemoteError::protocol(format!("无法从 PASV 回复里取出数据端点：{pasv}")))?;

        self.connect_data(pasv_host_to_use(advertised, &self.host), port)
            .await
    }

    async fn connect_data(&self, host: String, port: u16) -> Result<TransportStream, RemoteError> {
        transport::connect(&self.proxy, &host, port, Socks5CommandKind::Connect)
            .await
            .map_err(|error| {
                RemoteError::unreachable(format!("数据端口 {host}:{port} 连不上：{}", error.message))
            })
    }

    /// 读完数据通道后取回 `226` 那条完成回复。
    ///
    /// **不能跳过**：没有它就发现不了传输中途失败（服务器在数据通道开着的时候
    /// 就回 `550` 的情况是存在的），而那种情况下缓冲里的半截列表会被当成完整结果。
    ///
    /// 也有**不能改成 `NOOP` 的理由**：`226` 是这条回复本身，不是一条新命令的回复。
    /// 先发 `NOOP` 的话，读到的第一条是 `226`，于是 `NOOP` 校验必然失败 ——
    /// 每次列目录都会在最后一步报错，而列表其实早就取全了。
    pub(crate) async fn finish_transfer(&mut self) -> Result<(), RemoteError> {
        read_reply(&mut self.stream, &mut self.buffer).await?;
        let text = decode(&self.buffer);

        let code = super::connection_test::parse_ftp_reply_code(&text).ok_or_else(|| {
            RemoteError::protocol(format!("传输结束后收到了无法识别的回复：{text}"))
        })?;

        // 250 与 226 都是「完成了」；其余（含 426/451/550）都是真的失败。
        if code == 226 || code == 250 {
            return Ok(());
        }

        Err(map_ftp_reply_code(code, &text))
    }

    pub(crate) fn new(stream: S, host: &str, proxy: &ProxyConfig) -> Self {
        Self {
            stream,
            host: host.to_string(),
            proxy: proxy.clone(),
            buffer: Vec::new(),
        }
    }

    /// 把底层流取出来（`FtpControl` 被吃掉）。
    ///
    /// **显式 FTPS 专用**：`AUTH TLS` 之后要把这条明文流交给 TLS 握手。
    /// 把缓冲一并丢掉是刻意的 —— 里面可能还有半条没读干净的回复，
    /// 带着它进入 TLS 会让对端看到一段错位的字节。
    pub(crate) fn into_stream(self) -> S {
        self.stream
    }

    /// `USER` + 必要的 `PASS`，然后 `TYPE I`。
    ///
    /// **显式 FTPS 会调两次**（升级前、升级后）。这是 RFC 4217 的要求：
    /// 升级之后服务器把会话当作重置了，不重登的话后面每条命令都会得到 530 ——
    /// 而「登录成功了但列目录全 530」这个现象没有任何报错指向真正的原因。
    pub(crate) async fn login(
        &mut self,
        username: &str,
        password: Option<&str>,
    ) -> Result<(), RemoteError> {
        let username = if username.trim().is_empty() {
            "anonymous".to_string()
        } else {
            username.to_string()
        };

        // USER 可能回 230（一次就登录成功），也可能回 331 让你接着发 PASS。
        let user_reply = self.command(&format!("USER {username}"), &[230, 331]).await?;

        if super::connection_test::parse_ftp_reply_code(&user_reply) != Some(230) {
            let Some(password) = password else {
                return Err(RemoteError::auth(
                    "这条连接没有保存密码，服务器要求登录密码。请到设置页填写后重试。",
                ));
            };

            self.command(&format!("PASS {password}"), &[230]).await?;
        }

        // TYPE I：`MLSD`/`LIST` 本身是文本，但沿用 ASCII 会让某些服务器对
        // 含非 ASCII 文件名的目录行为异常。统一按二进制走。
        self.command("TYPE I", &[200]).await?;

        Ok(())
    }
}

/// 在**已经建好并登录过**的通道上跑一次列目录。
///
/// 刻意做成自由函数而不是 `FtpRemoteProvider` 的方法：FTPS 要在
/// 「TLS 升级 + 重新登录」之后调它，形态与明文路径不同，但协议部分一模一样。
pub(crate) async fn list_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
) -> Result<Vec<super::ftp_parsing::FtpRecord>, RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    // 根目录不能 CWD —— 多数服务器对 `CWD /` 的处理不一致，
    // 而 `MLSD /` 本身是合法的，直接用它。
    if remote_path != "/" {
        control.command(&format!("CWD {remote_path}"), &[250]).await?;
    }

    let mut data = control.open_data_channel().await?;

    control
        .stream
        .write_all(b"MLSD\r\n")
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送 MLSD 失败：{error}")))?;

    control
        .stream
        .flush()
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送 MLSD 失败：{error}")))?;

    // `read_listing` 按值吃掉 data 连接 —— 读满即 drop，
    // 服务器那边才能干净地送出 `226`，我们随后读到的就是它。
    let bytes = read_listing(data).await?;

    control.finish_transfer().await?;

    Ok(parse_listing(&String::from_utf8_lossy(&bytes)))
}

/// 发一条「我们自己拼的」传输命令，**不等回复**。
///
/// 与 [`FtpControl::command`] 的区别有三点：
/// 一是**不等回复**（传输命令的回复在数据通道跑完之后才来，在线等会死锁）；
/// 二是**动词与参数分开检查控制字符** —— 自己补上的 `\r\n` 是协议要求的行尾，
/// 拿整条命令去查会把每一次传输都误判成攻击；
/// 三是它**不查回复码**，因为此刻还没有回复。
async fn send_transfer_command<S>(
    stream: &mut S,
    verb: &str,
    argument: &str,
) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncWrite + Unpin,
{
    if contains_control_characters(verb) || contains_control_characters(argument) {
        return Err(RemoteError::protocol(
            "FTP 命令里出现了控制字符，已拒绝发送",
        ));
    }

    let command = format!("{verb} {argument}\r\n");

    stream
        .write_all(command.as_bytes())
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送 FTP 传输命令失败：{error}")))?;

    stream
        .flush()
        .await
        .map_err(|error| RemoteError::disconnected(format!("发送 FTP 传输命令失败：{error}")))
}

/// 切到 `parent`（根目录跳过）与 [`list_via_control`] 同一条理由：
/// 多数服务器对 `CWD /` 的处理不一致。
async fn enter_parent<S>(control: &mut FtpControl<S>, parent: &str) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    if parent == "/" {
        return Ok(());
    }

    control.command(&format!("CWD {parent}"), &[250]).await.map(|_| ())
}

/// 在**已经建好并登录过**的通道上跑一次文件下载（`RETR`）。
///
/// 与 [`list_via_control`] 刻意同构：切目录 → 开数据通道 → 发命令 → 读满 →
/// 取 `226`。**`226` 那一步不能省** —— 服务器可以先送来半截数据再回 `550`，
/// 而那时候缓冲里已经有一段看起来完整的内容了。
pub(crate) async fn retrieve_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
) -> Result<Vec<u8>, RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    let (parent, name) = super::path::split_remote_parent_and_name(remote_path)?;
    enter_parent(control, &parent).await?;

    let data = control.open_data_channel().await?;

    send_transfer_command(&mut control.stream, "RETR", &name).await?;

    let bytes = read_listing(data).await?;

    control.finish_transfer().await?;

    Ok(bytes)
}

/// 在**已经建好并登录过**的通道上跑一次文件上传（`STOR`）。
///
/// ⚠️ **数据通道必须显式关掉写端。** 服务器读满之后才会回 `226`，
/// 而我们接下来是去**控制通道**上读那条回复的 —— 不关的话服务器还在等下半截，
/// 双方互等到超时。
///
/// **分块写**：每写完一块就报一次已写出的字节数。
/// 一次 `write_all` 整份写出去的话，大文件上传期间界面上一点进度都看不到。
pub(crate) async fn store_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
    content: &[u8],
    on_progress: &(dyn Fn(u64) + Send + Sync),
) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    let (parent, name) = super::path::split_remote_parent_and_name(remote_path)?;
    enter_parent(control, &parent).await?;

    let mut data = control.open_data_channel().await?;

    send_transfer_command(&mut control.stream, "STOR", &name).await?;

    let mut written = 0u64;

    for chunk in content.chunks(REMOTE_WRITE_CHUNK_BYTES) {
        data.write_all(chunk)
            .await
            .map_err(|error| RemoteError::disconnected(format!("上传数据时连接中断：{error}")))?;

        written += chunk.len() as u64;
        on_progress(written);
    }

    data.flush()
        .await
        .map_err(|error| RemoteError::disconnected(format!("上传数据时连接中断：{error}")))?;
    // 关写端 = 「内容发完了」。失败也继续：很多服务器不认 FIN，靠的是长度。
    let _ = data.shutdown().await;

    control.finish_transfer().await
}

/// 在**已经建好并登录过**的通道上建一个目录（`MKD`）。
///
/// 「已存在视为成功」靠**失败之后列一次父目录**实现，而不是把 `550` 当成成功：
/// FTP 的 `550` 既是「已存在」也可能是「没权限」，两者**同码分不开**。
/// 直接吞掉 `550` 的后果是「目录建不出来」被伪装成成功，而用户看到的
/// 只是「传完了但少了几层目录」。
pub(crate) async fn make_dir_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    let (parent, name) = super::path::split_remote_parent_and_name(remote_path)?;
    enter_parent(control, &parent).await?;

    if let Err(error) = control.command(&format!("MKD {name}"), &[257]).await {
        let already_there = list_via_control(control, &parent)
            .await
            .map(|records| records.iter().any(|record| record.name == name))
            .unwrap_or(false);

        if already_there {
            return Ok(());
        }

        return Err(error);
    }

    Ok(())
}
/// 在**已经建好并登录过**的通道上删掉一个文件或目录（`DELE` / `RMD`）。
///
/// 目录**必须为空**：FTP 没有递归删除，服务器对非空目录回 `550`。
/// 而 `550` 在 [`map_ftp_reply_code`] 里是「路径不可用」——
/// 对非空目录来说这句话不算错，但它没有告诉用户「要先清空」。
/// 所以这里在失败之后**再列一次父目录**，确认目标还在、且它是个目录时，
/// 补一句能照着做的话。
///
/// ⚠️ `550` 既是「目录非空」也可能是「没有权限」，FTP 这一层分不开。
/// 目录非空的判定靠**列出目录里还有没有东西**，权限不足只能如实报「路径不可用」。
pub(crate) async fn remove_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
    is_dir: bool,
) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    let (parent, name) = super::path::split_remote_parent_and_name(remote_path)?;
    enter_parent(control, &parent).await?;

    let verb = if is_dir { "RMD" } else { "DELE" };

    match control.command(&format!("{verb} {name}"), &[250]).await {
        Ok(_) => Ok(()),
        Err(error) => {
            if is_dir && error.kind == RemoteErrorKind::NotFound {
                let still_there = list_via_control(control, &parent)
                    .await
                    .map(|records| records.iter().any(|record| record.name == name))
                    .unwrap_or(false);

                if still_there {
                    return Err(RemoteError::protocol(format!(
                        "这个远端目录不是空的，FTP 不支持递归删除：{remote_path}"
                    )));
                }
            }

            Err(error)
        }
    }
}

/// 在**已经建好并登录过**的通道上把一个条目改名（`RNFR` + `RNTO`）。
///
/// FTP 的改名是**两条命令**，不是一条：
///
/// 1. `RNFR <旧名>` —— 指名要改谁。服务器回 `350`（Requested file action pending
///    further information）表示「这个名字我记住了，你给新名字」；
/// 2. `RNTO <新名>` —— 给新名字。回 `250` 表示改成了。
///
/// **中间断了就是没改成**：只发 `RNFR` 不发 `RNTO`，服务器那边什么都没发生。
/// 所以这两步必须**都成功**才算成功 —— 第一步失败就返回错误，
/// 绝不能「`RNFR` 成功就算成了」。
///
/// `RNFR` 只接受**名字**（先 `CWD` 到父目录），与 `DELE` / `MKD` 同一条规矩。
///
/// ⚠️ **目标已存在时各服务器行为不同**：有的回 `550` 拒绝，有的直接覆盖。
/// 本层**不做统一语义**，如实把服务器的回应带回去 ——
/// 悄悄覆盖掉一个同名文件是本项目最不能出的错（规格 §6）。
pub(crate) async fn rename_via_control<S>(
    control: &mut FtpControl<S>,
    remote_path: &str,
    new_name: &str,
) -> Result<(), RemoteError>
where
    S: tokio::io::AsyncRead + tokio::io::AsyncWrite + Unpin + Send,
{
    let (parent, old_name) = super::path::split_remote_parent_and_name(remote_path)?;
    enter_parent(control, &parent).await?;

    // `350` = 「已记住这个名字，请给新名字」。
    control.command(&format!("RNFR {old_name}"), &[350]).await?;

    // `250` = 改名成功。
    control.command(&format!("RNTO {new_name}"), &[250]).await?;

    Ok(())
}

/// 控制通道需要的读写能力。`AsyncRead` 与 `AsyncWrite` 分开写，
/// 是为了不依赖 `tokio::io::AsyncReadWrite` 的具体形态。
pub trait AsyncReadWrite: tokio::io::AsyncRead + tokio::io::AsyncWrite {}
impl<T> AsyncReadWrite for T where T: tokio::io::AsyncRead + tokio::io::AsyncWrite {}

/// 从数据通道读满整个列表。
///
/// 用「读到 EOF」而不是「按行读」：`read_to_end` 对 `CRLF` / `LF` / 无换行的末行
/// 一视同仁，而逐行读会在「最后一行没有换行符」时静默丢掉那条记录。
///
/// ⚠️ **上限是在读的过程中强制的，不是在读完之后判的。** 一个损坏的或恶意的服务器
/// 可以无限发数据；先 `read_to_end` 再检查长度的话，等检查跑起来时内存已经被吃掉了。
/// 所以用 `take()` 在源头截断，多读的那一个字节就是「超限」的证据。
async fn read_listing(mut data: TransportStream) -> Result<Vec<u8>, RemoteError> {
    let mut buffer = Vec::new();

    // `+1` 是刻意的：读到 `MAX` 说明还没到头，再多读一个字节才能确认超限。
    let read = data
        .take((MAX_LISTING_BYTES + 1) as u64)
        .read_to_end(&mut buffer)
        .await;

    match read {
        Ok(_) if buffer.len() > MAX_LISTING_BYTES => Err(RemoteError::protocol(format!(
            "这个目录的列表超过了 {} MiB，可能是生成式目录或服务器异常",
            MAX_LISTING_BYTES / 1024 / 1024
        ))),
        Ok(_) => Ok(buffer),
        // 服务器没关数据连接就断了：这不算失败，前面读到的部分仍然可用。
        Err(error) if error.kind() == ErrorKind::UnexpectedEof => Ok(buffer),
        Err(error) => Err(RemoteError::disconnected(format!(
            "读取目录列表时连接中断：{error}"
        ))),
    }
}

/// 把一整段列表文本拆成记录。`MLSD` 优先，不认识任何一行时退 `LIST`。
///
/// 逐行都同时喂给两个解析器是刻意的：真实服务器的输出经常是**混合**的
/// （多半行是 MLSD 事实列，个别是 `total 0` 之类的汇总行），
/// 只挑一种解析会让另一种格式的行悄悄消失。
pub fn parse_listing(text: &str) -> Vec<super::ftp_parsing::FtpRecord> {
    let mut records = Vec::new();

    for line in text.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if let Some(record) = parse_mlsd_line(trimmed) {
            records.push(record);
        }
        else if let Some(record) = parse_list_line(trimmed) {
            records.push(record);
        }
    }

    records
}

/// FTP 的远程目录 provider。
///
/// 与 [`SftpRemoteProvider`](super::sftp_provider::SftpRemoteProvider) 一样
/// **每次调用都重新建连**：方案 C 的已知代价，换来「关掉远程界面一定断开」今天就成立。
pub struct FtpRemoteProvider {
    user_data_dir: PathBuf,
    app_data_dir: PathBuf,
    timeout: Duration,
}

impl FtpRemoteProvider {
    pub fn new(user_data_dir: &Path, app_data_dir: &Path) -> Self {
        Self {
            user_data_dir: user_data_dir.to_path_buf(),
            app_data_dir: app_data_dir.to_path_buf(),
            timeout: FTP_OPERATION_TIMEOUT,
        }
    }

    /// 登录并切到二进制模式。
    async fn login(
        resolved: &ResolvedConnection,
    ) -> Result<FtpControl<TransportStream>, RemoteError> {
        let connection = &resolved.connection;

        let stream =
            transport::connect(&connection.proxy, &connection.host, connection.port, Socks5CommandKind::Connect)
                .await?;

        let mut control = FtpControl::new(stream, &connection.host, &connection.proxy);

        // 欢迎语。拒绝一个「不是 FTP 服务」的对端比让它在 USER 上含糊失败更有用。
        control.read_greeting().await?;
        control
            .login(&connection.username, resolved.password.as_deref())
            .await?;

        Ok(control)
    }

    /// 打开一条控制通道、列一次目录。
    ///
    /// 外层套一个整体超时：SFTP 的 `readdir` 有自己的单次超时，
    /// 这里要的是「别把界面卡死」的那一层。FTPS 走**同一个**
    /// [`list_via_control`]，所以两边超时长短必然一致。
    ///
    /// **不接一个 `parse` 闭包** —— 早期版本有，结果是明文 FTP 与 FTPS
    /// 各自传了一个解析函数，于是「解析失败时怎么办」在两条路上可以不一样。
    /// 解析已经收敛在 `list_via_control` 一处，这里不该再有第二个决策点。
    async fn with_listing(
        &self,
        resolved: &ResolvedConnection,
        remote_path: &str,
    ) -> Result<Vec<super::ftp_parsing::FtpRecord>, RemoteError> {
        let work = async {
            let mut control = Self::login(resolved).await?;
            let records = list_via_control(&mut control, remote_path).await?;
            let _ = control.command("QUIT", &[221, 226]).await;
            Ok(records)
        };

        match tokio::time::timeout(self.timeout, work).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "读取 FTP 目录超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
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
        let records = self.with_listing(resolved, normalized).await?;

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
    /// **刻意不用 `MLST`，改用「列父目录再按名字找」。**
    ///
    /// 理由：`MLST`（RFC 3659）的回复是**多行**的
    /// （`250-` 起、事实行、末行 `250 End`），而 [`read_reply`] 一次只读一行。
    /// 要用它就得先写一个多行回复读取器 —— 而那段代码在本阶段没有任何真机可以验，
    /// 写出来只会在服务器真正实现 `MLST` 时才第一次跑。
    ///
    /// 父目录列表走的是 [`Self::list`]，那条路径本文件已经逐条推演过
    /// （`EPSV → Connect → MLSD/LIST → 226`），代价是一次列表而不是一次属性查询 ——
    /// 对「点一个远程文件看属性」这个频率，这个代价可以接受。
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

        // `list` 返回的 `path` 形如 `sfm://remote/<id>/<父目录>/<名字>`。
        // 比**末段**而不是比后缀 —— 后缀匹配会把 `a.txt` 误认成 `xa.txt` 的子串，
        // 于是「点开 `a.txt`」拿到的是另一个文件的属性，而界面上毫无异常。
        let found = siblings
            .into_iter()
            .find(|entry| entry.name == name)
            .ok_or_else(|| {
                RemoteError::not_found(format!("远端没有这个条目：{normalized}"))
            })?;

        Ok(found)
    }

    /// 下载一个远程文件。
    pub async fn read_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let bytes = retrieve_via_control(&mut control, normalized).await?;
            let _ = control.command("QUIT", &[221, 226]).await;
            Ok(bytes)
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "下载 FTP 文件超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    /// 上传一个远程文件（覆盖语义）。
    pub async fn write_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let outcome = store_via_control(&mut control, normalized, &content, &|_| {}).await;
            let _ = control.command("QUIT", &[221, 226]).await;
            outcome
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "上传 FTP 文件超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    /// 上传一个远程文件（覆盖语义），**分块写并回报进度**。
    pub async fn write_file_with_progress(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        content: Vec<u8>,
        on_progress: &(dyn Fn(u64) + Send + Sync),
    ) -> Result<(), RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let outcome = store_via_control(&mut control, normalized, &content, on_progress).await;
            let _ = control.command("QUIT", &[221, 226]).await;
            outcome
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "上传 FTP 文件超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    /// 建一个远程目录（已存在视为成功）。
    pub async fn make_dir(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<(), RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let outcome = make_dir_via_control(&mut control, normalized).await;
            let _ = control.command("QUIT", &[221, 226]).await;
            outcome
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "创建 FTP 目录超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    /// 删除一个远程文件或目录。
    pub async fn remove_path(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        is_dir: bool,
    ) -> Result<(), RemoteError> {
        super::path::reject_path_control_characters(normalized)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let outcome = remove_via_control(&mut control, normalized, is_dir).await;
            let _ = control.command("QUIT", &[221, 226]).await;

            outcome
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "删除 FTP 条目超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }

    /// 把一个远程条目**在原目录内**改名（`RNFR` + `RNTO`）。
    pub async fn rename_path(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        new_name: &str,
    ) -> Result<(), RemoteError> {
        super::path::reject_path_control_characters(normalized)?;
        super::path::validate_remote_entry_name(new_name)?;

        let run = async {
            let mut control = Self::login(resolved).await?;
            let outcome = rename_via_control(&mut control, normalized, new_name).await;
            let _ = control.command("QUIT", &[221, 226]).await;

            outcome
        };

        match tokio::time::timeout(self.timeout, run).await {
            Ok(result) => result,
            Err(_) => Err(RemoteError::disconnected(format!(
                "重命名 FTP 条目超过 {} 秒仍未完成，已放弃这次操作",
                self.timeout.as_secs()
            ))),
        }
    }
}

#[async_trait]
impl RemoteProvider for FtpRemoteProvider {
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.list(&resolved, &normalized).await
    }

    async fn read_file(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.read_file(&resolved, &normalized).await
    }

    async fn write_file(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.write_file(&resolved, &normalized, content).await
    }

    async fn write_file_with_progress(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
        on_progress: &(dyn Fn(u64) + Send + Sync),
    ) -> Result<(), RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.write_file_with_progress(&resolved, &normalized, content, on_progress)
            .await
    }

    async fn make_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<(), RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.make_dir(&resolved, &normalized).await
    }

    /// FTP 没有 `SITE CHMOD`，也没有可靠的权限位。
    ///
    /// **在解析连接之前就拒绝**：否则「连接表里没有这条连接」会报 `NotFound`，
    /// 而用户看到的应该是「这个协议做不到」—— 后者才是他能处置的那一条。
    async fn set_permissions(
        &self,
        _connection_id: &str,
        _remote_path: &str,
        _mode: u32,
    ) -> Result<(), RemoteError> {
        Err(super::transfer::unsupported_set_permissions("FTP"))
    }

    /// FTP 拿不到权限位（`LIST` 的权限串是服务器自己拼的文本，各家格式不一）。
    /// 「取不到就给 `None`」与既有 `remote_stat_dir_entry` 的契约一致。
    async fn get_permissions(
        &self,
        _connection_id: &str,
        _remote_path: &str,
    ) -> Result<Option<u32>, RemoteError> {
        Ok(None)
    }

    async fn remove_path(
        &self,
        connection_id: &str,
        remote_path: &str,
        is_dir: bool,
    ) -> Result<(), RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.remove_path(&resolved, &normalized, is_dir).await
    }

    async fn rename_path(
        &self,
        connection_id: &str,
        remote_path: &str,
        new_name: &str,
    ) -> Result<(), RemoteError> {
        let normalized = super::path::normalize_remote_path(remote_path)
            .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

        let resolved = super::registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        self.rename_path(&resolved, &normalized, new_name).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // -----------------------------------------------------------------
    // 假 FTP 服务端
    //
    // 纯解析测试只能证明「收到一行时解析得对」，
    // 证明不了**协议时序**对不对 —— 而时序恰恰是 FTP 最容易错的地方：
    // 先连数据通道还是先发 `MLSD`、`226` 要不要读、读早了会读到什么。
    // 这些只有真 socket 才测得到。
    // -----------------------------------------------------------------

    /// 假服务端会记下客户端依次发了什么命令，用来断言**顺序**。
    #[derive(Clone, Default)]
    struct StubLog(std::sync::Arc<std::sync::Mutex<Vec<String>>>);

    impl StubLog {
        fn commands(&self) -> Vec<String> {
            self.0.lock().expect("log lock").clone()
        }
    }

    /// 起一个假 FTP 服务端，跑一次 `MLSD`/`LIST` 就返回。
    ///
    /// `listing` 是数据通道上要发的那段文本；
    /// `completion_reply` 是数据发完之后在控制通道上回的那条
    /// —— 必须是参数，因为**失败的那条回复**才是这里最要紧的一条：
    /// 服务器可以先把半截数据送过来，再回一个 `550`。
    /// 桩永远回 `226` 的话，「读完要校验完成回复」这道判断就没有任何测试碰得到。
    fn spawn_stub_ftp_with(
        listing: &'static str,
        completion_reply: &'static str,
        log: StubLog,
    ) -> u16 {
        spawn_stub_ftp_full(
            listing,
            completion_reply,
            "350 ready for new name",
            "250 renamed",
            log,
        )
    }

    /// 与 [`spawn_stub_ftp_with`] 相同，但**改名的两条命令各给一条指定回复**。
    ///
    /// 单独拆一个入口是因为「`RNFR` 失败时不该再发 `RNTO`」这条断言
    /// 需要一个会失败的桩，而既有的桩对改名一律回成功 ——
    /// 那样的话失败路径永远测不到。
    fn spawn_stub_ftp_with_rename_replies(
        rnfr_reply: &'static str,
        rnto_reply: &'static str,
        log: StubLog,
    ) -> u16 {
        spawn_stub_ftp_full("type=file;size=1; a.txt\n", "226 transfer complete", rnfr_reply, rnto_reply, log)
    }

    fn spawn_stub_ftp_full(
        listing: &'static str,
        completion_reply: &'static str,
        rnfr_reply: &'static str,
        rnto_reply: &'static str,
        log: StubLog,
    ) -> u16 {
        use std::io::{BufRead, BufReader, Write};
        use std::net::{TcpListener, TcpStream};

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind control");
        let port = listener.local_addr().expect("addr").port();

        std::thread::spawn(move || {
            let (control, _) = listener.accept().expect("accept control");
            let mut writer = control.try_clone().expect("clone");
            let mut reader = BufReader::new(control);

            writeln!(writer, "220 stub ready").expect("greeting");

            loop {
                let mut line = String::new();

                if reader.read_line(&mut line).expect("read") == 0 {
                    break;
                }

                let command = line.trim_end().to_string();
                log.0.lock().expect("log lock").push(command.clone());
                let verb = command.split_whitespace().next().unwrap_or("").to_string();

                if verb == "QUIT" {
                    let _ = writeln!(writer, "221 bye");
                    break;
                }

                if verb == "EPSV" {
                    // 数据端口在服务端另开一个监听，与控制端口无关 ——
                    // 这正是被动模式的要点，也顺手证明了客户端不能假设
                    // 「数据端口 = 控制端口」。
                    let data_listener = TcpListener::bind("127.0.0.1:0").expect("bind data");
                    let data_port = data_listener.local_addr().expect("addr").port();
                    writeln!(writer, "229 Entering Extended Passive Mode (|||{data_port}|)")
                        .expect("epsv");

                    // 传输命令与数据通道一起在这里处理完。
                    // 现在就 accept 会死锁 —— 客户端还在等 `229` 的回包。
                    let mut next = String::new();

                    if reader.read_line(&mut next).expect("read") == 0 {
                        break;
                    }

                    log.0.lock().expect("log lock").push(next.trim_end().to_string());

                    let (data, _) = data_listener.accept().expect("accept data");
                    let mut data_writer = data;
                    data_writer.write_all(listing.as_bytes()).expect("write listing");
                    data_writer.flush().expect("flush");
                    drop(data_writer);

                    writeln!(writer, "{completion_reply}").expect("completion reply");
                    continue;
                }

                let reply = match verb.as_str() {
                    "USER" => writeln!(writer, "331 need password"),
                    "PASS" => writeln!(writer, "230 logged in"),
                    "TYPE" => writeln!(writer, "200 ok"),
                    "CWD" => writeln!(writer, "250 ok"),
                    "RNFR" => writeln!(writer, "{rnfr_reply}"),
                    "RNTO" => writeln!(writer, "{rnto_reply}"),
                    _ => writeln!(writer, "500 unknown command"),
                };

                if reply.is_err() {
                    break;
                }
            }
        });

        port
    }

    fn spawn_stub_ftp(listing: &'static str, log: StubLog) -> u16 {
        spawn_stub_ftp_with(listing, "226 transfer complete", log)
    }

    fn resolved(port: u16, password: Option<&str>) -> ResolvedConnection {
        ResolvedConnection {
            connection: super::super::connection::RemoteConnection {
                id: "conn-ftp".to_string(),
                name: "FTP 桩".to_string(),
                protocol: super::super::connection::RemoteProtocol::Ftp,
                host: "127.0.0.1".to_string(),
                port,
                username: "tester".to_string(),
                initial_path: "/".to_string(),
                local_path: None,
                proxy: ProxyConfig::Direct,
                credential_key: None,
            },
            password: password.map(str::to_string),
        }
    }

    fn provider() -> FtpRemoteProvider {
        FtpRemoteProvider::new(Path::new("C:/none"), Path::new("C:/none"))
    }

    #[tokio::test]
    async fn listing_works_end_to_end_over_a_real_socket() {
        let log = StubLog::default();
        let port = spawn_stub_ftp(
            "type=file;size=1234;modify=20230101120000; hello.txt\n\
             type=dir;modify=20230101120000; pub\n",
            log.clone(),
        );

        let entries = provider()
            .list(&resolved(port, Some("pw")), "/")
            .await
            .expect("stub listing");

        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].name, "hello.txt");
        assert!(!entries[0].is_dir);
        assert_eq!(entries[0].size, 1234);
        assert_eq!(entries[0].modified_time, 1_672_574_400_000);
        assert_eq!(entries[1].name, "pub");
        assert!(entries[1].is_dir);
        assert_eq!(entries[0].path, "sfm://remote/conn-ftp/hello.txt");
    }

    #[tokio::test]
    async fn the_command_sequence_is_the_one_ftp_demands() {
        let log = StubLog::default();
        let port = spawn_stub_ftp("type=file;size=1; a.txt\n", log.clone());

        provider()
            .list(&resolved(port, Some("pw")), "/pub")
            .await
            .expect("stub listing");

        let commands = log.commands();

        // 顺序本身就是断言：数据通道必须在 `EPSV` 之后开、在 `MLSD` 之前连上，
        // 而 `226` 必须在数据发完之后才出现。反了的话要么服务器拒收，
        // 要么读到的「完成回复」其实是别的命令的回复。
        let index_of = |verb: &str| commands.iter().position(|c| c.starts_with(verb));
        let epsv = index_of("EPSV").expect("EPSV must be sent");
        let mlsd = index_of("MLSD").expect("MLSD must be sent");
        let cwd = index_of("CWD").expect("CWD must be sent for a non-root path");

        assert!(cwd < epsv, "CWD must precede EPSV: {commands:?}");
        assert!(epsv < mlsd, "EPSV must precede MLSD: {commands:?}");

        // 传输命令必须**只**发一次 —— 发两次的常见原因是在数据通道上重试，
        // 而 FTP 控制通道不是幂等的。
        assert_eq!(
            commands.iter().filter(|c| c.starts_with("MLSD")).count(),
            1
        );
    }

    #[tokio::test]
    async fn a_root_listing_skips_cwd() {
        let log = StubLog::default();
        let port = spawn_stub_ftp("type=file;size=1; a.txt\n", log.clone());

        provider()
            .list(&resolved(port, Some("pw")), "/")
            .await
            .expect("stub listing");

        // 多数服务器对 `CWD /` 的处理不一致，而 `MLSD /` 本身是合法的。
        assert!(
            !log.commands().iter().any(|c| c.starts_with("CWD")),
            "root must not send CWD: {:?}",
            log.commands()
        );
    }

    #[tokio::test]
    async fn a_failed_completion_reply_discards_the_half_received_listing() {
        // 服务器可以**先**把半截数据送过来，再回一个 550（配额超了、
        // 连接被中途掐断、磁盘满了）。这时数据通道里已经有东西了 ——
        // 不校验完成回复就会把那半截当成完整目录返回，
        // 界面上是一个「少了几个文件但不报错」的目录。
        //
        // 这条用例是被注入验证逼出来的：`skip-transfer-completion-check`
        // 在只有「桩永远回 226」的情况下全绿 —— 也就是说，
        // 「读完要校验完成回复」这句话此前**没有任何测试碰得到**。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with(
            "type=file;size=10;modify=20230101120000; a.txt\n",
            "550 transfer aborted",
            log.clone(),
        );

        let error = provider()
            .list(&resolved(port, Some("pw")), "/")
            .await
            .expect_err("a 550 completion reply must not look like success");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn the_rename_sequence_is_the_one_ftp_demands() {
        // FTP 的改名是**两条命令**：`RNFR` 指名要改谁（回 `350`），
        // `RNTO` 给新名字（回 `250`）。顺序反了或者只发一条，服务器都不会改。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with_rename_replies(
            "350 ready for new name",
            "250 renamed",
            log.clone(),
        );

        provider()
            .rename_path(&resolved(port, Some("pw")), "/pub/old.txt", "new.txt")
            .await
            .expect("stub rename");

        let commands = log.commands();

        let index_of = |verb: &str| commands.iter().position(|c| c.starts_with(verb));
        let rnfr = index_of("RNFR").expect("RNFR must be sent");
        let rnto = index_of("RNTO").expect("RNTO must be sent");

        assert!(rnfr < rnto, "RNFR must precede RNTO: {commands:?}");

        // 两条命令都只带**名字**，不带路径 ——
        // `RNFR` 是相对当前工作目录的，所以必须先 `CWD` 到父目录。
        assert_eq!(commands[rnfr], "RNFR old.txt");
        assert_eq!(commands[rnto], "RNTO new.txt");

        let cwd = index_of("CWD").expect("CWD must be sent for a non-root path");
        assert!(cwd < rnfr, "CWD must precede RNFR: {commands:?}");

        // 每条命令只发一次 —— 控制通道不是幂等的，重发等于改两次。
        assert_eq!(commands.iter().filter(|c| c.starts_with("RNFR")).count(), 1);
        assert_eq!(commands.iter().filter(|c| c.starts_with("RNTO")).count(), 1);
    }

    #[tokio::test]
    async fn a_failed_rnfr_stops_before_rnto() {
        // `RNFR` 失败（源不存在 / 没权限）之后**不能再发 `RNTO`** ——
        // 服务器那边没有待改名的对象，发过去只会被当成一条非法命令。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with_rename_replies(
            "550 no such file",
            "250 renamed",
            log.clone(),
        );

        let error = provider()
            .rename_path(&resolved(port, Some("pw")), "/pub/old.txt", "new.txt")
            .await
            .expect_err("a failed RNFR must not look like success");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);

        let commands = log.commands();
        assert!(
            !commands.iter().any(|c| c.starts_with("RNTO")),
            "RNTO must not be sent after RNFR failed: {commands:?}"
        );
    }

    #[tokio::test]
    async fn a_failed_rnto_is_reported_as_an_error() {
        // 阳性对照：与上一条配对。`RNFR` 成功但 `RNTO` 失败时，
        // 这次改名**没有发生**，必须报错而不是报成功。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with_rename_replies(
            "350 ready for new name",
            "550 name already exists",
            log.clone(),
        );

        let error = provider()
            .rename_path(&resolved(port, Some("pw")), "/pub/old.txt", "new.txt")
            .await
            .expect_err("a failed RNTO must not look like success");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn an_illegal_new_name_is_rejected_before_any_connection_is_made() {
        // 名字非法是**本地**判定 —— 一秒都不该花在网络上。
        //
        // 用一个**真的桩**来证：桩会把收到的每条命令记进日志。
        // 如果客户端先开了连接，日志里必然出现 `USER` / `PASS` ——
        // 于是「没发任何命令」这条断言就不是同义反复。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with_rename_replies(
            "350 ready for new name",
            "250 renamed",
            log.clone(),
        );

        for name in ["", "a/b", "..", "a\\b", "a\r\nQUIT"] {
            let error = provider()
                .rename_path(&resolved(port, Some("pw")), "/pub/old.txt", name)
                .await
                .expect_err("an illegal name must be rejected");

            assert_eq!(error.kind, RemoteErrorKind::Protocol, "{name:?} 应该被拒");
        }

        assert!(
            log.commands().is_empty(),
            "名字非法时不该发出任何 FTP 命令: {:?}",
            log.commands()
        );
    }

    #[tokio::test]
    async fn a_226_completion_reply_is_accepted() {
        // 阳性对照：与上一条配对。两条都在的话，上一条的红才是有意义的。
        let log = StubLog::default();
        let port = spawn_stub_ftp_with(
            "type=file;size=10;modify=20230101120000; a.txt\n",
            "226 transfer complete",
            log,
        );

        let entries = provider()
            .list(&resolved(port, Some("pw")), "/")
            .await
            .expect("226 must be accepted");

        assert_eq!(entries.len(), 1);
    }

    #[tokio::test]
    async fn a_wrong_password_surfaces_as_an_auth_error_not_a_protocol_one() {
        let log = StubLog::default();
        let port = spawn_stub_ftp("type=file;size=1; a.txt\n", log);

        let ok = provider()
            .list(&resolved(port, Some("pw")), "/")
            .await
            .expect("stub listing");

        assert_eq!(ok.len(), 1);
    }

    #[tokio::test]
    async fn a_missing_password_is_refused_before_any_network_round_trip() {
        // 服务器要密码而本地没有 → 必须是 `Auth`。
        // 反过来（发一条空 PASS 试试看）会把「没存密码」伪装成「密码错了」。
        let log = StubLog::default();
        let port = spawn_stub_ftp("type=file;size=1; a.txt\n", log.clone());

        let mut resolved = resolved(port, None);
        // 桩服务器在 USER 之后一律回 331，所以缺密码这条分支一定会走到。
        let error = provider()
            .list(&resolved, "/")
            .await
            .expect_err("must fail without a password");

        resolved.password = None;
        assert_eq!(error.kind, RemoteErrorKind::Auth);
        assert!(
            !log.commands().iter().any(|c| c.starts_with("PASS")),
            "must not send PASS when no password is stored: {:?}",
            log.commands()
        );
    }

    // -----------------------------------------------------------------
    // 上传 / 下载 / 建目录
    //
    // 另起一个桩：上面那个只认 `MLSD`，而传输动词的时序**完全不一样**
    // ——`STOR` 的数据方向反过来，而且必须由客户端先关写端服务器才会回 226。
    // 复用同一个桩只会得到「500 unknown command」，测不到任何东西。
    // -----------------------------------------------------------------

    /// `STOR` 收到的字节。
    type Received = std::sync::Arc<std::sync::Mutex<Vec<u8>>>;

    /// 起一个认 `RETR` / `STOR` / `MKD` 的假 FTP 服务端。
    fn spawn_stub_ftp_transfer(
        payload: &'static [u8],
        received: Received,
        log: StubLog,
    ) -> u16 {
        use std::io::{BufRead, BufReader, Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind control");
        let port = listener.local_addr().expect("addr").port();

        std::thread::spawn(move || {
            let (control, _) = listener.accept().expect("accept control");
            let mut writer = control.try_clone().expect("clone");
            let mut reader = BufReader::new(control);

            writeln!(writer, "220 stub ready").expect("greeting");

            loop {
                let mut line = String::new();

                if reader.read_line(&mut line).expect("read") == 0 {
                    break;
                }

                let command = line.trim_end().to_string();
                log.0.lock().expect("log lock").push(command.clone());
                let verb = command.split_whitespace().next().unwrap_or("").to_string();

                if verb == "QUIT" {
                    let _ = writeln!(writer, "221 bye");
                    break;
                }

                if verb == "MKD" {
                    writeln!(writer, "257 directory created").expect("mkd");
                    continue;
                }

                if verb == "EPSV" {
                    let data_listener = TcpListener::bind("127.0.0.1:0").expect("bind data");
                    let data_port = data_listener.local_addr().expect("addr").port();
                    writeln!(writer, "229 Entering Extended Passive Mode (|||{data_port}|)")
                        .expect("epsv");

                    let mut transfer = String::new();

                    if reader.read_line(&mut transfer).expect("read") == 0 {
                        break;
                    }

                    log.0
                        .lock()
                        .expect("log lock")
                        .push(transfer.trim_end().to_string());
                    let verb = transfer
                        .trim_end()
                        .split_whitespace()
                        .next()
                        .unwrap_or("")
                        .to_string();
                    let (mut data, _) = data_listener.accept().expect("accept data");

                    match verb.as_str() {
                        "RETR" => {
                            data.write_all(payload).expect("write payload");
                            data.flush().expect("flush");
                        }
                        "STOR" => {
                            let mut buffer = Vec::new();
                            data.read_to_end(&mut buffer).expect("read payload");
                            *received.lock().expect("received lock") = buffer;
                        }
                        _ => {}
                    }

                    // 关掉数据连接 = 「内容送完了」。客户端必须**先**关写端，
                    // 服务器才会真的读到 EOF —— 这正是 `store_via_control` 里
                    // 那句 `shutdown` 的存在理由。
                    drop(data);
                    writeln!(writer, "226 transfer complete").expect("226");
                    continue;
                }

                let reply = match verb.as_str() {
                    "USER" => writeln!(writer, "331 need password"),
                    "PASS" => writeln!(writer, "230 logged in"),
                    "TYPE" => writeln!(writer, "200 ok"),
                    "CWD" => writeln!(writer, "250 ok"),
                    _ => writeln!(writer, "500 unknown command"),
                };

                if reply.is_err() {
                    break;
                }
            }
        });

        port
    }

    fn empty_received() -> Received {
        std::sync::Arc::new(std::sync::Mutex::new(Vec::new()))
    }

    #[tokio::test]
    async fn a_download_reads_the_whole_payload_and_the_226_after_it() {
        let received = empty_received();
        let log = StubLog::default();
        let port = spawn_stub_ftp_transfer(b"remote bytes", received.clone(), log.clone());

        let bytes = provider()
            .read_file(&resolved(port, Some("pw")), "/pub/readme.txt")
            .await
            .expect("stub retr");

        assert_eq!(bytes, b"remote bytes".to_vec());
        assert!(
            received.lock().expect("lock").is_empty(),
            "下载不该往服务端写任何东西"
        );

        let commands = log.commands();
        let index_of = |verb: &str| commands.iter().position(|c| c.starts_with(verb));

        // 顺序本身就是断言：`RETR` 必须在 `EPSV` 之后（先拿端口再发命令），
        // 且 `CWD` 必须在它之前（`RETR` 只收名字）。
        assert!(index_of("CWD") < index_of("RETR"), "{commands:?}");
        assert!(index_of("EPSV") < index_of("RETR"), "{commands:?}");
    }

    /// 上传方向与下载相反：数据由客户端送出，**先关写端**服务器才会回 `226`。
    /// 不关的话这里会一直等到 30 秒超时。
    #[tokio::test]
    async fn an_upload_sends_the_whole_payload_before_the_server_completes() {
        let received = empty_received();
        let port = spawn_stub_ftp_transfer(b"", received.clone(), StubLog::default());

        provider()
            .write_file(
                &resolved(port, Some("pw")),
                "/pub/新文件.txt",
                b"local bytes".to_vec(),
            )
            .await
            .expect("stub stor");

        assert_eq!(
            *received.lock().expect("lock"),
            b"local bytes".to_vec(),
            "服务端一个字节都不该少收"
        );
    }

    #[tokio::test]
    async fn a_directory_is_created_with_mkd() {
        let received = empty_received();
        let log = StubLog::default();
        let port = spawn_stub_ftp_transfer(b"", received, log.clone());

        provider()
            .make_dir(&resolved(port, Some("pw")), "/pub/new")
            .await
            .expect("stub mkd");

        assert!(
            log.commands().iter().any(|c| c.starts_with("MKD new")),
            "MKD 必须带上条目名（服务端只收名字，路径靠 CWD）：{:?}",
            log.commands()
        );
    }

    /// FTP 没有 `SITE CHMOD`。**必须**是 `Protocol`，而且**必须在开 socket 之前**。
    ///
    /// 判别力来自「连接表是空的」：`provider()` 指向 `C:/none`，
    /// 所以任何先走 `resolve_connection` 的实现都会得到 `NotFound`。
    /// 拿到 `Protocol` 就证明协议检查真的在最前面。
    #[tokio::test]
    async fn chmod_is_refused_as_a_protocol_error_before_any_socket_is_opened() {
        let error = provider()
            .set_permissions("conn-a", "/pub", 0o755)
            .await
            .expect_err("FTP must refuse chmod");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
        assert!(
            error.message.contains("不支持设置权限"),
            "文案要写明是协议不支持：{}",
            error.message
        );
    }

    /// 「取不到就给 `None`」—— 权限对话框靠这个显示「该协议不支持改权限」，
    /// 走错成 `Err` 会让每次开框都变成一次未捕获异常。
    #[tokio::test]
    async fn permissions_are_always_unavailable_on_ftp_rather_than_an_error() {
        assert_eq!(
            provider()
                .get_permissions("conn-a", "/pub")
                .await
                .expect("must not error"),
            None
        );
        // 连一个不存在的路径也一样：FTP 对两者都答不了。
        assert_eq!(
            provider()
                .get_permissions("conn-a", "/nope")
                .await
                .expect("must not error"),
            None
        );
    }

    /// `STOR` / `RETR` 的路径同样要过控制字符那道闸 ——
    /// 拼进去的 `name` 来自远端列表，而列表来自用户手输的地址栏。
    #[tokio::test]
    async fn a_remote_path_with_control_characters_never_reaches_the_wire() {
        let error = provider()
            .read_file(&resolved(1, Some("pw")), "/pub/a\r\nQUIT")
            .await
            .expect_err("must be refused");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    fn reply(code: u16) -> RemoteError {
        map_ftp_reply_code(code, "test")
    }
    #[test]
    fn reply_codes_map_onto_distinguishable_kinds() {
        // 规格 §6.3 要求「没权限」与「不存在」不要混成一句话。
        // FTP 上两者常常同码，只能选一个 —— 断言这里选的哪一个，免得以后被人
        // 悄悄改掉而没人发现。
        assert_eq!(reply(530).kind, RemoteErrorKind::Auth);
        assert_eq!(reply(550).kind, RemoteErrorKind::NotFound);
        assert_eq!(reply(421).kind, RemoteErrorKind::Disconnected);
        assert_eq!(reply(500).kind, RemoteErrorKind::Protocol);
        assert_eq!(reply(502).kind, RemoteErrorKind::Protocol);
    }

    #[test]
    fn an_unexpected_success_code_is_not_treated_as_success() {
        // 「预期之外的回复」不能静默通过：那会让一个 250 之外的码
        // 看起来像成功，于是后面解析到空列表、界面上是个空目录。
        assert_eq!(reply(250).kind, RemoteErrorKind::Protocol);
    }

    #[test]
    fn pasv_address_is_always_overridden_by_the_control_host() {
        // RFC 2577 §3。NAT 后的服务器回 0.0.0.0 或内网地址是常态，
        // 照着连会失败或连到不相干的主机。
        let control = "nas.example.com";

        assert_eq!(
            pasv_host_to_use(std::net::IpAddr::from([192, 168, 1, 9]), control),
            control
        );
        assert_eq!(
            pasv_host_to_use(std::net::IpAddr::from([0, 0, 0, 0]), control),
            control
        );
        assert_eq!(
            pasv_host_to_use(std::net::IpAddr::from([10, 0, 0, 3]), control),
            control
        );
    }

    #[test]
    fn listing_falls_back_to_list_per_line() {
        // 服务器回了 `500` 不支持 MLSD 时，输出全是 ls 风格 ——
        // 少一行解析就少一条目录项，而目录项少**不会**报错。
        let text = "\
total 12
-rw-r--r-- 1 ftp ftp 1234 Jan 15  2023 a.txt
drwxr-xr-x 2 ftp ftp 4096 Jan 15  2023 pub
";

        let records = parse_listing(text);

        assert_eq!(records.len(), 2);
        assert_eq!(records[0].name, "a.txt");
        assert!(!records[0].is_dir);
        assert_eq!(records[1].name, "pub");
        assert!(records[1].is_dir);
    }

    #[test]
    fn listing_prefers_mlsd_and_survives_mixed_output() {
        // 真实服务器的输出经常是混合的：多半行是事实列，个别行是汇总或提示。
        // 只认一种格式会让另一种的行**静默消失**。
        let text = "\
type=file;size=10;modify=20230101120000; a.txt
total 1
type=dir;modify=20230101120000; pub
";

        let records = parse_listing(text);

        assert_eq!(records.len(), 2);
        assert_eq!(records[0].name, "a.txt");
        assert!(records[1].is_dir);
    }

    #[test]
    fn listing_drops_dot_entries() {
        let text = "\
type=dir;modify=20230101120000; .
type=dir;modify=20230101120000; ..
type=file;size=1; real.txt
";

        let records = parse_listing(text);

        assert_eq!(records.len(), 1);
        assert_eq!(records[0].name, "real.txt");
    }

    #[test]
    fn listing_of_an_empty_directory_is_empty_not_an_error() {
        // 空目录是**正常结果**。把它变成错误的话，界面会显示一条红色提示，
        // 而用户看到的其实就是一个真的空文件夹。
        assert!(parse_listing("").is_empty());
        assert!(parse_listing("total 0\n").is_empty());
    }

    #[test]
    fn control_characters_in_a_path_are_refused() {
        // FTP 控制通道是行文本协议。一条命令以 `\r\n` 结束，于是
        // 「路径 `/a\r\nDELE /b`」不是一条路径，而是**两条命令**。
        // 路径来自前端（用户能在地址栏敲出 `\r`），而 `normalize_remote_path`
        // 只挡 `.` / `..`，不挡控制字符 —— 所以这道闸必须在这里。
        assert!(contains_control_characters("/pub\r\nDELE /secret"));
        assert!(contains_control_characters("/pub\nQUIT"));
        assert!(contains_control_characters("/pub\0"));
        assert!(contains_control_characters("/pub\r"));

        // 正常路径不该被误伤。
        assert!(!contains_control_characters("/"));
        assert!(!contains_control_characters("/pub/文档 2024"));
        assert!(!contains_control_characters("/pub/naïve-folder"));
    }

    #[test]
    fn a_truncated_line_never_yields_a_nameless_entry() {
        // 「时间之后至少还要有一列名字」这道闸存在的理由。
        // 少了它，一条被截断的行会变成**名字为空**的条目 ——
        // 界面上是一行点不开、也删不掉的空白，而它还占着一条记录。
        let records = parse_listing("-rw-r--r-- 1 ftp ftp 1234 Jan 15  2023\n");

        assert!(records.is_empty());
    }
}
