// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程凭据的 Tauri command 层。
//!
//! # 分层，以及为什么这里能碰 tauri 而 `credentials.rs` 不能
//!
//! `credentials.rs` 里的 `protect` / `unprotect` / `load_credential` / `save_credential` /
//! `delete_credential` **就是本项目的阻塞内核** —— 它们不依赖任何 tauri 类型，
//! 单测直接调它们。本文件是唯一的 tauri 适配层，只做三件事：
//! 解析 `app_data_dir`、把调用丢进 `spawn_blocking`、把 `RemoteError` 原样返回。
//!
//! # 红线：单测**永远不要调用本文件里的任何函数**
//!
//! `tauri::async_runtime::spawn_blocking` 会单态化出 `GlobalRuntime<Wry>`，
//! 把 tao 整条窗口链拖进测试二进制；测试二进制没有 application manifest 声明
//! comctl32 v6，`TaskDialogIndirect` 解析不到，进程在**加载阶段**以
//! `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，
//! 且报错与本模块毫无关系。
//!
//! 现在没崩，是因为**没有任何单测调用这三个 command**：linker 把没人引用的
//! `spawn_blocking` 实例整个丢掉了。`dir_reader/commands.rs` 同理。
//! 这条安全是**有条件的**：一旦有人写了个「跑一下 command 看返回什么」的测试，
//! 整个测试套件会在加载期崩掉，且看不出是谁干的。
//! 要测逻辑就测 `credentials.rs` 的内核，不要测这里。
//! 完整背景见 `src-tauri/src/remote/mod.rs` 顶部与 `src-tauri/src/dir_reader.rs`。

use std::collections::HashSet;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::dir_reader::{DirContents, DirEntry};

use super::connection::RemoteProtocol;
use super::connection_test::{self, ConnectionTestReport, ProbeTarget};
use super::credentials;
use super::dir_adapter;
use super::error::{RemoteError, RemoteErrorKind};
use super::ftp_provider::FtpRemoteProvider;
use super::ftps_provider::FtpsRemoteProvider;
use super::known_hosts::{self, KnownHostEntry, TrustKind};
use super::path::{normalize_remote_path, parse_remote_path};
use super::provider::{RemoteEntry, RemoteProvider};
use super::registry::{self, ResolvedConnection};
use super::sftp_provider::SftpRemoteProvider;
use super::transfer::{self, RemoteChmodReport, RemoteTransferReport, TransferProgressSink};
use super::transport::ProxyConfig;

/// 凭据存档与 `mcp-access.json` 同级，都在 app-data 目录根，不在 `user-data/` 下。
///
/// FORK-MODIFICATION 2026-10-20：移植上游 8908e214。
/// 走后端统一解析点，隔离的 e2e 实例才不会读到用户真实的远程凭据。
fn app_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, RemoteError> {
    crate::app_dirs::app_data_dir(app).map_err(|error| {
        RemoteError::unknown(format!("解析应用数据目录失败: {error}"))
    })
}

/// `user-data/` 目录。与前端 `setCustomPaths()` 的算法一致：
/// `appDataDir + userStorageFiles.userDataDirName`。
///
/// **两处必须同源。** 前端 store 与 Rust 的 `registry.rs` 读的是同一个文件，
/// 路径算错的表现是「Rust 说没有这条连接」，而界面上明明有。
fn user_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, RemoteError> {
    let app_data_dir = app_data_dir(app)?;

    Ok(app_data_dir.join(
        &crate::user_storage_files_config::user_storage_files_config().user_data_dir_name,
    ))
}

/// 加密并保存一个凭据。`key` 由前端给，通常就等于连接 id。
///
/// 密码**不会**经过这条链路回到前端：只写不读回，设置页只知道「有没有存过」。
#[tauri::command]
pub async fn remote_save_credential(
    app: tauri::AppHandle,
    key: String,
    secret: String,
) -> Result<(), RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        credentials::save_credential(&app_data_dir, &key, &secret)
    })
    .await
    .map_err(|join_error| RemoteError::unknown(format!("保存远程凭据的后台任务失败: {join_error}")))?
}

