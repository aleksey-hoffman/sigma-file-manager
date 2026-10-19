// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! SFTP 远程目录的读取。
//!
//! # 红线
//!
//! 本文件被 `cargo test --lib` 的测试二进制链接，**不得出现 `tauri::AppHandle`、
//! `tauri::async_runtime::*` 或 `tauri::` 的任何路径**。两个目录从 [`Path`] 进来，
//! 由 `commands.rs`（唯一允许碰 tauri 的适配层）解析。
//!
//! # 连接配置从哪来（2026-10-18 拍板：方案 C）
//!
//! provider 拿着两个目录，按 `connection_id` **自己去读连接表与 DPAPI 密码**。
//! 于是 `RemoteProvider::read_dir` 的签名一个字都不用改 —— 阶段 0 定它的时候
//! 没有人能预见到凭据会从哪来，现在这个形状恰好是对的：
//! 调用方给一个 id，provider 负责把这个 id 变成一次真实可用的连接。
//!
//! # 主机身份校验：与 `connection_test.rs` 的区别只有一处，但那处是全部
//!
//! `ProbeHandler::check_server_key` 无条件 `Ok(true)`，因为用户在测的是刚填进去的地址。
//! 本文件的 [`HostKeyHandler`] 走 [`known_hosts::decide`]：只有指纹与已信任记录
//! **一致**时才 `Ok(true)`；首次见到返回 `Ok(false)` 并把指纹带出去等用户确认；
//! 对不上同样 `Ok(false)`，但报的是 `HostKeyChanged`。
//!
//! `Ok(false)` 会让 russh 中止握手，于是 `connect_stream` 返回一个笼统的错误。
//! 所以**握手失败后必须先看观测槽再报错误** —— 否则「这台主机还没被信任过」
//! 会被报成「SSH 握手失败」，用户去查网络，而网络明明是好的。

use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use async_trait::async_trait;
use russh_sftp::client::SftpSession;
use russh_sftp::protocol::{FileAttributes, FileType, StatusCode};
use tokio::io::AsyncWriteExt;

use super::connection_test::{classify_ssh_handshake_error, read_ssh_banner, BannerCheck};
use super::error::{RemoteError, RemoteErrorKind};
use super::known_hosts::{self, HostKeyDecision, KnownHostEntry, TrustKind};
use super::path::{build_remote_path, normalize_remote_path, reject_path_control_characters};
use super::provider::{RemoteEntry, RemoteProvider};
use super::registry::{self, ResolvedConnection};
use super::transport::{self, Socks5CommandKind};

/// 一次远程列目录的总体上限。
///
/// SFTP 的 `readdir` 是**逐批**发包的，大目录可能来几十轮；russh-sftp 自己有单次超时，
/// 这里要的是「整体别把界面卡死」的那一层。
pub const SFTP_OPERATION_TIMEOUT: Duration = Duration::from_secs(30);

/// SFTP 的 `FileAttributes.mtime` 是 **u32 秒**，`RemoteEntry.modified_time` 约定是
/// **Unix 纪元毫秒**。忘了 ×1000 的后果是「按修改时间排序」在远程目录下变成一片
/// 随机顺序 —— 而且**不会报错**，所以它能一路活到真机验收。
///
/// 单独抽成函数就是为了让这一条能被一条断言钉死，而不是散落在 map 的某个角落。
pub fn sftp_seconds_to_unix_millis(seconds: Option<u32>) -> u64 {
    seconds.map(|value| u64::from(value) * 1_000).unwrap_or(0)
}

/// 点开头 = 隐藏。SFTP 没有「隐藏位」这种东西，POSIX 惯例就是它。
pub fn is_hidden_remote_name(name: &str) -> bool {
    name.starts_with('.')
}

/// 把 SFTP 状态码翻译成本项目的七分类。
///
/// 规格 §6.3 要求区分「没有权限」与「路径不存在」：在 FTP 上两者甚至可能同码，
/// 在 SFTP 上是分开的（`PermissionDenied` / `NoSuchFile`），不翻译的话用户只能
/// 看到一句笼统的失败。
pub fn map_sftp_status(status_code: StatusCode, detail: &str) -> RemoteError {
    match status_code {
        StatusCode::NoSuchFile => RemoteError::not_found(format!("远端没有这个路径：{detail}")),
        StatusCode::PermissionDenied => {
            RemoteError::permission(format!("远端拒绝了访问：{detail}"))
        }
        StatusCode::OpUnsupported => RemoteError::protocol(format!(
            "这台服务器不支持该操作：{detail}"
        )),
        // 其余状态码（Failure / BadMessage / Eof …）没有稳定语义，归到 Protocol
        // 而不是笼统的 Unknown —— 至少用户知道问题出在协议这一层。
        _ => RemoteError::protocol(format!("远端返回了一个无法归类的失败：{detail}")),
    }
}

