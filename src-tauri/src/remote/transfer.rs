// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 上传 / 下载 / 远程权限设置。
//!
//! # 红线
//!
//! 本文件被 `cargo test --lib` 的测试二进制链接，**不得出现 `tauri::AppHandle`、
//! `tauri::async_runtime::*` 或 `tauri::` 的任何路径**。
//! `commands.rs`（唯一允许碰 tauri 的适配层）把 `AppHandle` 解析成两个目录，
//! 然后把具体的 provider 以 `&dyn RemoteProvider` 传进来。
//!
//! # 为什么编排逻辑在这里、provider 只做「一个条目」
//!
//! 递归、跳过、计数、失败不中断 —— 这些规则**三种协议一模一样**，
//! 所以它们住在一个对 `&dyn RemoteProvider` 泛型化的函数里，
//! 单测用 `fake::FakeRemoteProvider` 就能跑完整棵树，不必真连服务器。
//! provider 只负责「读一个文件 / 写一个文件 / 建一个目录 / 改一次权限」。
//!
//! # 本地磁盘 I/O 走 `tokio::task::spawn_blocking`，不是 `tauri::async_runtime::*`
//!
//! `std::fs` 是阻塞的，直接在 async 任务里调会把一个 worker 线程占住。
//! 用 `tokio::task::spawn_blocking` 把它挪到 tokio 自己的阻塞池 ——
//! 这跟被禁的那条线是**两回事**：红线的成因是 `tauri::async_runtime` 的
//! `GlobalRuntime<Wry>` 默认类型参数把 tao 拖进测试二进制，
//! `tokio::task::spawn_blocking` 没有任何默认类型参数。

use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};

use super::error::{RemoteError, RemoteErrorKind};
use super::path::{normalize_remote_path, reject_path_control_characters};
use super::provider::RemoteProvider;

/// 单个条目的失败原因。
///
/// **刻意不携带 `RemoteErrorKind`**：报告是「整体成功、局部失败」的载体，
/// 前端在这里要做的是**列出哪几个没成功**，而不是按类别分支给出不同处置
/// （规格 §6.3 的按类别分支是给 `Err` 用的，那里的 `kind` 已经在了）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteTransferFailure {
    pub path: String,
    pub message: String,
}

impl RemoteTransferFailure {
    pub fn new(path: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            path: path.into(),
            message: message.into(),
        }
    }

    /// 从一条 `RemoteError` 建。**kind 被写进 message** —— 报告结构里没有
    /// `kind` 字段，所以类别不能丢，否则前端只剩一句没有处置建议的干话。
    pub fn from_error(path: impl Into<String>, error: &RemoteError) -> Self {
        Self::new(path, format!("[{}] {}", error.kind.as_str(), error.message))
    }
}

/// 一个条目被**跳过**的原因。
///
/// 2026-10-26 真机验收的教训：跳过必须**带原因**。
/// 之前 `skipped` 只是一串路径，前端把它折成一个数字，于是用户看到
/// 「上传了 0 个文件」却不知道为什么 —— 而真实原因是
/// 「远端已经有同名文件，策略是不覆盖」。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteTransferSkipReason {
    /// 目标已存在，且用户没有选择覆盖。
    AlreadyExists,
    /// 用户在冲突对话框里明确跳过了这一项。
    UserSkipped,
}

impl RemoteTransferSkipReason {
    /// 机器可读的短码。前端用它挑本地化文案。
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::AlreadyExists => "already_exists",
            Self::UserSkipped => "user_skipped",
        }
    }
}

/// 一个被跳过的条目。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteTransferSkip {
    pub path: String,
    pub reason: RemoteTransferSkipReason,
}

impl RemoteTransferSkip {
    pub fn new(path: impl Into<String>, reason: RemoteTransferSkipReason) -> Self {
        Self {
            path: path.into(),
            reason,
        }
    }
}

/// 一次传输的**进度快照**。
///
/// 前端拿它画进度条。`files_total` / `bytes_total` 是**分母**：
/// 传输开始前就定下来（先扫一遍本地或远端的树），所以进度条从头到尾
/// 都有真实的「离完成还有多远」，而不是中途突然出现一个分母。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TransferProgress {
    /// 已经传完的文件数。
    pub files_done: u64,
    /// 一共要传多少个文件。
    pub files_total: u64,
    /// 已经传出去的字节数。
    pub bytes_done: u64,
    /// 一共要传多少字节。
    pub bytes_total: u64,
    /// 当前正在处理的文件（空串 = 还没开始）。
    pub current_path: String,
}

/// 进度汇聚器。
///
/// 传输层把「这个文件已经写出去多少字节」交给它，它负责累加成全局计数，
/// 并在每次变化时把快照发给上层。
///
/// **为什么需要单独一个类型**：provider 的回调是 `Fn(u64) + Send + Sync`
/// （它可能被搬到别的线程上调用），而上层的回调是 `FnMut`（它要改自己的状态）。
/// 两者形状对不上，中间必须有一层可共享的状态。
///
/// **它必须能被克隆**：递归的每一层都要拿到同一个汇聚器，
/// 克隆的是 `Arc`，不是状态本身。
#[derive(Clone)]
pub struct TransferProgressSink {
    state: Arc<Mutex<TransferProgressState>>,
    publish: Arc<Mutex<Box<dyn FnMut(TransferProgress) + Send>>>,
}

#[derive(Debug, Clone, Default)]
struct TransferProgressState {
    files_done: u64,
    files_total: u64,
    bytes_done: u64,
    bytes_total: u64,
    current_path: String,
    /// 当前文件开始传之前，已经传出去的字节数。
    ///
    /// provider 报的是「**这个文件**写了多少字节」，要换算成全局累计
    /// 就得加上这个基数。
    file_base: u64,
}

impl TransferProgressSink {
    pub fn new(publish: impl FnMut(TransferProgress) + Send + 'static) -> Self {
        Self {
            state: Arc::new(Mutex::new(TransferProgressState::default())),
            publish: Arc::new(Mutex::new(Box::new(publish))),
        }
    }

    /// 定下分母。**必须在开始传输之前调用** —— 传输开始之后才知道分母，
    /// 进度条会先冲到 100% 再掉下来。
    pub fn set_totals(&self, files_total: u64, bytes_total: u64) {
        let snapshot = {
            let mut state = self.state.lock().expect("进度状态锁");
            state.files_total = files_total;
            state.bytes_total = bytes_total;
            state.clone()
        };

        self.emit(&snapshot);
    }

    /// 开始传一个文件。
    pub fn begin_file(&self, path: &str) {
        let snapshot = {
            let mut state = self.state.lock().expect("进度状态锁");
            state.file_base = state.bytes_done;
            state.current_path = path.to_string();
            state.clone()
        };

        self.emit(&snapshot);
    }

    /// provider 回调：**这个文件**已经写了多少字节。
    pub fn advance_file(&self, written: u64) {
        let snapshot = {
            let mut state = self.state.lock().expect("进度状态锁");
            state.bytes_done = state.file_base.saturating_add(written);
            state.clone()
        };

        self.emit(&snapshot);
    }

    /// 这个文件传完了。
    pub fn finish_file(&self, size: u64) {
        let snapshot = {
            let mut state = self.state.lock().expect("进度状态锁");
            state.bytes_done = state.file_base.saturating_add(size);
            state.files_done = state.files_done.saturating_add(1);
            state.current_path = String::new();
            state.clone()
        };

        self.emit(&snapshot);
    }

    fn emit(&self, state: &TransferProgressState) {
        let snapshot = TransferProgress {
            files_done: state.files_done,
            files_total: state.files_total,
            bytes_done: state.bytes_done,
            bytes_total: state.bytes_total,
            current_path: state.current_path.clone(),
        };

        let mut publish = self.publish.lock().expect("进度回调锁");
        publish(snapshot);
    }
}

/// 一次上传或下载的结果。
///
/// 字段名是前端契约的一部分，**刻意不加 `#[serde(rename_all = "camelCase")]`**。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteTransferReport {
    /// 成功传输的文件数
    pub transferred_files: u64,
    /// 成功创建的目录数
    pub transferred_dirs: u64,
    /// 总字节数
    pub total_bytes: u64,
    /// 被跳过的条目（**带原因**）。
    ///
    /// 对**目录**来说，「已存在」指的是**没有去创建它**（`transferred_dirs`
    /// 不计它），但仍然会**继续往里合并** —— 否则把一个本地目录传到
    /// 一个已有的同名远端目录下会变成「什么都没传」，那不是用户以为的结果。
    pub skipped: Vec<RemoteTransferSkip>,
    /// 失败条目
    pub failures: Vec<RemoteTransferFailure>,
}

impl RemoteTransferReport {
    /// 记一次失败并继续。**传输不因为单个条目失败而中断**。
    pub fn record_failure(&mut self, path: impl Into<String>, error: &RemoteError) {
        self.failures.push(RemoteTransferFailure::from_error(path, error));
    }