/// 读回一个凭据。返回 `null` 表示「没存过」。
///
/// 阶段 1 的设置页用不到它（编辑连接时只显示「已保存密码」，不把明文取回前端）；
/// 留着是为了阶段 2 的「测试连接」按钮，以及将来排查 DPAPI 存档。
#[tauri::command]
pub async fn remote_load_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<Option<String>, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || credentials::load_credential(&app_data_dir, &key))
        .await
        .map_err(|join_error| RemoteError::unknown(format!("读取远程凭据的后台任务失败: {join_error}")))?
}

/// 删掉一个凭据。键不存在是成功的空操作。
#[tauri::command]
pub async fn remote_delete_credential(
    app: tauri::AppHandle,
    key: String,
) -> Result<(), RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || {
        credentials::delete_credential(&app_data_dir, &key)
    })
    .await
    .map_err(|join_error| RemoteError::unknown(format!("删除远程凭据的后台任务失败: {join_error}")))?
}

/// 「测试连接」的请求体。
///
/// **刻意用扁平结构而不是 `RemoteConnection`**：测试的是**表单里还没保存的东西**，
/// 既有连接可能没有 `id`、可能连本地目录都还没填。复用保存模型会逼调用方
/// 先造一条假连接出来。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTestConnectionRequest {
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    /// `null` / 缺省 = 这次不打算提交凭据（编辑既有连接且密码框留空）。
    #[serde(default)]
    pub password: Option<String>,
    /// `null` / 缺省 = 直连。**不给 `ProxyConfig` 实现 `Default`**：
    /// 「默认代理」等于「默认直连」是个容易被误当成「按全局设置」的语义，
    /// 这里宁可让调用方显式写 `null`。
    #[serde(default)]
    pub proxy: Option<ProxyConfig>,
}

/// 真去连一次，把结论报回来。
///
/// **这是一个纯读操作**：它不写凭据、不写连接表、不改任何盘上的东西。
/// 密码由调用方准备好传进来（前端在「密码框留空但这条连接存过密码」时，
/// 会先用 `remote_load_credential` 把它取出来）。所以这里也**不能**去动
/// DPAPI 存档 —— 测试一次不该改变下次测试的输入。
///
/// 只有入参非法才返回 `Err`；「连不上」「密码错」都是 `Ok` 里带结论，
/// 理由见 `connection_test` 模块顶部。
#[tauri::command]
pub async fn remote_test_connection(
    request: RemoteTestConnectionRequest,
) -> Result<ConnectionTestReport, RemoteError> {
    let target = ProbeTarget {
        protocol: request.protocol,
        host: request.host,
        port: request.port,
        username: request.username,
        password: request.password,
        proxy: request.proxy.unwrap_or(ProxyConfig::Direct),
    };

    connection_test::probe(&target).await
}

/// 把 `sfm://remote/<id>/<path>` 拆成 `(连接 id, 规范化远端路径)`。
///
/// **command 的入参校验在这里，不在 provider 里。** 前端可能传来任何东西
/// （地址栏是用户手输的），而 provider 拿到的必须是已经过路径族规范化的值。
fn split_remote_path(path: &str) -> Result<(String, String), RemoteError> {
    parse_remote_path(path)
        .map(|parsed| (parsed.connection_id, parsed.remote_path))
        .ok_or_else(|| RemoteError::protocol(format!("不是一条合法的远程路径：{path}")))
}

/// 解析连接：读连接表 + DPAPI 解密。**这是阻塞的部分**（文件 I/O + DPAPI），
/// 所以必须走 `spawn_blocking`；网络部分则直接在 Tauri 的异步运行时上 await，
/// 两段混在同一个 `spawn_blocking` 里会造出一个嵌套运行时。
async fn resolve_connection_blocking(
    user_data_dir: PathBuf,
    app_data_dir: PathBuf,
    connection_id: String,
) -> Result<registry::ResolvedConnection, RemoteError> {
    tauri::async_runtime::spawn_blocking(move || {
        registry::resolve_connection(&user_data_dir, &app_data_dir, &connection_id)
    })
    .await
    .map_err(|join_error| {
        RemoteError::unknown(format!("解析远程连接的后台任务失败: {join_error}"))
    })?
}

