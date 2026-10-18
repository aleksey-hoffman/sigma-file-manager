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
use super::provider::{RemoteEntry, RemoteProvider};
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
struct FtpControl<S> {
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
    async fn command(&mut self, command: &str, accepted: &[u16]) -> Result<String, RemoteError> {
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
    async fn read_greeting(&mut self) -> Result<String, RemoteError> {
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
    async fn open_data_channel(&mut self) -> Result<TransportStream, RemoteError> {
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
    async fn finish_transfer(&mut self) -> Result<(), RemoteError> {
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

        let mut control = FtpControl {
            stream,
            host: connection.host.clone(),
            proxy: connection.proxy.clone(),
            buffer: Vec::new(),
        };

        // 欢迎语。拒绝一个「不是 FTP 服务」的对端比让它在 USER 上含糊失败更有用。
        control.read_greeting().await?;

        let username = if connection.username.trim().is_empty() {
            "anonymous".to_string()
        } else {
            connection.username.clone()
        };

        // USER 可能回 230（一次就登录成功），也可能回 331 让你接着发 PASS。
        let user_reply = control.command(&format!("USER {username}"), &[230, 331]).await?;

        if super::connection_test::parse_ftp_reply_code(&user_reply) != Some(230) {
            let Some(password) = resolved.password.as_deref() else {
                return Err(RemoteError::auth(
                    "这条连接没有保存密码，服务器要求登录密码。请到设置页填写后重试。",
                ));
            };

            control.command(&format!("PASS {password}"), &[230]).await?;
        }

        // TYPE I：`MLSD`/`LIST` 本身是文本，但沿用 ASCII 会让某些服务器对
        // 含非 ASCII 文件名的目录行为异常。统一按二进制走。
        control.command("TYPE I", &[200]).await?;

        Ok(control)
    }

    /// 打开一条控制通道，跑 `listing_command`，把结果交给 `parse`。
    async fn with_listing<T>(
        &self,
        resolved: &ResolvedConnection,
        remote_path: &str,
        listing_command: &str,
        parse: impl Fn(&str) -> T,
    ) -> Result<T, RemoteError> {
        let work = async {
            let mut control = Self::login(resolved).await?;

            // 根目录不能 CWD —— 多数服务器对 `CWD /` 的处理不一致，
            // 而 `MLSD /` 本身是合法的，直接用它。
            if remote_path != "/" {
                control.command(&format!("CWD {remote_path}"), &[250]).await?;
            }

            let mut data = control.open_data_channel().await?;

            control
                .stream
                .write_all(format!("{listing_command}\r\n").as_bytes())
                .await
                .map_err(|error| {
                    RemoteError::disconnected(format!("发送 {listing_command} 失败：{error}"))
                })?;

            control.stream.flush().await.map_err(|error| {
                RemoteError::disconnected(format!("发送 {listing_command} 失败：{error}"))
            })?;

            // `read_listing` 按值吃掉 data 连接 —— 读满即 drop，
            // 服务器那边才能干净地送出 `226`，我们随后读到的就是它。
            let bytes = read_listing(data).await?;

            control.finish_transfer().await?;

            let text = String::from_utf8_lossy(&bytes).into_owned();

            let _ = control.command("QUIT", &[221, 226]).await;

            Ok(parse(&text))
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
        let records = self
            .with_listing(resolved, normalized, "MLSD", parse_listing)
            .await?;

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