/// russh-sftp 的错误 → 本项目的七分类。
pub fn map_sftp_error(error: russh_sftp::client::error::Error) -> RemoteError {
    use russh_sftp::client::error::Error as SftpError;

    match error {
        SftpError::Status(status) => {
            map_sftp_status(status.status_code, &status.error_message)
        }
        SftpError::Timeout => RemoteError::disconnected("远端没有在时限内回应"),
        SftpError::IO(detail) => RemoteError::disconnected(format!("与远端的连接中断：{detail}")),
        SftpError::Limited(detail) | SftpError::UnexpectedBehavior(detail) => {
            RemoteError::protocol(detail)
        }
        SftpError::UnexpectedPacket => RemoteError::protocol("远端发来了无法解析的数据包"),
    }
}

/// 一次握手里观测到的主机公钥与判定结果。
#[derive(Debug, Clone)]
struct HostKeyObservation {
    fingerprint: String,
    key_type: String,
    decision: HostKeyDecision,
}

impl HostKeyObservation {
    /// 指纹与算法名**成对**交给错误构造器：单给一串 `SHA256:…` 的话，
    /// 弹窗里用户无从判断那是什么算法。
    fn identity(&self) -> crate::remote::error::HostKeyIdentity {
        crate::remote::error::HostKeyIdentity::new(&self.fingerprint, &self.key_type)
    }
}

/// 只在指纹与已信任记录一致时放行。
struct HostKeyHandler {
    known_hosts: Arc<Vec<KnownHostEntry>>,
    host: String,
    port: u16,
    observed: Arc<Mutex<Option<HostKeyObservation>>>,
}

impl russh::client::Handler for HostKeyHandler {
    type Error = russh::Error;

    async fn check_server_key(
        &mut self,
        server_public_key: &russh::keys::PublicKeyOrCertificate,
    ) -> Result<bool, Self::Error> {
        let Ok((fingerprint, key_type)) = known_hosts::describe_server_key(server_public_key) else {
            return Ok(false);
        };

        let decision = known_hosts::decide(
            &self.known_hosts,
            &self.host,
            self.port,
            TrustKind::Ssh,
            &fingerprint,
        );
        let trusted = matches!(decision, HostKeyDecision::Trusted);

        if let Ok(mut slot) = self.observed.lock() {
            *slot = Some(HostKeyObservation {
                fingerprint,
                key_type,
                decision,
            });
        }

        Ok(trusted)
    }
}