/// 按协议挑 provider。
///
/// FTPS 走 `ftps_provider::PinnedCertificate`：只有证书指纹与已信任记录**一致**
/// 时才放行，首次见到会让握手失败并带上指纹等用户确认。
/// **不是** `connection_test.rs` 的 `AcceptAnyCertificate` —— 那一个只用于
/// 「测试连接」，用在真正读目录上等于交付一个静默的中间人窗口。
async fn list_with_protocol(
    resolved: &ResolvedConnection,
    user_data_dir: &Path,
    app_data_dir: &Path,
    remote_path: &str,
) -> Result<Vec<RemoteEntry>, RemoteError> {
    match resolved.connection.protocol {
        RemoteProtocol::Sftp => {
            SftpRemoteProvider::new(user_data_dir, app_data_dir)
                .list(resolved, remote_path)
                .await
        }
        RemoteProtocol::Ftp => {
            FtpRemoteProvider::new(user_data_dir, app_data_dir)
                .list(resolved, remote_path)
                .await
        }
        RemoteProtocol::FtpsExplicit | RemoteProtocol::FtpsImplicit => {
            FtpsRemoteProvider::new(user_data_dir, app_data_dir)
                .list(resolved, remote_path)
                .await
        }
    }
}

async fn stat_with_protocol(
    resolved: &ResolvedConnection,
    user_data_dir: &Path,
    app_data_dir: &Path,
    remote_path: &str,
) -> Result<RemoteEntry, RemoteError> {
    match resolved.connection.protocol {
        RemoteProtocol::Sftp => {
            SftpRemoteProvider::new(user_data_dir, app_data_dir)
                .stat(resolved, remote_path)
                .await
        }
        // 明文 FTP 与 FTPS 的 `stat` 都是「列父目录再按名字找」，
        // 协议部分完全一样 —— 所以这里直接复用同一个 provider。
        RemoteProtocol::Ftp | RemoteProtocol::FtpsExplicit | RemoteProtocol::FtpsImplicit => {
            if resolved.connection.protocol == RemoteProtocol::Ftp {
                FtpRemoteProvider::new(user_data_dir, app_data_dir)
                    .stat(resolved, remote_path)
                    .await
            }
            else {
                FtpsRemoteProvider::new(user_data_dir, app_data_dir)
                    .stat(resolved, remote_path)
                    .await
            }
        }
    }
}

/// 列出远端目录。前端只传 `path` —— 连接配置与密码由 Rust 自己解析
/// （2026-10-18 拍板的方案 C），明文密码一次都不跨 IPC。
#[tauri::command]
pub async fn remote_read_dir(app: tauri::AppHandle, path: String) -> Result<DirContents, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let entries = list_with_protocol(&resolved, &user_data_dir, &app_data_dir, &remote_path).await?;

    // 回显**规范化之后**的路径：用户手输 `pub//docs` 之后，
    // 地址栏要显示它实际去到的地方。
    let canonical =
        crate::remote::path::build_remote_path(&connection_id, &remote_path).unwrap_or(path);

    dir_adapter::to_dir_contents(canonical, entries)
}

/// 取单个远端条目的元数据。取不到时**返回 `null`**，与本地
/// `get_dir_entry_with_timeout` 在 `resolveDirEntry` 里的既有语义一致。
#[tauri::command]
pub async fn remote_stat_dir_entry(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<DirEntry>, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id).await?;

    match stat_with_protocol(&resolved, &user_data_dir, &app_data_dir, &remote_path).await {
        Ok(entry) => Ok(Some(dir_adapter::to_dir_entry(&entry))),
        // 「取不到就给 null」是既有契约：地址栏的自动补全靠它判断路径是否存在。
        // 把错误抛出去会让每一次补全失败都变成一次未捕获异常。
        Err(error) if error.kind == RemoteErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 列出已信任的 SSH 主机。设置页的「查看 / 删除」用它。
#[tauri::command]
pub async fn remote_list_known_hosts(app: tauri::AppHandle) -> Result<Vec<KnownHostEntry>, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || known_hosts::load(&app_data_dir))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("读取已信任主机列表的后台任务失败: {join_error}"))
        })?
}

