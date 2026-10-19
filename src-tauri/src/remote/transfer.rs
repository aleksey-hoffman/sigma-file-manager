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

use std::collections::HashSet;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;

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
    /// 因「目标已存在」而跳过的条目（完整路径）。
    ///
    /// 对**目录**来说，「已存在」指的是**没有去创建它**（`transferred_dirs`
    /// 不计它），但仍然会**继续往里合并** —— 否则把一个本地目录传到
    /// 一个已有的同名远端目录下会变成「什么都没传」，那不是用户以为的结果。
    pub skipped: Vec<String>,
    /// 失败条目
    pub failures: Vec<RemoteTransferFailure>,
}

impl RemoteTransferReport {
    /// 记一次失败并继续。**传输不因为单个条目失败而中断**。
    pub fn record_failure(&mut self, path: impl Into<String>, error: &RemoteError) {
        self.failures.push(RemoteTransferFailure::from_error(path, error));
    }

    pub fn record_skip(&mut self, path: impl Into<String>) {
        self.skipped.push(path.into());
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
pub async fn upload(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    local_path: &Path,
    remote_dir: &str,
) -> Result<RemoteTransferReport, RemoteError> {
    reject_path_control_characters(remote_dir)?;

    let normalized = normalize_remote_path(remote_dir).ok_or_else(|| {
        RemoteError::protocol(format!("远端目录路径不合法：{remote_dir}"))
    })?;

    // 上层先探一次存在性，好把「本地路径不存在」和「传了 0 个文件」区分开：
    // 前者是用户传错了，后者是合法的空目录。
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

    let name = local_path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .ok_or_else(|| {
            RemoteError::protocol(format!("本地路径没有文件名，无法上传：{local_path:?}"))
        })?;

    let target = join_remote_child(&normalized, &name)?;
    let existing = remote_child_names(provider, connection_id, &normalized).await?;
    let mut report = RemoteTransferReport::default();

    if kind.file_type().is_dir() {
        if existing.contains(&name) {
            report.record_skip(remote_display_path(connection_id, &target));
        }
        else if let Err(error) = provider.make_dir(connection_id, &target).await {
            report.record_failure(remote_display_path(connection_id, &target), &error);
            return Ok(report);
        }
        else {
            report.record_dir();
        }

        upload_directory(provider, connection_id, &local_path, &target, &mut report).await?;
    }
    else {
        upload_file(provider, connection_id, &local_path, &target, &existing, &mut report).await?;
    }

    Ok(report)
}

/// 把一个本地文件传到远端。目标已存在则进 `skipped`，**不静默覆盖**。
async fn upload_file(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    local_path: &Path,
    target: &str,
    existing: &HashSet<String>,
    report: &mut RemoteTransferReport,
) -> Result<(), RemoteError> {
    let name = match local_path.file_name() {
        Some(name) => name.to_string_lossy().to_string(),
        None => return Ok(()),
    };

    if existing.contains(&name) {
        report.record_skip(remote_display_path(connection_id, target));
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

    match provider.write_file(connection_id, target, content).await {
        Ok(()) => report.record_file(bytes),
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
                    report.record_skip(remote_display_path(connection_id, &child_remote));
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

/// 下载：远程**文件或目录** → 本地目录。
///
/// 本地目录不存在就创建 —— 用户在「下载到」里敲一个还没建过的文件夹名时，
/// 让他自己先去建一遍是本末倒置。
pub async fn download(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
    local_dir: &Path,
) -> Result<RemoteTransferReport, RemoteError> {
    reject_path_control_characters(remote_path)?;

    let normalized = normalize_remote_path(remote_path).ok_or_else(|| {
        RemoteError::protocol(format!("远端路径不合法：{remote_path}"))
    })?;

    let local_dir = local_dir.to_path_buf();
    let prepared = local_dir.clone();
    blocking("准备本地目录", move || {
        std::fs::create_dir_all(&prepared).map_err(|error| {
            RemoteError::unknown(format!("创建本地目录失败：{error}"))
        })
    })
    .await?;

    let name = normalized
        .rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| {
            RemoteError::protocol("下载的根是远程空间根，没有可下载的条目名")
        })?
        .to_string();

    // 是目录还是文件，只能问远端 —— trait 没有 `stat`，
    // 而列父目录拿不到「文件」这一项的大小以外的信息，够了。
    let entry = remote_entry_of(provider, connection_id, &normalized).await?;

    let mut report = RemoteTransferReport::default();

    if entry.is_dir {
        let target = join_local_child(&local_dir, &name)?;

        if target.exists() {
            report.record_skip(target.to_string_lossy().to_string());
        }
        else {
            let created = target.clone();
            blocking("创建本地目录", move || {
                std::fs::create_dir_all(&created).map_err(|error| {
                    RemoteError::unknown(format!("创建本地目录失败：{error}"))
                })
            })
            .await?;
            report.record_dir();
        }

        download_directory(provider, connection_id, &normalized, &target, &mut report).await?;
    }
    else {
        download_file(provider, connection_id, &normalized, &local_dir, &name, &mut report).await?;
    }

    Ok(report)
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

/// 下载一个远程文件。目标已存在则进 `skipped`，**不静默覆盖**。
async fn download_file(
    provider: &dyn RemoteProvider,
    connection_id: &str,
    remote_path: &str,
    local_dir: &Path,
    name: &str,
    report: &mut RemoteTransferReport,
) -> Result<(), RemoteError> {
    let target = join_local_child(local_dir, name)?;
    let display = target.to_string_lossy().to_string();

    if target.exists() {
        report.record_skip(display);
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
    let written = target.clone();
    let outcome = blocking("写入本地文件", move || {
        std::fs::write(&written, &content).map_err(|error| {
            RemoteError::unknown(format!("写入本地文件失败：{error}"))
        })
    })
    .await;

    match outcome {
        Ok(()) => report.record_file(bytes),
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
                report.record_skip(child_local.to_string_lossy().to_string());
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
    async fn an_existing_remote_file_is_skipped_and_never_overwritten() {
        let dir = local_tree();
        std::fs::write(dir.path().join("readme.txt"), b"local version").expect("write local");

        let provider = fake();
        let report = upload(&*provider, "conn-a", &dir.path().join("readme.txt"), "/pub")
            .await
            .expect("upload");

        assert_eq!(report.transferred_files, 0, "同名文件不能被当成传成功了");
        assert_eq!(
            report.skipped,
            vec!["sfm://remote/conn-a/pub/readme.txt".to_string()]
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
                format!("sfm://remote/conn-a/{root}"),
                format!("sfm://remote/conn-a/{root}/locked"),
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

        let error = download(&*fake(), "conn-a", "/nope/missing.txt", dir.path())
            .await
            .expect_err("must fail");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
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