/// 握手里看到的结论。`Ok(false)` 之后 russh 会中止，
/// 调用方靠它把「未知」与「变了」翻译成可操作的两条错误。
fn host_key_rejection(
    observed: &Arc<Mutex<Option<HostKeyObservation>>>,
    host: &str,
) -> Option<RemoteError> {
    let slot = observed.lock().ok().and_then(|guard| guard.clone())?;
    // **先取身份再匹配**：`slot.decision` 是按值匹配的，取完之后 slot 就被部分移动，
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

/// 连上并开好 SFTP 子系统。
///
/// 第二个返回值是 `Handle`，调用方必须把它活到本次操作为止 ——
/// 它是这个 SSH 会话的持有者，提前 drop 会让会话失去主人。
async fn open_sftp_session(
    resolved: &ResolvedConnection,
    known_hosts: Arc<Vec<KnownHostEntry>>,
) -> Result<(SftpSession, russh::client::Handle<HostKeyHandler>), RemoteError> {
    let connection = &resolved.connection;
    let host = connection.host.clone();
    let port = connection.port;

    let stream =
        transport::connect(&connection.proxy, &host, port, Socks5CommandKind::Connect).await?;

    // 复用 `connection_test.rs` 的预读：对「不是 SSH 服务」提前下结论，
    // 省掉 15 秒超时。不要在这里重写一遍。
    let stream = match read_ssh_banner(stream).await? {
        BannerCheck::Continue(stream) => stream,
        BannerCheck::NotSsh => {
            return Err(RemoteError::protocol(
                "该端口有回应，但对方没有报出 SSH 标识串 —— 多半不是 SSH 服务",
            ));
        }
    };

    let observed = Arc::new(Mutex::new(None));
    let handler = HostKeyHandler {
        known_hosts,
        host: host.clone(),
        port,
        observed: Arc::clone(&observed),
    };

    let mut session = match russh::client::connect_stream(
        Arc::new(russh::client::Config::default()),
        stream,
        handler,
    )
    .await
    {
        Ok(session) => session,
        Err(error) => {
            // **顺序要紧**：先看是不是我们自己因为主机密钥而拒绝的。
            // 反过来的话，「这台主机还没被信任过」会被报成「SSH 握手失败」，
            // 用户去查网络，而网络是好的。
            if let Some(rejection) = host_key_rejection(&observed, &host) {
                return Err(rejection);
            }

            return Err(classify_ssh_handshake_error(error));
        }
    };

    // 握手成功但结论不是 Trusted：理论上到不了这里（不放行就中止），
    // 仍然查一次 —— 少一次「用户永远弄不明白为什么连不上」的机会。
    if let Some(rejection) = host_key_rejection(&observed, &host) {
        return Err(rejection);
    }

    let Some(password) = resolved.password.as_deref() else {
        return Err(RemoteError::auth(
            "这条连接没有保存密码，无法通过 SSH 认证。请到设置页填写密码后重试。",
        ));
    };

    let username = if connection.username.trim().is_empty() {
        "anonymous".to_string()
    } else {
        connection.username.clone()
    };

    let auth = session
        .authenticate_password(username, password)
        .await
        .map_err(|error| RemoteError::auth(format!("SSH 认证失败：{error}")))?;

    if !auth.success() {
        return Err(RemoteError::auth("服务器拒绝了该用户名或密码"));
    }

    let channel = session
        .channel_open_session()
        .await
        .map_err(|error| RemoteError::protocol(format!("无法打开 SSH 会话通道：{error}")))?;

    channel
        .request_subsystem(true, "sftp")
        .await
        .map_err(|error| {
            RemoteError::protocol(format!("服务器不接受 SFTP 子系统请求：{error}"))
        })?;

    let sftp = SftpSession::new(channel.into_stream())
        .await
        .map_err(|error| RemoteError::protocol(format!("SFTP 子系统初始化失败：{error}")))?;

    Ok((sftp, session))
}

async fn with_timeout<T>(
    timeout: Duration,
    what: &'static str,
    work: impl std::future::Future<Output = Result<T, RemoteError>>,
) -> Result<T, RemoteError> {
    match tokio::time::timeout(timeout, work).await {
        Ok(result) => result,
        Err(_) => Err(RemoteError::disconnected(format!(
            "{what}超过 {} 秒仍未完成，已放弃这次操作",
            timeout.as_secs()
        ))),
    }
}

/// SFTP 的目录读取 provider。
///
/// **每次调用都重新建连。** 这是 2026-10-18 拍板方案 C 的直接后果：
/// 会话注册表（规格 §3.4 的连接池）留到后续阶段，届时再连同失效与空闲超时一起做。
/// 现在翻目录慢一点是可接受的代价，换来的是「关掉远程界面一定断开」这条需求
/// 今天就成立。
pub struct SftpRemoteProvider {
    user_data_dir: PathBuf,
    app_data_dir: PathBuf,
    known_hosts: Arc<Vec<KnownHostEntry>>,
    timeout: Duration,
}

impl SftpRemoteProvider {
    pub fn new(user_data_dir: &Path, app_data_dir: &Path) -> Self {
        Self::with_timeout(user_data_dir, app_data_dir, SFTP_OPERATION_TIMEOUT)
    }

    pub fn with_timeout(
        user_data_dir: &Path,
        app_data_dir: &Path,
        timeout: Duration,
    ) -> Self {
        // 已知主机在构造时读一次：握手回调里做文件 I/O 是把 IO 混进协议状态机，
        // 而且它可能在 russh 的任务里被调用，出了错没法往上传。
        //
        // 读失败（文件坏了 / 版本不认识）时退回「什么都没信任」：
        // 那会让下一次连接走到「首次见到，请确认指纹」，而不是带着一份
        // 不可信的信任记录继续连。
        let known_hosts = known_hosts::load(app_data_dir).unwrap_or_default();

        Self {
            user_data_dir: user_data_dir.to_path_buf(),
            app_data_dir: app_data_dir.to_path_buf(),
            known_hosts: Arc::new(known_hosts),
            timeout,
        }
    }

    /// trait 的五个方法共用的入参处理：挡控制字符 → 规范化路径 → 解析连接。
    ///
    /// **全部在开 socket 之前完成**：控制字符是本地判定，路径不合法也是。
    /// 让它们先走一遍网络，等于把「用户敲错了一个字符」变成一次 15 秒超时。
    fn prepare(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<(ResolvedConnection, String), RemoteError> {
        reject_path_control_characters(remote_path)?;

        let normalized = normalize_remote_path(remote_path).ok_or_else(|| {
            RemoteError::protocol(format!("远端路径含有不合法的段: {remote_path}"))
        })?;

        let resolved = registry::resolve_connection(
            &self.user_data_dir,
            &self.app_data_dir,
            connection_id,
        )?;

        Ok((resolved, normalized))
    }

    /// 打开连接并列出 `normalized` 下的直接子项。
    ///
    /// 调用前必须已经拿到 `ResolvedConnection` —— 解析连接要在开 socket 之前完成，
    /// 「连接 id 是空的」这种问题一秒都不该花在网络上。
    ///
    /// **公开出来是为了让 command 层解析一次、复用两次**（列目录与取元数据
    /// 共用同一次 DPAPI 解密）。
    pub async fn list(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        let connection_id = resolved.connection.id.clone();
        let parent = normalized.trim_end_matches('/').to_string();

        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            let listing = sftp.read_dir(normalized.to_string()).await;

            match listing {
                Ok(listing) => {
                    let mut entries = Vec::new();

                    for entry in listing {
                        let name = entry.file_name();
                        let attributes: &FileAttributes = &entry.metadata();

                        entries.push(RemoteEntry {
                            path: build_remote_path(&connection_id, &format!("{parent}/{name}"))
                                .ok_or_else(|| {
                                    RemoteError::unknown(format!(
                                        "拼不出合法的远端路径：{connection_id}{parent}/{name}"
                                    ))
                                })?,
                            is_hidden: is_hidden_remote_name(&name),
                            name,
                            is_dir: matches!(entry.file_type(), FileType::Dir),
                            is_symlink: matches!(entry.file_type(), FileType::Symlink),
                            size: attributes.len(),
                            // 少了这个 ×1000，「按修改时间排序」会变成随机顺序，而且不报错。
                            modified_time: sftp_seconds_to_unix_millis(attributes.mtime),
                        });
                    }

                    Ok(entries)
                }
                Err(error) => Err(map_sftp_error(error)),
            }
        };

        with_timeout(self.timeout, "读取远端目录", work).await
    }

    /// 单个条目的元数据。地址栏自动补全与「属性」都走这里。
    pub async fn stat(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<RemoteEntry, RemoteError> {
        let connection_id = resolved.connection.id.clone();
        let name = normalized
            .rsplit('/')
            .next()
            .filter(|segment| !segment.is_empty())
            .unwrap_or("/")
            .to_string();

        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            match sftp.metadata(normalized.to_string()).await {
                Ok(attributes) => Ok(RemoteEntry {
                    path: super::path::build_remote_path(&connection_id, normalized)
                        .ok_or_else(|| RemoteError::unknown("拼不出合法的远端路径"))?,
                    is_hidden: is_hidden_remote_name(&name),
                    name,
                    is_dir: matches!(attributes.file_type(), FileType::Dir),
                    is_symlink: matches!(attributes.file_type(), FileType::Symlink),
                    size: attributes.len(),
                    modified_time: sftp_seconds_to_unix_millis(attributes.mtime),
                }),
                Err(error) => Err(map_sftp_error(error)),
            }
        };

        with_timeout(self.timeout, "读取远端条目属性", work).await
    }

    /// 下载一个远程文件（整份进内存）。
    pub async fn read_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            sftp.read(normalized.to_string())
                .await
                .map_err(map_sftp_error)
        };

        with_timeout(self.timeout, "下载远程文件", work).await
    }

    /// 上传一个远程文件（**覆盖**语义）。
    ///
    /// 用 [`SftpSession::create`]（`CREATE | TRUNCATE | WRITE`）而不是
    /// [`SftpSession::write`]：后者只带 `WRITE`，文件不存在时不会创建它。
    /// 「不静默覆盖」由 `transfer` 在调用**之前**判重，这一层只负责「要覆盖就覆盖」。
    pub async fn write_file(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            let mut file = sftp
                .create(normalized.to_string())
                .await
                .map_err(map_sftp_error)?;

            file.write_all(&content).await.map_err(|error| {
                RemoteError::disconnected(format!("写入远端文件失败：{error}"))
            })?;
            file.close().await.map_err(|error| {
                RemoteError::disconnected(format!("关闭远端文件失败：{error}"))
            })?;

            Ok(())
        };

        with_timeout(self.timeout, "上传远程文件", work).await
    }

    /// 建一个远程目录。**已存在视为成功。**
    ///
    /// 「先问一次」而不是把失败当成功：服务器在「目录已存在」时回的是
    /// `SSH_FX_FAILURE`，而**真正的失败也是它** —— 吞掉它就等于把
    /// 「目录建不出来」伪装成成功。
    pub async fn make_dir(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<(), RemoteError> {
        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            if sftp
                .try_exists(normalized.to_string())
                .await
                .map_err(map_sftp_error)?
            {
                return Ok(());
            }

            sftp.create_dir(normalized.to_string())
                .await
                .map_err(map_sftp_error)
        };

        with_timeout(self.timeout, "创建远程目录", work).await
    }

    /// 设置权限位。`mode` 是八进制数值。
    pub async fn set_permissions(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
        mode: u32,
    ) -> Result<(), RemoteError> {
        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            // 只带权限位，不带文件类型位：SFTP 的 `setstat` 把这一栏原样交给
            // `chmod`，传 `0o100755` 进去等于让服务器去改一个带类型位的模式。
            let attributes = FileAttributes {
                permissions: Some(mode & 0o7777),
                ..FileAttributes::empty()
            };

            sftp.set_metadata(normalized.to_string(), attributes)
                .await
                .map_err(map_sftp_error)
        };

        with_timeout(self.timeout, "设置远程权限", work).await
    }

    /// 读取权限位（低 12 位）。
    ///
    /// `stat` **跟随**符号链接，所以指向一个文件的链接读到的是目标文件的权限。
    /// 递归 chmod 侧靠「不跟进链接」来保证不越界；这里读的则是用户点开
    /// 「权限设置」时看到的那一条 —— 用户想改的就是那个文件。
    pub async fn get_permissions(
        &self,
        resolved: &ResolvedConnection,
        normalized: &str,
    ) -> Result<Option<u32>, RemoteError> {
        let work = async {
            let (sftp, _session) =
                open_sftp_session(resolved, Arc::clone(&self.known_hosts)).await?;

            match sftp.metadata(normalized.to_string()).await {
                Ok(attributes) => Ok(attributes.permissions.map(|mode| mode & 0o7777)),
                // 「取不到就给 None」与 `remote_stat_dir_entry` 的既有契约一致：
                // 权限对话框要靠它显示「读不到当前权限」，而不是每次开框都炸。
                Err(error) => {
                    let mapped = map_sftp_error(error);

                    if mapped.kind == RemoteErrorKind::NotFound {
                        return Ok(None);
                    }

                    Err(mapped)
                }
            }
        };

        with_timeout(self.timeout, "读取远程权限", work).await
    }
}