/// 用户核对完指纹、点了「信任」之后调用。
///
/// **指纹由后端从第一次连接的观测里拿不到，所以这里必须由前端把指纹原样带回来。**
/// 后端只负责按 `(host, port, kind)` 覆盖写入。
#[tauri::command]
pub async fn remote_trust_host(
    app: tauri::AppHandle,
    host: String,
    port: u16,
    fingerprint: String,
    key_type: String,
    kind: TrustKind,
) -> Result<(), RemoteError> {
    if host.trim().is_empty() {
        return Err(RemoteError::protocol("不能信任一个没有地址的主机"));
    }

    if !known_hosts::fingerprint_matches_kind(&fingerprint, kind) {
        return Err(RemoteError::protocol(
            known_hosts::fingerprint_shape_hint(kind),
        ));
    }

    let app_data_dir = app_data_dir(&app)?;
    let entry = KnownHostEntry {
        host,
        port,
        fingerprint,
        key_type,
        added_at: 0,
        kind,
    };

    tauri::async_runtime::spawn_blocking(move || known_hosts::trust(&app_data_dir, entry))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("写入已信任主机列表的后台任务失败: {join_error}"))
        })?
}

/// 忘记一台主机的**某一种**信任。密钥变了之后用户必须先走到这一步才能重新信任。
#[tauri::command]
pub async fn remote_forget_host(
    app: tauri::AppHandle,
    host: String,
    port: u16,
    kind: TrustKind,
) -> Result<bool, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;

    tauri::async_runtime::spawn_blocking(move || known_hosts::forget(&app_data_dir, &host, port, kind))
        .await
        .map_err(|join_error| {
            RemoteError::unknown(format!("删除已信任主机记录的后台任务失败: {join_error}"))
        })?
}

// ---------------------------------------------------------------------------
// 上传 / 下载 / 权限设置
//
// 这一段是 `transfer.rs`（无 tauri 的内核）与 tauri 的接缝，接缝只有三件事：
// 解析两个目录、把路径拆成 `(连接 id, 远端路径)`、按协议挑 provider。
// ---------------------------------------------------------------------------

/// 按协议挑一个 provider，交给 `transfer` 去跑。
///
/// 刻意返回 `Box<dyn RemoteProvider>` 而不是逐协议分派：`transfer` 里的递归规则
/// 三种协议完全一样（见该文件顶部），在这里分派一次就等于把那套规则复制三份。
///
/// `pub(crate)` 是为了给 `compare` 模块复用 —— 比较引擎也要按协议挑 provider，
/// 两处各写一遍分派就等于同一个协议清单有两份，改一处漏一处。
pub(crate) async fn provider_with_protocol(
    protocol: RemoteProtocol,
    user_data_dir: &Path,
    app_data_dir: &Path,
) -> Box<dyn RemoteProvider> {
    match protocol {
        RemoteProtocol::Sftp => {
            Box::new(SftpRemoteProvider::new(user_data_dir, app_data_dir))
        }
        RemoteProtocol::Ftp => Box::new(FtpRemoteProvider::new(user_data_dir, app_data_dir)),
        RemoteProtocol::FtpsExplicit | RemoteProtocol::FtpsImplicit => {
            Box::new(FtpsRemoteProvider::new(user_data_dir, app_data_dir))
        }
    }
}