    /// 记一次跳过。**必须带原因** —— 只有路径的话，前端只能报一个数字，
    /// 用户完全不知道为什么这个文件没传上去。
    pub fn record_skip(&mut self, path: impl Into<String>, reason: RemoteTransferSkipReason) {
        self.skipped.push(RemoteTransferSkip::new(path, reason));
    }

    pub fn record_file(&mut self, bytes: u64) {
        self.transferred_files += 1;
        self.total_bytes += bytes;
    }

    pub fn record_dir(&mut self) {
        self.transferred_dirs += 1;
    }
}

/// 一次递归权限设置的结果。
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteChmodReport {
    /// 实际改动过的条目数
    pub changed: u64,
    pub failures: Vec<RemoteTransferFailure>,
}

impl RemoteChmodReport {
    pub fn record_failure(&mut self, path: impl Into<String>, error: &RemoteError) {
        self.failures.push(RemoteTransferFailure::from_error(path, error));
    }

    pub fn record_change(&mut self) {
        self.changed += 1;
    }
}

/// 权限位的掩码：setuid / setgid / sticky 三位 + `rwxrwxrwx` 九位。
pub const PERMISSION_MASK: u32 = 0o7777;

// ---------------------------------------------------------------------------
// 纯函数：八进制 ↔ rwx
//
// 前端有一份逐条镜像（权限设置对话框要在输入框旁边显示「所有者 可读写执行」）。
// 两边各有一组测试，改了一边就要改另一边。
// ---------------------------------------------------------------------------

/// 一个八进制权限值是否在可接受范围内。
///
/// 超过 `0o7777` 意味着调用方把文件类型位（`S_IFDIR` 之类）也传进来了 ——
/// 那是「把 `st_mode` 整个传过来」的典型症状，而 `chmod` 会照单全收并清掉文件类型。
pub fn mode_is_valid(mode: u32) -> bool {
    mode <= PERMISSION_MASK
}

/// 把八进制权限值格式化成 `0755` 这样的四位数。
///
/// **固定四位**：三位会让人以为 `644` 和 `0644` 是两种权限。
pub fn format_octal_mode(mode: u32) -> String {
    format!("{mode:04o}")
}

/// 一个「读 / 写 / 执行」三元组，取值只能是 `rwx` 的子集且保持顺序。
fn permission_triplet(bits: u32, shift: u32) -> String {
    let read = (bits >> shift) & 0b100 != 0;
    let write = (bits >> shift) & 0b010 != 0;
    let execute = (bits >> shift) & 0b001 != 0;

    format!(
        "{}{}{}",
        if read { 'r' } else { '-' },
        if write { 'w' } else { '-' },
        if execute { 'x' } else { '-' }
    )
}

/// 八进制权限值 → `["所有者", "属组", "其他人"]` 三段 `rwx`。
///
/// 只取低 9 位：`setuid` / `setgid` / `sticky` 不在这三段里，
/// 它们是另外三个独立的标志位，混进来会让「755」显示成 `rws`。
pub fn mode_to_permission_triplets(mode: u32) -> [String; 3] {
    let bits = mode & 0o777;

    [
        permission_triplet(bits, 6),
        permission_triplet(bits, 3),
        permission_triplet(bits, 0),
    ]
}

/// `["rwx", "r-x", "r--"]` → 八进制权限值。
///
/// 非法字符一律当 `false` 处理（那一段变成 `---`），**不报错**：
/// 这是一段展示层的纯函数，让它能把用户手输的 `rrx` 降级显示，
/// 比让整个对话框弹一个错更可用。
pub fn permission_triplets_to_mode(triplets: [&str; 3]) -> u32 {
    fn one(triplet: &str) -> u32 {
        let mut value = 0u32;

        for (offset, expected) in ['r', 'w', 'x'].iter().enumerate() {
            if triplet.chars().nth(offset) == Some(*expected) {
                value |= 0b100 >> offset;
            }
        }

        value
    }

    (one(triplets[0]) << 6) | (one(triplets[1]) << 3) | one(triplets[2])
}

/// 远端目录 + 条目名 → 规范化后的远端子路径。
///
/// **必须走 `normalize_remote_path`，不能 `format!("/{}", format!("{dir}/{name}"))`**：
/// 根目录是 `"/"`，直接拼会得到 `"//pub"`，而那和 `"/pub"` 在某些 SFTP 服务器上
/// 是两条不同的路径。名字里带斜杠 / 控制字符同样在这里被挡住。
pub fn join_remote_child(remote_dir: &str, name: &str) -> Result<String, RemoteError> {
    reject_path_control_characters(name)?;

    // 名字里带斜杠会**静默**变成一条子路径：`join_remote_child("/pub", "a/b")`
    // 若放行就得到 `/pub/a/b`，于是 `read_dir` 报告的那个条目和实际写出去的
    // 位置对不上。POSIX 的文件名本来就不许含斜杠，所以这里只当防御。
    if name.contains('/') {
        return Err(RemoteError::protocol(format!(
            "远端条目名里含有斜杠，无法拼出路径：{name}"
        )));
    }

    let base = remote_dir.trim_end_matches('/');

    normalize_remote_path(&format!("{base}/{name}")).ok_or_else(|| {
        RemoteError::protocol(format!("远端条目名不合法，无法拼出路径：{name}"))
    })
}

/// 本地目录 + 条目名 → 本地子路径。
///
/// 同样挡控制字符：本地路径最终会交给 `std::fs`，而条目名来自远端列表。
pub fn join_local_child(local_dir: &Path, name: &str) -> Result<PathBuf, RemoteError> {
    if super::path::contains_control_characters(name) {
        return Err(RemoteError::protocol(format!(
            "远端条目名里出现了控制字符，已拒绝使用：{name:?}"
        )));
    }

    if name.is_empty() || name == "." || name == ".." {
        return Err(RemoteError::protocol(format!(
            "远端条目名不合法，无法拼出本地路径：{name}"
        )));
    }

    Ok(local_dir.join(name))
}

/// 一次本地磁盘操作的形状。
enum LocalEntry {
    Directory,
    File,
    /// 符号链接。**上传时不跟随、也不复制** —— 见 [`list_local_children`]。
    Symlink,
}

/// 在阻塞池里跑一段本地磁盘操作。
async fn blocking<T: Send + 'static>(
    what: &'static str,
    work: impl FnOnce() -> Result<T, RemoteError> + Send + 'static,
) -> Result<T, RemoteError> {
    tokio::task::spawn_blocking(work)
        .await
        .map_err(|join_error| RemoteError::unknown(format!("{what} 的后台任务失败: {join_error}")))?
}

/// 递归的 future 必须装箱。
///
/// `async fn` 直接递归会造出一个**无限大**的类型 ——
/// 每个 `await` 都要把「还剩多少层」编码进类型里，而层数没有上界。
/// 三个 `*_directory` 函数都用这个别名。
type Recursive<'a, T> = Pin<Box<dyn Future<Output = Result<T, RemoteError>> + Send + 'a>>;

/// 列一个本地目录的直接子项，按名字排序。
///
/// `symlink_metadata` 而不是 `metadata`：跟随符号链接的话，
/// 指向目录的链接会被当成目录，于是上传时会把链接的目标整个复制一份 ——
/// 而用户看到的只是一个「链接」。
fn list_local_children(
    local_dir: PathBuf,
) -> impl std::future::Future<Output = Result<Vec<(String, LocalEntry)>, RemoteError>> + Send {
    blocking("读取本地目录", move || {
        let mut children: Vec<(String, LocalEntry)> = std::fs::read_dir(&local_dir)
            .map_err(|error| {
                RemoteError::not_found(format!("读取本地目录失败：{error}"))
            })?
            .filter_map(|entry| entry.ok())
            .map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                let kind = match entry.file_type() {
                    Ok(file_type) if file_type.is_dir() => LocalEntry::Directory,
                    Ok(file_type) if file_type.is_symlink() => LocalEntry::Symlink,
                    Ok(_) => LocalEntry::File,
                    Err(_) => LocalEntry::File,
                };

                (name, kind)
            })
            .collect();

        // 目录枚举顺序由文件系统决定。排序让报告里的 `skipped` / `failures`
        // 在同样的输入下逐条相同，否则单测只能断言集合、测不出「顺序变了」。
        children.sort_by(|left, right| left.0.cmp(&right.0));

        Ok(children)
    })
}

/// 列一个本地目录下的**名字集合**，用于「目标是不是已经存在」。
async fn local_child_names(local_dir: PathBuf) -> Result<HashSet<String>, RemoteError> {
    Ok(list_local_children(local_dir)
        .await?
        .into_iter()
        .map(|(name, _)| name)
        .collect())
}

/// 列一个远端目录的**名字集合**，用于「目标是不是已经存在」。
///
/// 走 `read_dir` 而不是给 trait 加一个 `stat`：`stat` 在 FTP 上是
/// 「列父目录再按名字找」（`ftp_provider.rs` 里写明了理由），
/// 那它并不比直接列一次便宜，而且多一个 trait 方法就多一处要实现的分支。
async fn remote_child_names(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_dir: &str,
) -> Result<HashSet<String>, RemoteError> {
    Ok(provider
        .read_dir(connection_id, remote_dir)
        .await?
        .into_iter()
        .map(|entry| entry.name)
        .collect())
}