#[async_trait]
impl RemoteProvider for SftpRemoteProvider {
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        // 调用方可能是用户手输的 `pub//docs`，先按路径族规则规范化。
        // **必须在开连接之前**：路径不合法是本地判定，一秒都不该花在网络上。
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;

        self.list(&resolved, &normalized).await
    }

    async fn read_file(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;
        self.read_file(&resolved, &normalized).await
    }

    async fn write_file(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;
        self.write_file(&resolved, &normalized, content).await
    }

    async fn make_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<(), RemoteError> {
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;
        self.make_dir(&resolved, &normalized).await
    }

    async fn set_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
        mode: u32,
    ) -> Result<(), RemoteError> {
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;
        self.set_permissions(&resolved, &normalized, mode).await
    }

    async fn get_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Option<u32>, RemoteError> {
        let (resolved, normalized) = self.prepare(connection_id, remote_path)?;
        self.get_permissions(&resolved, &normalized).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::path::build_remote_connection_path;
    use tempfile::TempDir;

    #[test]
    fn sftp_mtime_seconds_become_unix_millis() {
        // 1700000000 秒 = 2023-11-14T22:13:20Z。
        // 不乘 1000 的话，所有远端条目会挤在 1970 年 1 月 1 日附近，
        // 按修改时间排序看起来就是随机的，而且不会报错。
        assert_eq!(
            sftp_seconds_to_unix_millis(Some(1_700_000_000)),
            1_700_000_000_000
        );
        assert_eq!(sftp_seconds_to_unix_millis(Some(0)), 0);
        assert_eq!(sftp_seconds_to_unix_millis(Some(2)), 2_000);
    }

    #[test]
    fn a_missing_mtime_becomes_zero_rather_than_1970() {
        // 服务器不给 mtime 时。0 与本地目录「读不到时间就填 0」的既有做法一致，
        // 排序的稳定性由前端的次级排序键负责。
        assert_eq!(sftp_seconds_to_unix_millis(None), 0);
    }

    #[test]
    fn dot_names_are_hidden_and_others_are_not() {
        assert!(is_hidden_remote_name(".git"));
        assert!(is_hidden_remote_name(".bashrc"));
        assert!(!is_hidden_remote_name("website"));
        assert!(!is_hidden_remote_name("E"));
    }

    #[test]
    fn status_codes_map_to_distinguishable_kinds() {
        // 「没有权限」与「没有这个东西」必须分开 —— 用户处置完全不同。
        assert_eq!(
            map_sftp_status(StatusCode::NoSuchFile, "x").kind,
            RemoteErrorKind::NotFound
        );
        assert_eq!(
            map_sftp_status(StatusCode::PermissionDenied, "x").kind,
            RemoteErrorKind::Permission
        );
        assert_eq!(
            map_sftp_status(StatusCode::OpUnsupported, "x").kind,
            RemoteErrorKind::Protocol
        );
        assert_eq!(
            map_sftp_status(StatusCode::Failure, "x").kind,
            RemoteErrorKind::Protocol
        );
    }

    #[test]
    fn an_untrusted_host_is_reported_as_such_not_as_a_handshake_failure() {
        // 这一条是本文件存在的核心理由：Ok(false) 之后 russh 会中止握手，
        // 若不查观测槽，「首次见到这台主机」会被报成「SSH 握手失败」。
        let observed = Arc::new(Mutex::new(Some(HostKeyObservation {
            fingerprint: "SHA256:seen".to_string(),
            key_type: "Ed25519".to_string(),
            decision: HostKeyDecision::Unknown,
        })));

        let error = host_key_rejection(&observed, "nas").expect("must reject");

        assert_eq!(error.kind, RemoteErrorKind::HostKeyUnknown);
        assert_eq!(error.fingerprint.as_deref(), Some("SHA256:seen"));
        assert_eq!(error.expected_fingerprint, None);
    }

    #[test]
    fn a_changed_host_key_reports_both_fingerprints() {
        let observed = Arc::new(Mutex::new(Some(HostKeyObservation {
            fingerprint: "SHA256:new".to_string(),
            key_type: "Ed25519".to_string(),
            decision: HostKeyDecision::Changed {
                expected: "SHA256:old".to_string(),
            },
        })));

        let error = host_key_rejection(&observed, "nas").expect("must reject");

        assert_eq!(error.kind, RemoteErrorKind::HostKeyChanged);
        assert_eq!(error.fingerprint.as_deref(), Some("SHA256:new"));
        assert_eq!(error.expected_fingerprint.as_deref(), Some("SHA256:old"));
    }

    #[test]
    fn a_trusted_host_produces_no_rejection() {
        let observed = Arc::new(Mutex::new(Some(HostKeyObservation {
            fingerprint: "SHA256:known".to_string(),
            key_type: "Ed25519".to_string(),
            decision: HostKeyDecision::Trusted,
        })));

        assert!(host_key_rejection(&observed, "nas").is_none());
    }

    #[test]
    fn an_empty_observation_produces_no_rejection() {
        // 连密钥交换都没走到就失败（DNS 失败之类）时槽是空的，
        // 此时必须让调用方去报真正的网络错误，而不是编一条主机密钥错误。
        let observed = Arc::new(Mutex::new(None));

        assert!(host_key_rejection(&observed, "nas").is_none());
    }

    /// 条目路径必须走路径族，而不是字符串拼接。
    /// 尾斜杠若没被吃掉，`/pub/docs` 与 `/pub/docs/` 会变成两张卡片。
    #[test]
    fn entry_paths_go_through_the_path_family() {
        assert_eq!(
            build_remote_connection_path("conn-a").as_deref(),
            Some("sfm://remote/conn-a")
        );
        assert_eq!(
            build_remote_path("conn-a", "/pub/docs").expect("valid path"),
            "sfm://remote/conn-a/pub/docs"
        );
        assert_eq!(
            build_remote_path("conn-a", "/pub/docs/").expect("valid path"),
            "sfm://remote/conn-a/pub/docs"
        );
        assert_eq!(
            build_remote_path("conn-a", "/").expect("valid path"),
            "sfm://remote/conn-a"
        );
    }

    #[tokio::test]
    async fn a_missing_connection_fails_before_any_socket_is_opened() {
        let dir = TempDir::new().expect("temp dir");
        let provider = SftpRemoteProvider::with_timeout(
            dir.path(),
            dir.path(),
            Duration::from_secs(5),
        );

        // 连接表是空的：必须在任何一次 socket 之前就失败。
        let error = provider
            .read_dir("nobody", "/")
            .await
            .expect_err("must fail");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn an_invalid_remote_path_is_rejected_before_any_connection_is_opened() {
        // `..` 段会让两端的路径解析走出不同结果，所以入口就拒。
        let dir = TempDir::new().expect("temp dir");
        let provider = SftpRemoteProvider::new(dir.path(), dir.path());

        let error = provider
            .read_dir("conn-a", "/pub/../etc")
            .await
            .expect_err("must fail");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    #[tokio::test]
    async fn the_provider_satisfies_the_trait_object_bound() {
        // 阶段 0 用一条测试锁住 dyn 兼容；新增 provider 必须同样能被当 trait object 用。
        let dir = TempDir::new().expect("temp dir");
        let provider: Box<dyn RemoteProvider> =
            Box::new(SftpRemoteProvider::new(dir.path(), dir.path()));

        assert!(provider.read_dir("nobody", "/").await.is_err());
    }

    /// 连接表是空的 ⇒ 任何先走 `resolve_connection` 的实现都会得到 `NotFound`。
    /// 拿到 `Protocol` 就证明控制字符那道闸真的在**开 socket 之前**。
    ///
    /// 走 `RemoteProvider::` 显式路径而不是 `provider.read_file(..)` ——
    /// provider 上还有一个**同名固有方法**（签名第一个参数是 `ResolvedConnection`），
    /// 裸调用会被它抢走，测的就不是 trait 那条路了。
    #[tokio::test]
    async fn a_control_character_in_the_path_never_reaches_the_wire() {
        let dir = TempDir::new().expect("temp dir");
        let provider = SftpRemoteProvider::new(dir.path(), dir.path());

        let error = RemoteProvider::read_file(&provider, "conn-a", "/pub/a\r\nQUIT")
            .await
            .expect_err("must be refused");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    #[tokio::test]
    async fn every_new_trait_method_fails_before_a_socket_when_the_connection_is_unknown() {
        // 这些方法将来都会各自长出实现；这条一次性把它们钉在
        // 「先解析连接、再开 socket」这个顺序上 ——
        // 顺序反了的话，用户敲错一个连接 id 要等 15 秒超时才知道。
        let dir = TempDir::new().expect("temp dir");
        let provider = SftpRemoteProvider::new(dir.path(), dir.path());

        assert!(RemoteProvider::read_file(&provider, "nobody", "/a.txt")
            .await
            .is_err());
        assert!(RemoteProvider::write_file(&provider, "nobody", "/a.txt", b"x".to_vec())
            .await
            .is_err());
        assert!(RemoteProvider::make_dir(&provider, "nobody", "/d").await.is_err());
        assert!(RemoteProvider::set_permissions(&provider, "nobody", "/a.txt", 0o755)
            .await
            .is_err());
        assert!(RemoteProvider::get_permissions(&provider, "nobody", "/a.txt")
            .await
            .is_err());
    }
}