/// 上传：**一批**本地路径 → 远端目录（`sfm://remote/<id>/<path>`）。
///
/// 目录会**递归**传整棵子树。本地符号链接既不跟随也不复制，原样进 `failures`。
///
/// ## 覆盖策略
///
/// `overwrite_paths` 里的本地路径允许**覆盖**远端同名项；
/// 其余的同名项进 `skipped`（带 `already_exists` 原因），**绝不静默覆盖**。
/// 这份名单由前端的冲突对话框决定 —— 用户没点头就不许覆盖。
///
/// ## 进度
///
/// 传输过程中通过 `remote-transfer-progress` 事件回报进度，
/// 载荷带 `jobId`，前端据此把事件对上这一次传输。
#[tauri::command]
pub async fn remote_upload_paths(
    app: tauri::AppHandle,
    local_paths: Vec<String>,
    remote_dir: String,
    overwrite_paths: Vec<String>,
    job_id: String,
) -> Result<RemoteTransferReport, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&remote_dir)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    let paths: Vec<PathBuf> = local_paths.iter().map(PathBuf::from).collect();
    let overwrite: HashSet<String> = overwrite_paths.into_iter().collect();
    let sink = progress_sink(&app, job_id);

    transfer::upload_many(
        &*provider,
        &connection_id,
        transfer::UploadRequest {
            local_paths: &paths,
            remote_dir: &remote_path,
            overwrite_paths: &overwrite,
            progress: Some(sink),
        },
    )
    .await
}

/// 下载：**一批**远端路径 → 本地目录（本地绝对路径）。
///
/// 与上传对称：远程符号链接不下载，本地同名文件进 `skipped`
/// （除非它在 `overwrite_paths` 里）。
#[tauri::command]
pub async fn remote_download_paths(
    app: tauri::AppHandle,
    remote_paths: Vec<String>,
    local_dir: String,
    overwrite_paths: Vec<String>,
    job_id: String,
) -> Result<RemoteTransferReport, RemoteError> {
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    // 先把「覆盖名单」拆成 (连接 id, 远端路径)：
    // 后端比的是**规范化后的远端路径**（`/pub/readme.txt`），
    // 而前端手里通常是 `sfm://remote/<id>/pub/readme.txt`。
    // 两种写法都收下，省得前端自己拼。
    let mut overwrite: HashSet<String> = HashSet::new();

    for raw in overwrite_paths {
        overwrite.insert(raw.clone());

        if let Some(parsed) = parse_remote_path(&raw) {
            if let Some(normalized) = normalize_remote_path(&parsed.remote_path) {
                overwrite.insert(normalized);
            }
        }
    }

    let mut connection_id = String::new();
    let mut normalized_paths: Vec<String> = Vec::with_capacity(remote_paths.len());

    for raw in &remote_paths {
        let (id, remote_path) = split_remote_path(raw)?;
        let normalized = normalize_remote_path(&remote_path).ok_or_else(|| {
            RemoteError::protocol(format!("远端路径不合法：{remote_path}"))
        })?;

        if connection_id.is_empty() {
            connection_id = id;
        }

        normalized_paths.push(normalized);
    }

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    let sink = progress_sink(&app, job_id);
    let local_dir = PathBuf::from(local_dir);

    transfer::download_many(
        &*provider,
        &connection_id,
        transfer::DownloadRequest {
            remote_paths: &normalized_paths,
            local_dir: &local_dir,
            overwrite_paths: &overwrite,
            progress: Some(sink),
        },
    )
    .await
}

/// 传输进度事件的载荷。
///
/// **字段名是 camelCase**：前端直接吃这份 JSON，
/// 不做 snake_case → camelCase 的换算。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct RemoteTransferProgressPayload {
    job_id: String,
    files_done: u64,
    files_total: u64,
    bytes_done: u64,
    bytes_total: u64,
    current_path: String,
}

/// 造一个把传输进度发成 Tauri 事件的汇聚器。
///
/// 事件名固定为 `remote-transfer-progress`，载荷带 `jobId` ——
/// 前端可能同时有多个传输在跑，靠 `jobId` 区分。
fn progress_sink(app: &tauri::AppHandle, job_id: String) -> TransferProgressSink {
    let emitter = app.clone();

    TransferProgressSink::new(move |progress| {
        let payload = RemoteTransferProgressPayload {
            job_id: job_id.clone(),
            files_done: progress.files_done,
            files_total: progress.files_total,
            bytes_done: progress.bytes_done,
            bytes_total: progress.bytes_total,
            current_path: progress.current_path.clone(),
        };

        let _ = emitter.emit("remote-transfer-progress", payload);
    })
}