/// 「已存在」时报告里记的完整路径。
///
/// 上传侧记 `sfm://remote/...`（与前端地址栏一致），下载侧记本地绝对路径 ——
/// 两侧用户看到的都是「自己刚操作的那个面板里」的路径。
fn remote_display_path(connection_id: &str, remote_path: &str) -> String {
    super::path::build_remote_path(connection_id, remote_path)
        .unwrap_or_else(|| format!("{}/{connection_id}{remote_path}", super::path::REMOTE_SCHEME))
}

// ---------------------------------------------------------------------------
// 上传
// ---------------------------------------------------------------------------

/// 上传：本地**文件或目录** → 远端目录。
///
/// 只有「完全无法开始」才返回 `Err`：本地路径不存在、远端目录列不出来。
/// 单个条目失败一律进 `failures` 并继续 —— 传 200 个文件时因为第 7 个
/// 权限不足而丢掉另外 199 个，是不能接受的。
/// 一次上传请求。
pub struct UploadRequest<'a> {
    /// 要上传的本地路径（文件或目录）。
    pub local_paths: &'a [PathBuf],
    /// 远端目标目录。
    pub remote_dir: &'a str,
    /// **允许覆盖**远端同名项的本地路径。
    ///
    /// 这里放的是**顶层本地路径**（用户选中的那些），
    /// 目录里的所有文件都跟着这个决定走 ——
    /// 「把这个目录传过去并覆盖同名文件」是一句话的事，
    /// 不该要求用户为目录里的每一个文件单独表态。
    pub overwrite_paths: &'a HashSet<String>,
    /// 进度汇聚器（可选）。
    pub progress: Option<TransferProgressSink>,
}

/// 上传：本地**文件或目录** → 远端目录。
///
/// 只有「完全无法开始」才返回 `Err`：本地路径不存在、远端目录列不出来。
/// 单个条目失败一律进 `failures` 并继续 —— 传 200 个文件时因为第 7 个
/// 权限不足而丢掉另外 199 个，是不能接受的。
///
/// **不覆盖**：目标已存在同名文件时进 `skipped`（带 `already_exists` 原因），
/// 绝不静默覆盖。要覆盖走 [`upload_many`] 并把路径放进 `overwrite_paths`。
pub async fn upload(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    local_path: &Path,
    remote_dir: &str,
) -> Result<RemoteTransferReport, RemoteError> {
    // 严格版：本地路径读不出来就直接报错，绝不「传了 0 个文件」蒙混过去。
    let local_path = local_path.to_path_buf();
    let probed = local_path.clone();
    let kind = blocking("读取本地路径", move || {
        std::fs::symlink_metadata(&probed).map_err(|error| {
            RemoteError::not_found(format!("本地路径不存在或读不出来：{error}"))
        })
    })
    .await?;

    // 上传的是符号链接本身：既不跟随（那会把目标的整棵子树复制一份），
    // 也不复制（trait 没有「建链接」这个动作）。原样报告，不猜用户想要哪种。
    if kind.file_type().is_symlink() {
        return Err(RemoteError::protocol(
            "暂不支持上传符号链接。请上传它指向的文件或目录。",
        ));
    }

    let local_paths = vec![local_path];
    let overwrite_paths = HashSet::new();

    upload_many(
        provider,
        connection_id,
        UploadRequest {
            local_paths: &local_paths,
            remote_dir,
            overwrite_paths: &overwrite_paths,
            progress: None,
        },
    )
    .await
}

/// 上传：**一批**本地路径 → 远端目录。
///
/// 与 [`upload`] 的差别有三处：
/// ① 一批路径共用**同一个**进度汇聚器 ⇒ 进度条的分母是整批的总和；
/// ② `overwrite_paths` 里的路径允许**覆盖**远端同名项；
/// ③ 某一个路径读不出来只记成一条 `failure`，**不拖累其余的**。
pub async fn upload_many(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    request: UploadRequest<'_>,
) -> Result<RemoteTransferReport, RemoteError> {
    reject_path_control_characters(request.remote_dir)?;

    let normalized = normalize_remote_path(request.remote_dir).ok_or_else(|| {
        RemoteError::protocol(format!("远端目录路径不合法：{}", request.remote_dir))
    })?;

    let mut report = RemoteTransferReport::default();

    // ---- 1. 逐个探本地路径，同时把总量算出来 ----------------------------
    //
    // 分母必须在传输**开始之前**定下来：进度条要是中途才出现分母，
    // 用户会先看到 100% 再掉回 0%。
    struct Prepared {
        path: PathBuf,
        is_dir: bool,
    }

    let mut prepared: Vec<Prepared> = Vec::new();
    let mut files_total = 0u64;
    let mut bytes_total = 0u64;

    for local_path in request.local_paths {
        let probed = local_path.clone();
        let kind = blocking("读取本地路径", move || {
            std::fs::symlink_metadata(&probed).map_err(|error| {
                RemoteError::not_found(format!("本地路径不存在或读不出来：{error}"))
            })
        })
        .await;

        let kind = match kind {
            Ok(kind) => kind,
            Err(error) => {
                report.record_failure(local_path.to_string_lossy().to_string(), &error);
                continue;
            }
        };

        if kind.file_type().is_symlink() {
            report.record_failure(
                local_path.to_string_lossy().to_string(),
                &RemoteError::protocol(
                    "暂不支持上传符号链接。请上传它指向的文件或目录。",
                ),
            );
            continue;
        }

        let is_dir = kind.file_type().is_dir();

        if is_dir {
            let (files, bytes) = scan_local_tree(&local_path).await;
            files_total += files;
            bytes_total += bytes;
        }
        else {
            files_total += 1;
            bytes_total += kind.len();
        }

        prepared.push(Prepared {
            path: local_path.clone(),
            is_dir,
        });
    }

    if let Some(sink) = &request.progress {
        sink.set_totals(files_total, bytes_total);
    }

    // ---- 2. 逐个上传 ------------------------------------------------------
    //
    // 目标目录的条目清单**按目录缓存**：一批路径通常指向同一个目标目录，
    // 每个路径都重新列一次是白花的网络往返。
    let mut existing_cache: HashMap<String, HashSet<String>> = HashMap::new();

    for item in prepared {
        let Some(name) = item
            .path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
        else {
            report.record_failure(
                item.path.to_string_lossy().to_string(),
                &RemoteError::protocol(format!(
                    "本地路径没有文件名，无法上传：{:?}",
                    item.path
                )),
            );
            continue;
        };

        let target = match join_remote_child(&normalized, &name) {
            Ok(target) => target,
            Err(error) => {
                report.record_failure(name.clone(), &error);
                continue;
            }
        };

        // 按**路径分量**比较，不是按字符串 ——
        // 前端传回来的路径可能带尾斜杠或者大小写不同，
        // 字符串相等会把「明明是同一个文件」判成两个。
        let overwrite = request
            .overwrite_paths
            .iter()
            .any(|candidate| Path::new(candidate) == item.path.as_path());

        let existing = match existing_cache.get(&normalized) {
            Some(existing) => existing.clone(),
            None => match remote_child_names(provider, connection_id, &normalized).await {
                Ok(existing) => {
                    existing_cache.insert(normalized.clone(), existing.clone());
                    existing
                }
                Err(error) => {
                    report.record_failure(remote_display_path(connection_id, &normalized), &error);
                    continue;
                }
            },
        };

        if item.is_dir {
            if existing.contains(&name) {
                // 目录已存在：**不重建**，但仍然往里合并。
                // 只有「不覆盖」的时候才记成跳过 —— 覆盖时这是用户明确要的合并。
                if !overwrite {
                    report.record_skip(
                        remote_display_path(connection_id, &target),
                        RemoteTransferSkipReason::AlreadyExists,
                    );
                }
            }
            else if let Err(error) = provider.make_dir(connection_id, &target).await {
                report.record_failure(remote_display_path(connection_id, &target), &error);
                continue;
            }
            else {
                report.record_dir();
            }

            upload_directory(
                provider,
                connection_id,
                &item.path,
                &target,
                overwrite,
                request.progress.clone(),
                &mut report,
            )
            .await?;
        }
        else {
            upload_file(
                provider,
                connection_id,
                &item.path,
                &target,
                &existing,
                overwrite,
                request.progress.clone(),
                &mut report,
            )
            .await?;
        }
    }

    Ok(report)
}

/// 统计一棵本地树里有多少个文件、一共多少字节。
///
/// **不跟随符号链接**：符号链接不会被上传（会被记成一条失败），
/// 所以它也不该算进分母 —— 否则进度条永远到不了 100%。
///
/// 整棵树在**一次**阻塞调用里数完：每个文件单独 `spawn_blocking` 的话，
/// 一万个文件就是一万次线程池调度。
async fn scan_local_tree(root: &Path) -> (u64, u64) {
    let owned = root.to_path_buf();

    blocking("统计本地目录", move || {
        let mut files = 0u64;
        let mut bytes = 0u64;
        let mut stack = vec![owned];

        while let Some(directory) = stack.pop() {
            let Ok(entries) = std::fs::read_dir(&directory) else {
                continue;
            };

            for entry in entries.flatten() {
                let Ok(file_type) = entry.file_type() else {
                    continue;
                };

                if file_type.is_symlink() {
                    continue;
                }

                if file_type.is_dir() {
                    stack.push(entry.path());
                    continue;
                }

                files += 1;
                bytes += entry.metadata().map(|metadata| metadata.len()).unwrap_or(0);
            }
        }

        Ok((files, bytes))
    })
    .await
    .unwrap_or((0, 0))
}

/// 把一个本地文件传到远端。目标已存在则进 `skipped`，**不静默覆盖** ——
/// 除非 `overwrite` 为真（用户在冲突对话框里明确说了要覆盖）。
async fn upload_file(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    local_path: &Path,
    target: &str,
    existing: &HashSet<String>,
    overwrite: bool,
    progress: Option<TransferProgressSink>,
    report: &mut RemoteTransferReport,
) -> Result<(), RemoteError> {
    let name = match local_path.file_name() {
        Some(name) => name.to_string_lossy().to_string(),
        None => return Ok(()),
    };

    if existing.contains(&name) && !overwrite {
        report.record_skip(
            remote_display_path(connection_id, target),
            RemoteTransferSkipReason::AlreadyExists,
        );
        return Ok(());
    }

    let display = remote_display_path(connection_id, target);
    let local_path = local_path.to_path_buf();
    let content = match blocking("读取本地文件", move || {
        std::fs::read(&local_path).map_err(|error| {
            RemoteError::unknown(format!("读取本地文件失败：{error}"))
        })
    })
    .await
    {
        Ok(content) => content,
        Err(error) => {
            report.record_failure(display, &error);
            return Ok(());
        }
    };

    let bytes = content.len() as u64;

    if let Some(sink) = &progress {
        sink.begin_file(&display);
    }

    // 有进度汇聚器就走**分块写**：写完一块报一次，
    // 大文件上传期间界面上的进度条才动得起来。
    let outcome = match progress.as_ref() {
        Some(sink) => {
            let sink = sink.clone();
            let on_progress = move |written: u64| {
                sink.advance_file(written);
            };

            provider
                .write_file_with_progress(connection_id, target, content, &on_progress)
                .await
        }
        None => provider.write_file(connection_id, target, content).await,
    };

    match outcome {
        Ok(()) => {
            if let Some(sink) = &progress {
                sink.finish_file(bytes);
            }

            report.record_file(bytes);
        }
        Err(error) => report.record_failure(display, &error),
    }

    Ok(())
}

/// 递归上传一个本地目录的**内容**（不含目录自身）。
///
/// **不跟随本地符号链接**：指向目录的链接会让递归沿着链接走出去，
/// 既可能绕成环，也可能把用户没打算传的整棵目标子树复制过去。
fn upload_directory<'a>(
    provider: &'a dyn RemoteProvider,
    connection_id: &'a str,
    local_dir: &'a Path,
    remote_dir: &'a str,
    overwrite: bool,
    progress: Option<TransferProgressSink>,
    report: &'a mut RemoteTransferReport,
) -> Recursive<'a, ()> {
    Box::pin(async move {
    let children = match list_local_children(local_dir.to_path_buf()).await {
        Ok(children) => children,
        Err(error) => {
            report.record_failure(local_dir.to_string_lossy().to_string(), &error);
            return Ok(());
        }
    };

    let existing = match remote_child_names(provider, connection_id, remote_dir).await {
        Ok(existing) => existing,
        Err(error) => {
            report.record_failure(remote_display_path(connection_id, remote_dir), &error);
            return Ok(());
        }
    };

    for (name, kind) in children {
        let child_local = match join_local_child(local_dir, &name) {
            Ok(path) => path,
            Err(error) => {
                report.record_failure(name.clone(), &error);
                continue;
            }
        };

        let child_remote = match join_remote_child(remote_dir, &name) {
            Ok(path) => path,
            Err(error) => {
                report.record_failure(name.clone(), &error);
                continue;
            }
        };

        match kind {
            LocalEntry::Directory => {
                if existing.contains(&name) {
                    // 目录已存在：不重建，但仍然往里合并。
                    // 「不覆盖」时才记成跳过。
                    if !overwrite {
                        report.record_skip(
                            remote_display_path(connection_id, &child_remote),
                            RemoteTransferSkipReason::AlreadyExists,
                        );
                    }
                }
                else if let Err(error) = provider.make_dir(connection_id, &child_remote).await {
                    report.record_failure(
                        remote_display_path(connection_id, &child_remote),
                        &error,
                    );
                    continue;
                }
                else {
                    report.record_dir();
                }

                upload_directory(
                    provider,
                    connection_id,
                    &child_local,
                    &child_remote,
                    overwrite,
                    progress.clone(),
                    report,
                )
                .await?;
            }
            LocalEntry::File => {
                upload_file(
                    provider,
                    connection_id,
                    &child_local,
                    &child_remote,
                    &existing,
                    overwrite,
                    progress.clone(),
                    report,
                )
                .await?;
            }
            LocalEntry::Symlink => {
                report.failures.push(RemoteTransferFailure::new(
                    child_local.to_string_lossy().to_string(),
                    "暂不支持上传符号链接，已跳过这个条目",
                ));
            }
        }
    }

    Ok(())
    })
}

// ---------------------------------------------------------------------------
// 下载
// ---------------------------------------------------------------------------

/// 一次下载请求。
pub struct DownloadRequest<'a> {
    /// 要下载的远端路径（文件或目录）。
    pub remote_paths: &'a [String],
    /// 本地目标目录。
    pub local_dir: &'a Path,
    /// **允许覆盖**本地同名项的远端路径。
    pub overwrite_paths: &'a HashSet<String>,
    /// 进度汇聚器（可选）。
    pub progress: Option<TransferProgressSink>,
}

/// 下载：远程**文件或目录** → 本地目录。
///
/// 本地目录不存在就创建 —— 用户在「下载到」里敲一个还没建过的文件夹名时，
/// 让他自己先去建一遍是本末倒置。
///
/// **不覆盖**：本地已存在同名文件时进 `skipped`（带 `already_exists` 原因）。
pub async fn download(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
    local_dir: &Path,
) -> Result<RemoteTransferReport, RemoteError> {
    let remote_paths = vec![remote_path.to_string()];
    let overwrite_paths = HashSet::new();

    download_many(
        provider,
        connection_id,
        DownloadRequest {
            remote_paths: &remote_paths,
            local_dir,
            overwrite_paths: &overwrite_paths,
            progress: None,
        },
    )
    .await
}

/// 下载：**一批**远端路径 → 本地目录。
///
/// 与 [`download`] 的差别：① 一批路径共用同一个进度汇聚器；
/// ② `overwrite_paths` 里的路径允许覆盖本地同名项；
/// ③ 某一个远端路径读不出来只记成一条 `failure`，不拖累其余的。
pub async fn download_many(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    request: DownloadRequest<'_>,
) -> Result<RemoteTransferReport, RemoteError> {
    let local_dir = request.local_dir.to_path_buf();
    let prepared = local_dir.clone();
    blocking("准备本地目录", move || {
        std::fs::create_dir_all(&prepared).map_err(|error| {
            RemoteError::unknown(format!("创建本地目录失败：{error}"))
        })
    })
    .await?;

    let mut report = RemoteTransferReport::default();

    // ---- 1. 先把远端这一侧的总量数出来 ------------------------------------
    struct Prepared {
        normalized: String,
        name: String,
        is_dir: bool,
    }

    let mut prepared_items: Vec<Prepared> = Vec::new();
    let mut files_total = 0u64;
    let mut bytes_total = 0u64;

    for remote_path in request.remote_paths {
        reject_path_control_characters(remote_path)?;

        let normalized = match normalize_remote_path(remote_path) {
            Some(normalized) => normalized,
            None => {
                report.record_failure(
                    remote_path.clone(),
                    &RemoteError::protocol(format!("远端路径不合法：{remote_path}")),
                );
                continue;
            }
        };

        let name = normalized
            .rsplit('/')
            .next()
            .filter(|segment| !segment.is_empty())
            .unwrap_or_default()
            .to_string();

        if name.is_empty() {
            report.record_failure(
                remote_path.clone(),
                &RemoteError::protocol("下载的根是远程空间根，没有可下载的条目名"),
            );
            continue;
        }

        // 是目录还是文件，只能问远端 —— trait 没有 `stat`，
        // 而列父目录拿不到「文件」这一项的大小以外的信息，够了。
        let entry = match remote_entry_of(provider, connection_id, &normalized).await {
            Ok(entry) => entry,
            Err(error) => {
                report.record_failure(remote_display_path(connection_id, &normalized), &error);
                continue;
            }
        };

        if entry.is_dir {
            let (files, bytes) = scan_remote_tree(provider, connection_id, &normalized).await;
            files_total += files;
            bytes_total += bytes;
        }
        else {
            files_total += 1;
            bytes_total += entry.size;
        }

        prepared_items.push(Prepared {
            normalized,
            name,
            is_dir: entry.is_dir,
        });
    }

    if let Some(sink) = &request.progress {
        sink.set_totals(files_total, bytes_total);
    }

    // ---- 2. 逐个下载 ------------------------------------------------------
    for item in prepared_items {
        let overwrite = request.overwrite_paths.contains(&item.normalized);
        let target = match join_local_child(&local_dir, &item.name) {
            Ok(target) => target,
            Err(error) => {
                report.record_failure(item.name.clone(), &error);
                continue;
            }
        };

        if item.is_dir {
            if target.exists() {
                if !overwrite {
                    report.record_skip(
                        target.to_string_lossy().to_string(),
                        RemoteTransferSkipReason::AlreadyExists,
                    );
                }
            }
            else {
                let created = target.clone();
                let outcome = blocking("创建本地目录", move || {
                    std::fs::create_dir_all(&created).map_err(|error| {
                        RemoteError::unknown(format!("创建本地目录失败：{error}"))
                    })
                })
                .await;

                if let Err(error) = outcome {
                    report.record_failure(
                        remote_display_path(connection_id, &item.normalized),
                        &error,
                    );
                    continue;
                }

                report.record_dir();
            }

            download_directory(
                provider,
                connection_id,
                &item.normalized,
                &target,
                overwrite,
                request.progress.clone(),
                &mut report,
            )
            .await?;
        }
        else {
            download_file(
                provider,
                connection_id,
                &item.normalized,
                &local_dir,
                &item.name,
                overwrite,
                request.progress.clone(),
                &mut report,
            )
            .await?;
        }
    }

    Ok(report)
}