/// 权限设置。`mode` 是八进制数值（如 `0755` 传 `0o755` = `493`）。
///
/// 递归时对目录自身 + 全部后代设同一个 `mode`，**不跟随符号链接**。
///
/// **FTP / FTPS 在这里就以 `Err` 返回**，而不是进 `failures`：
/// 「这个协议不支持改权限」不是一次「部分成功的批量操作」，
/// 让用户在一个「成功」的报告里去找失败项，只会把这件事拖成下一次困惑。
#[tauri::command]
pub async fn remote_chmod(
    app: tauri::AppHandle,
    remote_path: String,
    mode: u32,
    recursive: bool,
) -> Result<RemoteChmodReport, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&remote_path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    if resolved.connection.protocol != RemoteProtocol::Sftp {
        return Err(transfer::unsupported_set_permissions(
            match resolved.connection.protocol {
                RemoteProtocol::Ftp => "FTP",
                _ => "FTPS",
            },
        ));
    }

    let provider = provider_with_protocol(RemoteProtocol::Sftp, &user_data_dir, &app_data_dir).await;

    transfer::chmod(&*provider, &connection_id, &remote_path, mode, recursive).await
}

/// 读取远程条目的权限位（低 12 位）。
///
/// **取不到时返回 `Ok(None)`，不要返回 `Err`** —— 与既有 `remote_stat_dir_entry`
/// 「取不到就给 null」的契约一致：前端用它判断「这个连接支不支持改权限」，
/// 返回错误会让每一次打开对话框都变成一次未捕获异常。
///
/// FTP / FTPS 没有可靠的权限位 ⇒ 一律返回 `Ok(None)`。
#[tauri::command]
pub async fn remote_get_permissions(
    app: tauri::AppHandle,
    path: String,
) -> Result<Option<u32>, RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    match provider.get_permissions(&connection_id, &remote_path).await {
        Ok(permissions) => Ok(permissions),
        Err(error) if error.kind == RemoteErrorKind::NotFound => Ok(None),
        Err(error) => Err(error),
    }
}

/// 删除一个远程文件或目录。
///
/// `is_dir` 决定走哪条命令（SFTP 的 `remove` / `rmdir`；FTP 的 `DELE` / `RMD`）。
///
/// **目录必须为空** —— 两种协议都没有递归删除。目录非空时服务器会拒绝，
/// 这里把错误原样带回去，前端据此提示「先清空这个目录」。
///
/// **权限不足时返回 `Err(kind = "permission")`**（SFTP 能分清；
/// FTP 的 `550` 分不清「没权限」与「目录非空」，按 `not_found` 报）。
/// 前端据此显示「这个账户没有删除权限」—— **菜单项本身保留**，
/// 不因为「现在删不了」就把入口藏起来。
#[tauri::command]
pub async fn remote_remove_path(
    app: tauri::AppHandle,
    remote_path: String,
    is_dir: bool,
) -> Result<(), RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&remote_path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    provider.remove_path(&connection_id, &remote_path, is_dir).await
}

/// 在远程目录里**新建一个目录**。
///
/// `remote_path` 是**要创建的目录的完整路径**（`sfm://remote/<连接id>/<父目录>/<新名字>`）。
///
/// 「已存在视为成功」是 `RemoteProvider::make_dir` 的约定 —— 但实现方必须
/// **真的确认过**（FTP 侧是失败之后列一次父目录，SFTP 侧是 `try_exists`），
/// 不是把 `550` 当成成功。
///
/// **只支持建目录，不支持建空文件** —— 规格 §1：SFTP 没有 `CREATE`，
/// FTP 的 `STOR` 需要先有本地文件，强行实现会得到一个行为不可预期的功能。
#[tauri::command]
pub async fn remote_make_dir(
    app: tauri::AppHandle,
    remote_path: String,
) -> Result<(), RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&remote_path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    // 父目录必须已存在、名字必须是单个路径段 —— 这两条在**开连接之前**判。
    let (parent, name) = super::path::split_remote_parent_and_name(&remote_path)?;
    super::path::validate_remote_entry_name(&name)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    // 拼回完整路径再交给 provider：provider 拿到的一律是规范化过的完整路径。
    let target = super::path::join_remote_parent_and_name(&parent, &name);

    provider.make_dir(&connection_id, &target).await
}