/// 数一棵远端树里有多少个文件、一共多少字节。
///
/// **不跟随符号链接**：符号链接不会被下载（会记成一条失败），
/// 所以它也不该算进分母。
async fn scan_remote_tree(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
) -> (u64, u64) {
    let mut files = 0u64;
    let mut bytes = 0u64;
    let mut stack = vec![remote_path.to_string()];

    while let Some(directory) = stack.pop() {
        let entries = match provider.read_dir(connection_id, &directory).await {
            Ok(entries) => entries,
            Err(_) => continue,
        };

        for entry in entries {
            if entry.is_symlink {
                continue;
            }

            if entry.is_dir {
                if let Ok(child) = join_remote_child(&directory, &entry.name) {
                    stack.push(child);
                }
                continue;
            }

            files += 1;
            bytes += entry.size;
        }
    }

    (files, bytes)
}

/// 在父目录里按名字找出条目。
///
/// `stat` 语义（FTP provider 里也是「列父目录再按名字找」）。
async fn remote_entry_of(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
) -> Result<super::provider::RemoteEntry, RemoteError> {
    let name = remote_path
        .rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| RemoteError::protocol("远端路径不是一个条目"))?
        .to_string();

    let parent = match remote_path.rfind('/') {
        Some(0) | None => "/".to_string(),
        Some(index) => remote_path[..index].to_string(),
    };

    provider
        .read_dir(connection_id, &parent)
        .await?
        .into_iter()
        .find(|entry| entry.name == name)
        .ok_or_else(|| RemoteError::not_found(format!("远端没有这个条目：{remote_path}")))
}

/// 下载一个远程文件。目标已存在则进 `skipped`，**不静默覆盖** ——
/// 除非 `overwrite` 为真（用户在冲突对话框里明确说了要覆盖）。
async fn download_file(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
    local_dir: &Path,
    name: &str,
    overwrite: bool,
    progress: Option<TransferProgressSink>,
    report: &mut RemoteTransferReport,
) -> Result<(), RemoteError> {
    let target = join_local_child(local_dir, name)?;
    let display = target.to_string_lossy().to_string();

    if target.exists() && !overwrite {
        report.record_skip(display, RemoteTransferSkipReason::AlreadyExists);
        return Ok(());
    }

    let content = match provider.read_file(connection_id, remote_path).await {
        Ok(content) => content,
        Err(error) => {
            report.record_failure(display, &error);
            return Ok(());
        }
    };

    let bytes = content.len() as u64;

    if let Some(sink) = &progress {
        sink.begin_file(&display);
    }

    let written = target.clone();
    let outcome = blocking("写入本地文件", move || {
        std::fs::write(&written, &content).map_err(|error| {
            RemoteError::unknown(format!("写入本地文件失败：{error}"))
        })
    })
    .await;

    match outcome {
        Ok(()) => {
            if let Some(sink) = &progress {
                sink.finish_file(bytes);
            }

            report.record_file(bytes);
        }
        Err(error) => report.record_failure(display, &error),
    }

    Ok(())
}

/// 递归下载一个远端目录的**内容**（不含目录自身）。
fn download_directory<'a>(
    provider: &'a dyn RemoteProvider,
    connection_id: &'a str,
    remote_dir: &'a str,
    local_dir: &'a Path,
    overwrite: bool,
    progress: Option<TransferProgressSink>,
    report: &'a mut RemoteTransferReport,
) -> Recursive<'a, ()> {
    Box::pin(async move {
    let entries = match provider.read_dir(connection_id, remote_dir).await {
        Ok(entries) => entries,
        Err(error) => {
            report.record_failure(remote_display_path(connection_id, remote_dir), &error);
            return Ok(());
        }
    };

    let existing = match local_child_names(local_dir.to_path_buf()).await {
        Ok(existing) => existing,
        Err(error) => {
            report.record_failure(local_dir.to_string_lossy().to_string(), &error);
            return Ok(());
        }
    };

    for entry in entries {
        let child_remote = match join_remote_child(remote_dir, &entry.name) {
            Ok(path) => path,
            Err(error) => {
                report.record_failure(entry.name.clone(), &error);
                continue;
            }
        };

        let child_local = match join_local_child(local_dir, &entry.name) {
            Ok(path) => path,
            Err(error) => {
                report.record_failure(entry.name.clone(), &error);
                continue;
            }
        };

        // 符号链接只改链接本身，不下载它指向的目标。
        if entry.is_symlink {
            report.failures.push(RemoteTransferFailure::new(
                remote_display_path(connection_id, &child_remote),
                "暂不支持下载符号链接，已跳过这个条目",
            ));
            continue;
        }

        if entry.is_dir {
            if existing.contains(&entry.name) {
                if !overwrite {
                    report.record_skip(
                        child_local.to_string_lossy().to_string(),
                        RemoteTransferSkipReason::AlreadyExists,
                    );
                }
            }
            else {
                let created = child_local.clone();
                let outcome = blocking("创建本地目录", move || {
                    std::fs::create_dir_all(&created).map_err(|error| {
                        RemoteError::unknown(format!("创建本地目录失败：{error}"))
                    })
                })
                .await;

                if let Err(error) = outcome {
                    report.record_failure(
                        remote_display_path(connection_id, &child_remote),
                        &error,
                    );
                    continue;
                }

                report.record_dir();
            }

            download_directory(
                provider,
                connection_id,
                &child_remote,
                &child_local,
                overwrite,
                progress.clone(),
                report,
            )
            .await?;
        }
        else {
            download_file(
                provider,
                connection_id,
                &child_remote,
                local_dir,
                &entry.name,
                overwrite,
                progress.clone(),
                report,
            )
            .await?;
        }
    }

    Ok(())
    })
}

// ---------------------------------------------------------------------------
// 权限设置
// ---------------------------------------------------------------------------

/// 设置权限。`mode` 是八进制数值（`0755` 传 `0o755`）。
///
/// **只有 SFTP 有效**：FTP / FTPS 的 [`RemoteProvider::set_permissions`] 会返回
/// `Protocol` 错误，那条错误会原样落进 `failures`，`changed` 保持 0。
/// `commands.rs` 另外在协议分流处就挡一次，让它以 `Err` 的形式抵达前端 ——
/// 「这个协议不支持」不是一次「部分失败的传输」。
pub async fn chmod(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
    mode: u32,
    recursive: bool,
) -> Result<RemoteChmodReport, RemoteError> {
    if !mode_is_valid(mode) {
        return Err(RemoteError::protocol(format!(
            "权限值 {mode:o} 超出范围，最多只能到 {PERMISSION_MASK:o}"
        )));
    }

    reject_path_control_characters(remote_path)?;

    let normalized = normalize_remote_path(remote_path).ok_or_else(|| {
        RemoteError::protocol(format!("远端路径不合法：{remote_path}"))
    })?;

    let mut report = RemoteChmodReport::default();
    let first = remote_display_path(connection_id, &normalized);

    match provider
        .set_permissions(connection_id, &normalized, mode)
        .await
    {
        Ok(()) => report.record_change(),
        // 连这一个都改不了，递归下去没有意义。
        Err(error) => {
            report.record_failure(first, &error);
            return Ok(report);
        }
    }

    if recursive {
        chmod_directory(provider, connection_id, &normalized, mode, &mut report).await?;
    }

    Ok(report)
}

/// 递归改权限。**符号链接只改链接本身，不跟进它指向的目录。**
fn chmod_directory<'a>(
    provider: &'a dyn RemoteProvider,
    connection_id: &'a str,
    remote_dir: &'a str,
    mode: u32,
    report: &'a mut RemoteChmodReport,
) -> Recursive<'a, ()> {
    Box::pin(async move {
    let entries = match provider.read_dir(connection_id, remote_dir).await {
        Ok(entries) => entries,
        Err(error) => {
            report.record_failure(remote_display_path(connection_id, remote_dir), &error);
            return Ok(());
        }
    };

    for entry in entries {
        let child = match join_remote_child(remote_dir, &entry.name) {
            Ok(path) => path,
            Err(error) => {
                report.record_failure(entry.name.clone(), &error);
                continue;
            }
        };

        let display = remote_display_path(connection_id, &child);

        match provider.set_permissions(connection_id, &child, mode).await {
            Ok(()) => report.record_change(),
            Err(error) => {
                report.record_failure(display, &error);
                continue;
            }
        }

        // 链接不递归：`is_symlink` 的目录不该带着用户走进目标去改权限。
        if entry.is_dir && !entry.is_symlink {
            chmod_directory(provider, connection_id, &child, mode, report).await?;
        }
    }

    Ok(())
    })
}