/// 把一个远程条目**在原目录内**改名。
///
/// `from_path` 是被改名的条目（完整 `sfm://remote/...` 路径），
/// `new_name` 是**新名字**（不是完整路径）。
///
/// 传「名字」而不是「目标路径」是有意的：改名就是**在原目录内换个名字**，
/// 不是移动。目标路径由后端从 `from_path` 的父目录推导，
/// 这样「跨目录移动」这个后果更重的操作在协议层就不可能被误触发。
///
/// **断线时不自动重放**（规格 §6.2）：写操作失败即停，把控制权交回用户。
///
/// **权限不足时返回 `Err(kind = "permission")`**（SFTP 能分清；
/// FTP 的 `550` 分不清「没权限」与「已存在」，按 `not_found` 报）。
#[tauri::command]
pub async fn remote_rename_path(
    app: tauri::AppHandle,
    from_path: String,
    new_name: String,
) -> Result<(), RemoteError> {
    let (connection_id, remote_path) = split_remote_path(&from_path)?;
    let app_data_dir = app_data_dir(&app)?;
    let user_data_dir = user_data_dir(&app)?;

    // 名字非法是本地判定 —— 一秒都不该花在网络上。
    super::path::validate_remote_entry_name(&new_name)?;

    let resolved =
        resolve_connection_blocking(user_data_dir.clone(), app_data_dir.clone(), connection_id.clone())
            .await?;

    let provider =
        provider_with_protocol(resolved.connection.protocol, &user_data_dir, &app_data_dir).await;

    provider
        .rename_path(&connection_id, &remote_path, &new_name)
        .await
}

#[cfg(test)]
mod tests {
    /// 阶段 1 的远程 command。**改这个数组必须同步改 `lib.rs` 的
    /// `generate_handler!`**，`registered_remote_commands_are_wired_into_the_invoke_handler`
    /// 会当场抓出漏掉的那一个。
    const REMOTE_COMMANDS: &[&str] = &[
        "remote_save_credential",
        "remote_load_credential",
        "remote_delete_credential",
        "remote_test_connection",
        "remote_read_dir",
        "remote_stat_dir_entry",
        "remote_list_known_hosts",
        "remote_trust_host",
        "remote_forget_host",
        "remote_upload_path",
        "remote_download_path",
        "remote_chmod",
        "remote_get_permissions",
        "remote_remove_path",
        "remote_make_dir",
        "remote_rename_path",
    ];

    /// 抽出 `lib.rs` 里 `generate_handler![ ... ]` 的那一段。
    fn invoke_handler_block() -> String {
        let source = include_str!("../lib.rs");
        let start = source
            .find("generate_handler![")
            .expect("lib.rs 里必须有 generate_handler!");
        let end = source[start..]
            .find(']')
            .expect("generate_handler! 必须闭合");
        source[start..start + end + 1].to_string()
    }

    #[test]
    fn registered_remote_commands_are_wired_into_the_invoke_handler() {
        let block = invoke_handler_block();

        for name in REMOTE_COMMANDS {
            assert!(
                block.contains(name),
                "{name} 写成了 #[tauri::command] 却没有注册进 lib.rs 的 generate_handler! —— \
                 它编译得过、单测也全过，只有真正 invoke 的时候才会报 \"command not found\""
            );
        }
    }

    /// 反向检查：注册表里不能残留已经不存在的 command。
    /// 只做正向检查的话，把一个 command 删掉会悄悄留下一个指向空气的注册项。
    #[test]
    fn the_invoke_handler_has_no_stale_remote_entries() {
        let block = invoke_handler_block();
        let registered: Vec<&str> = block
            .lines()
            .map(str::trim)
            // 注册项写的是 `remote::remote_save_credential`，取最后一段。
            .map(|line| line.rsplit("::").next().unwrap_or(line))
            .filter(|name| name.starts_with("remote_"))
            .map(|name| name.trim_end_matches(','))
            .collect();

        assert_eq!(
            registered.len(),
            REMOTE_COMMANDS.len(),
            "invoke_handler 里的 remote_* 条目与命令列表对不上：{registered:?}"
        );
    }
}