/// 「这个协议不支持权限设置」的标准错误。FTP / FTPS 两个 provider 共用。
pub fn unsupported_set_permissions(protocol: &str) -> RemoteError {
    RemoteError::new(
        RemoteErrorKind::Protocol,
        format!("{protocol} 协议不支持设置权限。请改用 SFTP 连接。"),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::error::RemoteErrorKind;

    // -----------------------------------------------------------------
    // 纯函数
    // -----------------------------------------------------------------

    #[test]
    fn octal_and_rwx_triplets_round_trip() {
        for mode in [0o000u32, 0o400, 0o644, 0o755, 0o777, 0o600, 0o750] {
            let triplets = mode_to_permission_triplets(mode);
            assert_eq!(
                permission_triplets_to_mode([&triplets[0], &triplets[1], &triplets[2]]),
                mode,
                "{mode:o} 来回换算必须回到自己"
            );
        }
    }

    #[test]
    fn the_common_modes_read_the_way_a_user_expects() {
        assert_eq!(
            mode_to_permission_triplets(0o755),
            ["rwx".to_string(), "r-x".to_string(), "r-x".to_string()]
        );
        assert_eq!(
            mode_to_permission_triplets(0o644),
            ["rw-".to_string(), "r--".to_string(), "r--".to_string()]
        );
        assert_eq!(
            mode_to_permission_triplets(0o700),
            ["rwx".to_string(), "---".to_string(), "---".to_string()]
        );
        assert_eq!(
            mode_to_permission_triplets(0o000),
            ["---".to_string(), "---".to_string(), "---".to_string()]
        );
    }

    /// `setuid` / `setgid` / `sticky` 不属于那三段 `rwx`。
    /// 混进去的话 `chmod 4755` 会显示成 `rws`，而用户以为那是普通的 755。
    #[test]
    fn special_bits_stay_out_of_the_triplets() {
        assert_eq!(
            mode_to_permission_triplets(0o4755),
            ["rwx".to_string(), "r-x".to_string(), "r-x".to_string()]
        );
        assert_eq!(
            permission_triplets_to_mode(["rwx", "r-x", "r-x"]),
            0o755
        );
    }

    #[test]
    fn triplets_are_read_in_read_write_execute_order() {
        // 位置即含义：`r-x` 是「可读可执行」，不是「可读可写」。
        // 顺序错了的话 0o555 会被读成 0o666 —— 而这两种权限在真实文件上都有，
        // 用户根本看不出对话框在说错。
        assert_eq!(permission_triplets_to_mode(["r-x", "r-x", "r-x"]), 0o555);
        assert_eq!(permission_triplets_to_mode(["rwx", "rwx", "rwx"]), 0o777);
        // 三段落在三个不同的位上，任何一段错位都会改变整体数值。
        assert_eq!(permission_triplets_to_mode(["r--", "-w-", "--x"]), 0o421);
        // **段序也是位序**：第一段是属主的最高位，第三段是其他人的最低位。
        // 把「只有执行权」看成 0o001 是把属主与其他人的权限搞反了 ——
        // 那个数字在真实文件上属于完全不同的一类权限。
        assert_eq!(permission_triplets_to_mode(["--x", "---", "---"]), 0o100);
        assert_eq!(permission_triplets_to_mode(["---", "---", "--x"]), 0o001);
    }

    #[test]
    fn a_nonsense_triplet_degrades_to_dashes_rather_than_failing() {
        // 权限对话框要把用户手输的东西降级显示，不能为一个 `rrx` 弹错误。
        // `rrx` 命中首位（读）与末位（执行），中间那个 `r` 落在写位上不算数。
        assert_eq!(permission_triplets_to_mode(["rrx", "中文", ""]), 0o500);
        assert_eq!(permission_triplets_to_mode(["中文", "", ""]), 0);
    }

    #[test]
    fn mode_range_is_bounded_by_the_permission_mask() {
        assert!(mode_is_valid(0o644));
        assert!(mode_is_valid(0o7777));
        assert!(!mode_is_valid(0o10000));
        assert!(!mode_is_valid(0o100644), "带文件类型位的 st_mode 不该被接受");
    }

    #[test]
    fn octal_formatting_is_always_four_digits() {
        assert_eq!(format_octal_mode(0o755), "0755");
        assert_eq!(format_octal_mode(0o644), "0644");
        assert_eq!(format_octal_mode(0o7), "0007");
    }

    // -----------------------------------------------------------------
    // 路径拼接
    // -----------------------------------------------------------------

    #[test]
    fn remote_children_go_through_the_path_family() {
        assert_eq!(
            join_remote_child("/", "pub").expect("valid name"),
            "/pub"
        );
        assert_eq!(
            join_remote_child("/pub", "readme.txt").expect("valid name"),
            "/pub/readme.txt"
        );
        assert_eq!(
            join_remote_child("/pub/", "docs").expect("valid name"),
            "/pub/docs"
        );
        assert_eq!(
            join_remote_child("/pub", "文档 1.txt").expect("valid name"),
            "/pub/文档 1.txt"
        );
    }

    #[test]
    fn a_name_that_would_escape_the_remote_path_is_rejected() {
        // `join_remote_child("/pub", "..")` 若拼成 `/pub/..`，
        // 后面每一次 `normalize_remote_path` 都会拒绝它 —— 但那时已经建了连接。
        assert!(join_remote_child("/pub", "..").is_err());
        assert!(join_remote_child("/pub", ".").is_err());
        assert!(join_remote_child("/pub", "a/b").is_err());
        assert!(join_remote_child("/pub", "a\r\nQUIT").is_err());
    }

    #[test]
    fn local_children_reject_the_same_things_remote_ones_do() {
        let base = Path::new("C:/downloads");

        assert_eq!(
            join_local_child(base, "readme.txt").expect("valid name"),
            PathBuf::from("C:/downloads/readme.txt")
        );
        assert!(join_local_child(base, "..").is_err());
        assert!(join_local_child(base, "").is_err());
        assert!(join_local_child(base, "a\nb").is_err());
    }

    #[test]
    fn the_unsupported_protocol_error_is_protocol_shaped() {
        let error = unsupported_set_permissions("FTP");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
        assert!(
            error.message.contains("不支持设置权限"),
            "文案必须写明是协议不支持：{}",
            error.message
        );
    }

    // -----------------------------------------------------------------
    // 递归编排：走 `&dyn RemoteProvider`，用假 provider 跑完整棵树
    // -----------------------------------------------------------------

    /// 假 provider 背后的 `&dyn` 视图。递归规则就测它 —— 这条路与
    /// 「三种协议各写一遍」的路是同一条，区别只在叶子动作由谁去做。
    fn fake() -> Box<dyn RemoteProvider> {
        Box::new(crate::remote::fake::FakeRemoteProvider::sample())
    }

    /// 本地目录夹具。放在 `TempDir` 下而不是 `%TEMP%` —— 与全局搜索那套夹具
    /// 同理，本项目的忽略规则里有 `%TEMP%`。
    fn local_tree() -> tempfile::TempDir {
        tempfile::tempdir().expect("temp dir")
    }

    #[tokio::test]
    async fn a_single_file_upload_reports_one_file_and_its_bytes() {
        let dir = local_tree();
        std::fs::write(dir.path().join("note.txt"), b"hello").expect("write local");

        let report = upload(&*fake(), "conn-a", &dir.path().join("note.txt"), "/pub")
            .await
            .expect("upload");

        assert_eq!(report.transferred_files, 1);
        assert_eq!(report.transferred_dirs, 0);
        assert_eq!(report.total_bytes, 5);
        assert!(report.skipped.is_empty());
        assert!(report.failures.is_empty(), "{:?}", report.failures);
    }

    /// 规格 §5 的硬要求：**目标已存在同名文件时不得静默覆盖。**
    #[tokio::test]
    async fn an_existing_remote_file_is_skipped_and_never_overwritten() {        let dir = local_tree();
        std::fs::write(dir.path().join("readme.txt"), b"local version").expect("write local");

        let provider = fake();
        let report = upload(&*provider, "conn-a", &dir.path().join("readme.txt"), "/pub")
            .await
            .expect("upload");

        assert_eq!(report.transferred_files, 0, "同名文件不能被当成传成功了");
        assert_eq!(
            report.skipped,
            vec![RemoteTransferSkip::new(
                "sfm://remote/conn-a/pub/readme.txt".to_string(),
                RemoteTransferSkipReason::AlreadyExists,
            )],
            "跳过的条目必须带原因 —— 前端要能说出「为什么不覆盖」"
        );
        assert_eq!(
            provider
                .read_file("conn-a", "/pub/readme.txt")
                .await
                .expect("read back"),
            b"hello remote".to_vec(),
            "远端那份内容必须原封不动 —— 这是「不静默覆盖」的全部含义"
        );
    }

    /// 覆盖：用户在冲突对话框里点了「覆盖」，同名文件必须**真的被换掉**。
    ///
    /// 这是 2026-10-26 真机验收的直接后果：远端已经有 `index.html`，
    /// 用户传新版本时看到的是「0 个文件上传成功」却不知道为什么。
    #[tokio::test]
    async fn an_overwrite_request_replaces_the_existing_remote_file() {
        let dir = local_tree();
        std::fs::write(dir.path().join("readme.txt"), b"local version").expect("write local");

        let provider = fake();
        let paths = vec![dir.path().join("readme.txt")];
        let overwrite = HashSet::from([paths[0].to_string_lossy().to_string()]);

        let report = upload_many(
            &*provider,
            "conn-a",
            UploadRequest {
                local_paths: &paths,
                remote_dir: "/pub",
                overwrite_paths: &overwrite,
                progress: None,
            },
        )
        .await
        .expect("upload");

        assert_eq!(report.transferred_files, 1, "点了覆盖就要真的传上去");
        assert!(report.skipped.is_empty(), "{:?}", report.skipped);
        assert_eq!(
            provider
                .read_file("conn-a", "/pub/readme.txt")
                .await
                .expect("read back"),
            b"local version".to_vec(),
            "远端那份必须换成新的 —— 这才是「覆盖」"
        );
    }

    /// 覆盖名单**只作用于被点中的那个文件**，其余同名项仍然跳过。
    #[tokio::test]
    async fn an_overwrite_request_does_not_touch_the_other_entries() {
        let dir = local_tree();
        std::fs::write(dir.path().join("readme.txt"), b"local version").expect("write local");
        std::fs::write(dir.path().join("other.txt"), b"other").expect("write local");

        let provider = fake();
        // 远端 `/pub` 里已经有 `readme.txt`，没有 `other.txt`。
        let paths = vec![
            dir.path().join("readme.txt"),
            dir.path().join("other.txt"),
        ];
        let overwrite = HashSet::from([paths[0].to_string_lossy().to_string()]);

        let report = upload_many(
            &*provider,
            "conn-a",
            UploadRequest {
                local_paths: &paths,
                remote_dir: "/pub",
                overwrite_paths: &overwrite,
                progress: None,
            },
        )
        .await
        .expect("upload");

        assert_eq!(report.transferred_files, 2, "两个都该传上去");
        assert!(report.skipped.is_empty(), "{:?}", report.skipped);
    }

    /// 进度：**分母在传输开始前就定下来**，结束时分子必须等于分母。
    ///
    /// 分母要是在传到一半才出现，进度条会先冲到 100% 再掉回 0%。
    #[tokio::test]
    async fn the_progress_sink_reports_a_total_before_the_transfer_starts() {
        let dir = local_tree();
        std::fs::write(dir.path().join("a.txt"), b"aaa").expect("a");
        std::fs::write(dir.path().join("b.txt"), b"bb").expect("b");

        let recorded = Arc::new(Mutex::new(Vec::<TransferProgress>::new()));
        let recorder = recorded.clone();
        let sink = TransferProgressSink::new(move |progress| {
            recorder.lock().expect("记录进度").push(progress);
        });

        let paths = vec![dir.path().join("a.txt"), dir.path().join("b.txt")];
        let overwrite = HashSet::new();

        let report = upload_many(
            &*fake(),
            "conn-a",
            UploadRequest {
                local_paths: &paths,
                remote_dir: "/pub",
                overwrite_paths: &overwrite,
                progress: Some(sink),
            },
        )
        .await
        .expect("upload");

        let snapshots = recorded.lock().expect("读进度").clone();
        assert!(!snapshots.is_empty(), "一次都没报进度，进度条就永远是空的");

        let first = &snapshots[0];
        assert_eq!(first.files_total, 2, "分母必须在传输开始前就有");
        assert_eq!(first.bytes_total, 5, "字节分母也要提前算好");

        let last = snapshots.last().expect("有快照");
        assert_eq!(last.files_done, last.files_total, "结束时分子必须等于分母");
        assert_eq!(last.bytes_done, last.bytes_total);
        assert_eq!(report.transferred_files, 2);
    }

    #[tokio::test]
    async fn a_directory_upload_walks_the_whole_subtree() {
        let dir = local_tree();
        std::fs::create_dir_all(dir.path().join("docs/inner")).expect("mkdirs");
        std::fs::write(dir.path().join("docs/a.txt"), b"aa").expect("a");
        std::fs::write(dir.path().join("docs/inner/b.txt"), b"bbb").expect("b");

        // 临时目录的**名字**就是上传后在远端那一层的目录名 ——
        // 上传目录时整棵子树落在 `<临时目录名>/` 下面，断言要按这个前缀走。
        let root = dir.path().file_name().expect("temp dir has a name").to_string_lossy().to_string();

        let provider = fake();
        let report = upload(&*provider, "conn-a", dir.path(), "/")
            .await
            .expect("upload");

        // 目录本身 + docs + docs/inner
        assert_eq!(report.transferred_dirs, 3);
        assert_eq!(report.transferred_files, 2);
        assert_eq!(report.total_bytes, 5);
        assert!(report.failures.is_empty(), "{:?}", report.failures);

        assert_eq!(
            provider
                .read_file("conn-a", &format!("/{root}/docs/a.txt"))
                .await
                .expect("a landed"),
            b"aa".to_vec()
        );
        assert_eq!(
            provider
                .read_file("conn-a", &format!("/{root}/docs/inner/b.txt"))
                .await
                .expect("b landed"),
            b"bbb".to_vec()
        );
    }

    /// 一个条目失败**不能**让整棵树停下来 —— 传 200 个文件时因为第 7 个
    /// 权限不足而丢掉另外 199 个，是不能接受的。
    #[tokio::test]
    async fn one_unreadable_entry_does_not_stop_the_rest() {
        let dir = local_tree();
        std::fs::create_dir_all(dir.path().join("locked")).expect("mkdir");
        std::fs::write(dir.path().join("locked/secret.txt"), b"x").expect("write");
        std::fs::write(dir.path().join("plain.txt"), b"ok").expect("write");

        // 目标位置上先放一个**同名文件**：真实远端上在那个位置建目录是会失败的，
        // 而不失败的话「目录建不出来」这条路径就永远测不到。
        // 顺序要紧：`write_file` 只会把条目登记进**已经存在**的父目录，
        // 所以先把上传根目录建出来。
        let root = dir.path().file_name().expect("temp dir has a name").to_string_lossy().to_string();
        let provider = fake();
        provider.make_dir("conn-a", &format!("/{root}")).await.expect("seed root");
        provider
            .write_file("conn-a", &format!("/{root}/locked"), b"i am a file".to_vec())
            .await
            .expect("seed");

        let report = upload(&*provider, "conn-a", dir.path(), "/")
            .await
            .expect("upload must not abort");

        assert_eq!(
            report.transferred_files, 1,
            "只有 plain.txt 该传上去；坏掉的那一个不能拖走其余的"
        );
        assert_eq!(
            report.failures.len(), 1, "{:?}", report.failures);
        // 上传根本身是上面为了让 `write_file` 能登记而**预先建好的**，
        // 所以它也进 skipped —— 两条都在才说明「目录已存在」也走的是同一条
        // 「不重复创建」的路径，而不是偷偷覆盖。
        assert_eq!(
            report.skipped,
            vec![
                RemoteTransferSkip::new(
                    format!("sfm://remote/conn-a/{root}"),
                    RemoteTransferSkipReason::AlreadyExists,
                ),
                RemoteTransferSkip::new(
                    format!("sfm://remote/conn-a/{root}/locked"),
                    RemoteTransferSkipReason::AlreadyExists,
                ),
            ],
            "已存在的同名项进 skipped，而不是被覆盖"
        );
        assert!(
            report.failures[0].path.contains("locked"),
            "失败项要指明是哪个：{:?}",
            report.failures
        );
        // 失败项带着类别：前端要按类别给处置建议，而不是只看到一句干话。
        assert!(
            report.failures[0].message.starts_with('['),
            "失败原因要带 kind：{:?}",
            report.failures[0]
        );
    }

    #[tokio::test]
    async fn uploading_a_missing_local_path_fails_before_doing_anything() {
        let dir = local_tree();

        let error = upload(&*fake(), "conn-a", &dir.path().join("nope.txt"), "/pub")
            .await
            .expect_err("must not silently report zero files");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn uploading_a_local_symlink_is_refused_rather_than_followed() {
        // 跟随的话会把链接目标的整棵子树复制过去，而用户看到的只是一个链接。
        let dir = local_tree();
        std::fs::create_dir_all(dir.path().join("target")).expect("mkdir");
        std::fs::write(dir.path().join("target/a.txt"), b"a").expect("a");

        let link = dir.path().join("link");
        let created = {
            #[cfg(windows)]
            {
                std::os::windows::fs::symlink_dir(dir.path().join("target"), &link).is_ok()
            }
            #[cfg(unix)]
            {
                std::os::unix::fs::symlink(dir.path().join("target"), &link).is_ok()
            }
        };

        if !created {
            // Windows 上建符号链接要开发者模式或管理员权限。
            // 造不出来就明说，**不要**假装这条跑过了。
            eprintln!("[skip] 本机不允许创建符号链接，这条用例没有真正执行");
            return;
        }

        let error = upload(&*fake(), "conn-a", &link, "/pub")
            .await
            .expect_err("symlinks must be refused");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    // -----------------------------------------------------------------
    // 下载
    // -----------------------------------------------------------------

    #[tokio::test]
    async fn a_single_file_download_lands_byte_for_byte() {
        let dir = local_tree();

        let report = download(&*fake(), "conn-a", "/pub/readme.txt", dir.path())
            .await
            .expect("download");

        assert_eq!(report.transferred_files, 1);
        assert_eq!(report.total_bytes, 12);
        assert_eq!(
            std::fs::read(dir.path().join("readme.txt")).expect("read back"),
            b"hello remote".to_vec()
        );
    }

    #[tokio::test]
    async fn an_existing_local_file_is_skipped_and_never_overwritten() {
        let dir = local_tree();
        std::fs::write(dir.path().join("readme.txt"), b"mine").expect("seed local");

        let report = download(&*fake(), "conn-a", "/pub/readme.txt", dir.path())
            .await
            .expect("download");

        assert_eq!(report.transferred_files, 0);
        assert_eq!(report.skipped.len(), 1);
        assert_eq!(
            std::fs::read(dir.path().join("readme.txt")).expect("read back"),
            b"mine".to_vec(),
            "本地已有的文件不能被覆盖"
        );
    }

    #[tokio::test]
    async fn a_directory_download_creates_the_missing_local_folders() {
        let dir = local_tree();
        // 目标目录还不存在：用户不该被要求先自己去建一遍。
        let target = dir.path().join("out").join("deeper");

        let report = download(&*fake(), "conn-a", "/pub", &target)
            .await
            .expect("download");

        assert_eq!(report.transferred_dirs, 1);
        assert_eq!(report.transferred_files, 1);
        assert!(target.exists(), "本地目录应当被创建出来");
        // 远端的 `/pub` 本身就是一个条目，所以本地多出来一层 `pub/`。
        assert_eq!(
            std::fs::read(target.join("pub").join("readme.txt")).expect("read back"),
            b"hello remote".to_vec()
        );
    }

    #[tokio::test]
    async fn downloading_an_unknown_remote_path_is_a_not_found_not_a_silent_zero() {
        let dir = local_tree();

        // 2026-10-26：单路径下载不再整体报错，而是**报成一条 failure** ——
        // 报告里带着 kind 与原因，前端能逐条显示出来。
        // 但它**绝不能**变成「静悄悄的 0」：路径不存在必须被说出来。
        let report = download(&*fake(), "conn-a", "/nope/missing.txt", dir.path())
            .await
            .expect("下载失败要变成一条 failure，而不是静悄悄的 0");

        assert_eq!(report.transferred_files, 0);
        assert_eq!(report.failures.len(), 1, "路径不存在必须报出来");
        assert!(
            report.failures[0].message.starts_with("[not_found]"),
            "失败原因要带上类别：{:?}",
            report.failures[0]
        );
    }

    // -----------------------------------------------------------------
    // 权限设置
    // -----------------------------------------------------------------

    #[tokio::test]
    async fn a_non_recursive_chmod_touches_exactly_one_entry() {
        let provider = fake();

        let report = chmod(&*provider, "conn-a", "/pub", 0o755, false)
            .await
            .expect("chmod");

        assert_eq!(report.changed, 1);
        assert!(report.failures.is_empty(), "{:?}", report.failures);
        assert_eq!(
            provider.get_permissions("conn-a", "/pub").await.expect("read back"),
            Some(0o755)
        );
        assert_eq!(
            provider
                .get_permissions("conn-a", "/pub/readme.txt")
                .await
                .expect("read back"),
            None,
            "不递归就只改目录自身，**不是**它的子项"
        );
    }

    /// 递归：目录自身 + 全部后代。
    #[tokio::test]
    async fn a_recursive_chmod_counts_the_directory_and_every_descendant() {
        let provider = crate::remote::fake::FakeRemoteProvider::sample();
        provider.make_dir("conn-a", "/pub/docs").await.expect("mkdir");
        // `/pub` ├ `readme.txt` └ `docs` └ `deep.txt` = 4 个条目
        provider
            .write_file("conn-a", "/pub/docs/deep.txt", b"d".to_vec())
            .await
            .expect("seed");

        let report = chmod(&provider, "conn-a", "/pub", 0o700, true)
            .await
            .expect("chmod");

        assert_eq!(report.changed, 4, "目录自身 + 2 个子项 + 1 个孙项");
        assert!(report.failures.is_empty(), "{:?}", report.failures);

        for path in ["/pub", "/pub/readme.txt", "/pub/docs", "/pub/docs/deep.txt"] {
            assert_eq!(
                provider.get_permissions("conn-a", path).await.expect("read back"),
                Some(0o700),
                "{path} 必须被改到"
            );
        }
    }

    /// 符号链接只改链接自身，**不跟进它指向的目录**。
    #[tokio::test]
    async fn a_recursive_chmod_does_not_walk_through_a_symlinked_directory() {
        use crate::remote::path::build_remote_path;
        use crate::remote::provider::RemoteEntry;
        use std::collections::{BTreeMap, HashMap};

        // 假 provider 的样例树里没有链接，这里另造一个。
        let connection_id = "conn-a";
        let entry = |remote_path: &str, name: &str, is_dir: bool, is_symlink: bool| RemoteEntry {
            name: name.to_string(),
            path: build_remote_path(connection_id, remote_path).expect("valid"),
            is_dir,
            size: 0,
            modified_time: 0,
            is_hidden: false,
            is_symlink,
        };

        let mut directories: BTreeMap<String, Vec<RemoteEntry>> = BTreeMap::new();
        // `/pub` 下有一个指向 `/elsewhere` 的「目录」链接。
        directories.insert(
            "/pub".to_string(),
            vec![entry("/elsewhere", "elsewhere", true, true)],
        );
        directories.insert(
            "/elsewhere".to_string(),
            vec![entry("/elsewhere/inside.txt", "inside.txt", false, false)],
        );

        let provider =
            crate::remote::fake::FakeRemoteProvider::new(HashMap::from([(connection_id.to_string(), directories)]));

        let report = chmod(&provider, connection_id, "/pub", 0o755, true)
            .await
            .expect("chmod");

        // `/pub` 自身 + 链接本身 = 2。链接指向的 `/elsewhere` 一个都不该碰。
        assert_eq!(report.changed, 2, "{:?}", report.failures);
        assert_eq!(
            provider
                .get_permissions(connection_id, "/elsewhere")
                .await
                .expect("read back"),
            None,
            "跟进链接会改到用户根本没选中的那棵树"
        );
        assert_eq!(
            provider
                .get_permissions(connection_id, "/elsewhere/inside.txt")
                .await
                .expect("read back"),
            None
        );
    }

    /// FTP / FTPS 的 provider 必须让 `set_permissions` 变成一条**明确的**失败。
    /// 这条用 trait object 走一遍，好证明协议层的「拒绝」一路传到了编排层。
    #[tokio::test]
    async fn a_provider_that_refuses_chmod_produces_a_failure_not_a_success() {
        let provider: Box<dyn RemoteProvider> = Box::new(crate::remote::ftp_provider::FtpRemoteProvider::new(
            Path::new("C:/none"),
            Path::new("C:/none"),
        ));

        let report = chmod(&*provider, "conn-a", "/pub", 0o755, true)
            .await
            .expect("the recursion itself must not abort");

        assert_eq!(report.changed, 0, "拒绝的协议不能报「改成功了」");
        assert_eq!(report.failures.len(), 1);
        assert!(
            report.failures[0].message.contains("protocol"),
            "失败项要带上 Protocol 这个类别：{:?}",
            report.failures[0]
        );
    }

    #[tokio::test]
    async fn a_mode_beyond_the_permission_mask_is_refused_before_any_transfer() {
        let error = chmod(&*fake(), "conn-a", "/pub", 0o100644, true)
            .await
            .expect_err("st_mode must be refused");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }
}
