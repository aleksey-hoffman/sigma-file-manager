// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::remote::error::RemoteError;
use crate::remote::path::{build_remote_path, normalize_remote_path};
use crate::remote::provider::{RemoteEntry, RemoteProvider};
use async_trait::async_trait;
use std::collections::{BTreeMap, HashMap, HashSet};
use std::sync::Mutex;

/// 阶段 0 的唯一 provider 实现：读内存里的目录树，不碰网络。
///
/// 它的作用不是「假装能用」，而是**让 trait 有一个可执行的定义** ——
/// 阶段 2 的 FTP provider 与阶段 5 的 SFTP provider 都得对着它跑同一组断言。
/// 阶段 1 会用真实连接注册表取代它在产品路径上的位置，但这个类型保留下来当回归夹具。
///
/// # 阶段 3 起它还要能被**写**
///
/// 上传 / 下载 / chmod 的递归编排全在 `transfer.rs`，而那一层对
/// `&dyn RemoteProvider` 泛型化。于是整个递归规则可以用这个假 provider 测完，
/// 不必真连一台服务器 —— 这正是当初把它做成「trait 的可执行定义」的红利。
/// 可写的代价是**内部可变性**：trait 方法只拿到 `&self`。
pub struct FakeRemoteProvider {
    /// 连接 id → `(规范化远端路径 → 该目录的直接子项)`。
    ///
    /// 内层用 `BTreeMap` 是为了让目录枚举顺序稳定，测试才有可断言的输出；
    /// 真实 provider 的顺序由远端服务器决定，阶段 2 起才需要在前端做稳定排序。
    tree: Mutex<HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>>,
    /// 连接 id → `(规范化远端路径 → 文件内容)`。
    files: Mutex<HashMap<String, BTreeMap<String, Vec<u8>>>>,
    /// `(连接 id, 规范化远端路径)` → 权限位。低 12 位。
    modes: Mutex<HashMap<(String, String), u32>>,
}

/// 上锁失败时的错误。
///
/// 假 provider 的锁只在单测的 `#[tokio::test]`（单线程）里争用，
/// 真的 Poison 了说明测试代码自己有 bug —— 报告成 `Unknown` 而不是 panic，
/// 是为了让「锁坏了」和「远端拒绝了」在断言里区分得开。
fn poisoned(what: &'static str) -> RemoteError {
    RemoteError::unknown(format!("假 provider 的{what}上锁失败"))
}

impl FakeRemoteProvider {
    pub fn new(tree: HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>) -> Self {
        Self {
            tree: Mutex::new(tree),
            files: Mutex::new(HashMap::new()),
            modes: Mutex::new(HashMap::new()),
        }
    }

    /// 固定示例树：连接 `conn-a`，根下 `pub/`（内含 `readme.txt`）与 `empty/`（空目录）。
    ///
    /// 条目的 `path` 一律用 `build_remote_path` 生成，**不手写字符串** ——
    /// 路径族的规范化规则改了，假 provider 自动跟上，不会悄悄漂移。
    pub fn sample() -> Self {
        Self::sample_with_writable_files(vec![(
            "/pub/readme.txt".to_string(),
            b"hello remote".to_vec(),
        )])
    }

    /// 与 [`Self::sample`] 相同，但预置若干文件内容，供传输测试使用。
    pub fn sample_with_writable_files(files: Vec<(String, Vec<u8>)>) -> Self {
        let connection_id = "conn-a";

        let entry = |remote_path: &str, name: &str, is_dir: bool, size: u64| RemoteEntry {
            name: name.to_string(),
            path: build_remote_path(connection_id, remote_path)
                .expect("sample connection id is valid"),
            is_dir,
            size,
            modified_time: 1_700_000_000_000,
            is_hidden: false,
            is_symlink: false,
        };

        let mut directories = BTreeMap::new();
        directories.insert(
            "/".to_string(),
            vec![entry("/pub", "pub", true, 0), entry("/empty", "empty", true, 0)],
        );
        directories.insert(
            "/pub".to_string(),
            vec![entry("/pub/readme.txt", "readme.txt", false, 12)],
        );
        directories.insert("/empty".to_string(), Vec::new());

        let mut tree = HashMap::new();
        tree.insert(connection_id.to_string(), directories);

        let mut per_connection = BTreeMap::new();
        for (remote_path, content) in files {
            per_connection.insert(
                normalize_remote_path(&remote_path).expect("valid path"),
                content,
            );
        }

        Self {
            tree: Mutex::new(tree),
            files: Mutex::new(HashMap::from([(connection_id.to_string(), per_connection)])),
            modes: Mutex::new(HashMap::new()),
        }
    }

    /// 规范化路径并确认连接存在。**先查连接、再查路径**，
    /// 与既有 `read_dir` 的错误优先级一致。
    fn lookup(&self, connection_id: &str, remote_path: &str) -> Result<String, RemoteError> {
        let normalized = normalize_remote_path(remote_path).ok_or_else(|| {
            RemoteError::protocol(format!("远端路径含有不合法的段: {remote_path}"))
        })?;

        let tree = self.tree.lock().map_err(|_| poisoned("目录树"))?;

        if !tree.contains_key(connection_id) {
            return Err(RemoteError::not_found(format!("未知的远程连接: {connection_id}")));
        }

        Ok(normalized)
    }

    /// 一个远端目录下现存条目的**名字集合**。`transfer` 用它判「已存在 ⇒ 跳过」。
    pub fn child_names(&self, connection_id: &str, remote_path: &str) -> Option<HashSet<String>> {
        let normalized = normalize_remote_path(remote_path)?;
        let tree = self.tree.lock().ok()?;

        tree.get(connection_id)?
            .get(&normalized)
            .map(|entries| entries.iter().map(|entry| entry.name.clone()).collect())
    }

    /// 把一个条目登记进父目录的列表。
    ///
    /// **写了文件也要登记**：真实的远端上，写完一个文件之后父目录里就有它了。
    /// 不登记的话 `transfer` 的「已存在 ⇒ 跳过」永远判不到，
    /// 而「在同名文件的位置上建目录」也永远失败不了 ——
    /// 这两件事都会让上传的失败路径完全测不到。
    fn upsert_entry(
        tree: &mut HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>,
        connection_id: &str,
        normalized: &str,
        is_dir: bool,
    ) {
        let Some((parent, name)) = normalized.rsplit_once('/') else {
            return;
        };

        let parent = if parent.is_empty() { "/" } else { parent };
        let Some(directories) = tree.get_mut(connection_id) else {
            return;
        };

        let Some(siblings) = directories.get_mut(parent) else {
            return;
        };

        let path = build_remote_path(connection_id, normalized).expect("valid connection id");

        if let Some(existing) = siblings.iter_mut().find(|entry| entry.name == name) {
            existing.is_dir = is_dir;
            existing.path = path;
            return;
        }

        siblings.push(RemoteEntry {
            name: name.to_string(),
            path,
            is_dir,
            size: 0,
            modified_time: 1_700_000_000_000,
            is_hidden: false,
            is_symlink: false,
        });
    }
}

#[async_trait]
impl RemoteProvider for FakeRemoteProvider {
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError> {
        // 调用方可能是用户手输的路径，先按路径族规则规范化再查表。
        let normalized = self.lookup(connection_id, remote_path)?;

        let tree = self.tree.lock().map_err(|_| poisoned("目录树"))?;
        let entries = tree
            .get(connection_id)
            .and_then(|directories| directories.get(&normalized))
            .ok_or_else(|| {
                RemoteError::not_found(format!("远程路径不存在: {connection_id}{normalized}"))
            })?;

        Ok(entries.clone())
    }

    async fn read_file(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<u8>, RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let store = self.files.lock().map_err(|_| poisoned("文件表"))?;

        store
            .get(connection_id)
            .and_then(|files| files.get(&normalized))
            .cloned()
            .ok_or_else(|| {
                RemoteError::not_found(format!("远程路径不存在: {connection_id}{normalized}"))
            })
    }

    async fn write_file(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let mut store = self.files.lock().map_err(|_| poisoned("文件表"))?;

        store
            .entry(connection_id.to_string())
            .or_default()
            .insert(normalized.clone(), content);

        let mut tree = self.tree.lock().map_err(|_| poisoned("目录树"))?;
        Self::upsert_entry(&mut tree, connection_id, &normalized, false);

        Ok(())
    }

    async fn make_dir(&self, connection_id: &str, remote_path: &str) -> Result<(), RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let mut tree = self.tree.lock().map_err(|_| poisoned("目录树"))?;

        // 「已存在视为成功」是 trait 的约定。
        if tree
            .get(connection_id)
            .is_some_and(|directories| directories.contains_key(&normalized))
        {
            return Ok(());
        }

        let (parent, name) = normalized.rsplit_once('/').expect("路径恒以 / 开头");
        let parent = if parent.is_empty() { "/" } else { parent };

        // **同名文件挡在那儿时必须失败** —— 真实的远端上这会失败，
        // 而不失败的话「目录建不出来」这条上传失败路径就永远测不到。
        let blocked = tree
            .get(connection_id)
            .and_then(|directories| directories.get(parent))
            .and_then(|siblings| siblings.iter().find(|entry| entry.name == name))
            .is_some_and(|blocker| !blocker.is_dir);

        if blocked {
            return Err(RemoteError::protocol(format!(
                "远端已有一个同名文件占着这个位置，建不了目录: {connection_id}{normalized}"
            )));
        }

        if let Some(directories) = tree.get_mut(connection_id) {
            directories.insert(normalized.clone(), Vec::new());
        }

        Self::upsert_entry(&mut tree, connection_id, &normalized, true);

        Ok(())
    }

    async fn set_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
        mode: u32,
    ) -> Result<(), RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let mut modes = self.modes.lock().map_err(|_| poisoned("权限表"))?;

        modes.insert((connection_id.to_string(), normalized), mode & 0o7777);

        Ok(())
    }

    async fn get_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Option<u32>, RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let modes = self.modes.lock().map_err(|_| poisoned("权限表"))?;

        Ok(modes
            .get(&(connection_id.to_string(), normalized))
            .copied())
    }

    /// 删掉一个条目。
    ///
    /// 目录**必须为空** —— 与真实 SFTP / FTP 一致。
    /// 这里必须**真的失败**，而不是悄悄把整棵子树抹掉：
    /// 假 provider 一旦比真实服务器宽松，递归编排的失败路径就永远测不到，
    /// 而那正是「删了一半」这种最坏结果最可能出现的地方。
    async fn remove_path(
        &self,
        connection_id: &str,
        remote_path: &str,
        is_dir: bool,
    ) -> Result<(), RemoteError> {
        let normalized = self.lookup(connection_id, remote_path)?;
        let mut tree = self.tree.lock().map_err(|_| poisoned("目录树"))?;

        let Some(directories) = tree.get_mut(connection_id) else {
            return Err(RemoteError::not_found(format!(
                "未知的远程连接: {connection_id}"
            )));
        };

        let (parent, name) = normalized.rsplit_once('/').expect("路径恒以 / 开头");
        let parent = if parent.is_empty() { "/" } else { parent };

        // **不可变借用阶段**：先找位置、判空。
        // 顺序有硬约束：`directories.get_mut(parent)` 拿到的借用会一直活到
        // 函数结束，在它之后再 `directories.get(..)` / `directories.remove(..)`
        // 就是同时可变与不可变借用同一个 map —— 编译不过。
        let (position, has_children) = {
            let Some(siblings) = directories.get(parent) else {
                return Err(RemoteError::not_found(format!(
                    "远程路径不存在: {connection_id}{normalized}"
                )));
            };

            let Some(position) = siblings.iter().position(|entry| entry.name == name) else {
                return Err(RemoteError::not_found(format!(
                    "远程路径不存在: {connection_id}{normalized}"
                )));
            };

            let has_children = directories
                .get(&normalized)
                .is_some_and(|children| !children.is_empty());

            (position, has_children)
        };

        if is_dir && has_children {
            return Err(RemoteError::protocol(format!(
                "这个远端目录不是空的，SFTP 不支持递归删除：{normalized}"
            )));
        }

        // **可变借用阶段**：从目录表里摘掉这个条目。
        if is_dir {
            directories.remove(&normalized);
        }

        if let Some(siblings) = directories.get_mut(parent) {
            siblings.remove(position);
        }

        // 文件内容也一并清掉：留着的话「删了之后再读」会读到已删的文件，
        // 那是一条只在假 provider 上才成立的假象。
        let mut files = self.files.lock().map_err(|_| poisoned("文件表"))?;
        if let Some(per_connection) = files.get_mut(connection_id) {
            per_connection.remove(&normalized);
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::error::RemoteErrorKind;

    #[tokio::test]
    async fn a_file_that_was_never_registered_reads_as_not_found() {
        let provider = FakeRemoteProvider::sample_with_writable_files(vec![]);
        let error = provider
            .read_file("conn-a", "/pub/readme.txt")
            .await
            .expect_err("no file was registered");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn a_written_file_reads_back_byte_for_byte() {
        let provider = FakeRemoteProvider::sample_with_writable_files(vec![]);

        provider
            .write_file("conn-a", "/pub/新文件.txt", b"payload".to_vec())
            .await
            .expect("write");

        assert_eq!(
            provider
                .read_file("conn-a", "/pub/新文件.txt")
                .await
                .expect("read back"),
            b"payload".to_vec()
        );
    }

    #[tokio::test]
    async fn a_created_directory_is_immediately_listable() {
        let provider = FakeRemoteProvider::sample();

        provider.make_dir("conn-a", "/新建").await.expect("mkdir");

        assert!(provider.read_dir("conn-a", "/新建").await.expect("list").is_empty());
        assert_eq!(
            provider
                .read_dir("conn-a", "/")
                .await
                .expect("list root")
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["pub", "empty", "新建"],
            "新目录要出现在父目录的列表里，否则递归上传会以为它建失败了"
        );
    }

    #[tokio::test]
    async fn creating_a_directory_twice_is_a_no_op() {
        let provider = FakeRemoteProvider::sample();

        provider.make_dir("conn-a", "/pub").await.expect("first mkdir");
        provider.make_dir("conn-a", "/pub").await.expect("second mkdir");

        // 「已存在视为成功」，且**不能**因此多出一张重复卡片。
        assert_eq!(
            provider
                .read_dir("conn-a", "/")
                .await
                .expect("list")
                .iter()
                .filter(|entry| entry.name == "pub")
                .count(),
            1
        );
    }

    #[tokio::test]
    async fn permissions_round_trip_masked_to_twelve_bits() {
        let provider = FakeRemoteProvider::sample();

        provider
            .set_permissions("conn-a", "/pub/readme.txt", 0o100755)
            .await
            .expect("chmod");

        // `0o100755` 是把文件类型位一起传进来的症状，只保留低 12 位。
        assert_eq!(
            provider
                .get_permissions("conn-a", "/pub/readme.txt")
                .await
                .expect("read back"),
            Some(0o755)
        );
    }

    #[tokio::test]
    async fn permissions_that_were_never_set_read_as_none_not_as_an_error() {
        // 权限设置对话框靠这个显示「当前权限」，走错成 Err 会让每次开框都炸。
        let provider = FakeRemoteProvider::sample();

        assert_eq!(
            provider
                .get_permissions("conn-a", "/pub/readme.txt")
                .await
                .expect("must not error"),
            None
        );
    }

    #[tokio::test]
    async fn an_unknown_connection_is_reported_before_any_lookup() {
        let provider = FakeRemoteProvider::sample();

        let error = provider
            .read_file("conn-missing", "/pub/readme.txt")
            .await
            .expect_err("unknown connection");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    // ---- 删除 -------------------------------------------------------------

    /// 目录里的直接子项名字。断言「还在不在」用这个最省事。
    async fn child_names(provider: &FakeRemoteProvider, path: &str) -> Vec<String> {
        let mut names: Vec<String> = provider
            .read_dir("conn-a", path)
            .await
            .expect("list")
            .into_iter()
            .map(|entry| entry.name)
            .collect();

        names.sort();

        names
    }

    #[tokio::test]
    async fn a_removed_file_disappears_from_its_directory() {
        let provider = FakeRemoteProvider::sample();

        provider
            .remove_path("conn-a", "/pub/readme.txt", false)
            .await
            .expect("remove");

        assert_eq!(child_names(&provider, "/pub").await, Vec::<String>::new());
    }

    #[tokio::test]
    async fn a_removed_file_can_no_longer_be_read() {
        // 内容表必须一起清掉：留着的话「删了之后再读」还能读到内容，
        // 那是一条只在假 provider 上才成立的假象。
        let provider = FakeRemoteProvider::sample();

        provider
            .remove_path("conn-a", "/pub/readme.txt", false)
            .await
            .expect("remove");

        let error = provider
            .read_file("conn-a", "/pub/readme.txt")
            .await
            .expect_err("the file was removed");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn a_non_empty_directory_refuses_to_be_removed_and_stays_where_it_was() {
        // **必须真的失败**，不能悄悄把整棵子树抹掉：
        // 假 provider 一旦比真实服务器宽松，「目录非空」这条失败路径
        // 在产品代码里就永远测不到。
        let provider = FakeRemoteProvider::sample();

        let error = provider
            .remove_path("conn-a", "/pub", true)
            .await
            .expect_err("the directory is not empty");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
        assert!(error.message.contains("不是空的"), "{}", error.message);
        // 失败之后目录必须还在原地。
        assert_eq!(
            child_names(&provider, "/").await,
            vec!["empty".to_string(), "pub".to_string()]
        );
    }

    #[tokio::test]
    async fn an_empty_directory_can_be_removed() {
        let provider = FakeRemoteProvider::sample();

        provider
            .remove_path("conn-a", "/empty", true)
            .await
            .expect("remove");

        assert_eq!(
            child_names(&provider, "/").await,
            vec!["pub".to_string()]
        );
    }

    #[tokio::test]
    async fn removing_a_path_that_is_not_there_is_reported_as_not_found() {
        let provider = FakeRemoteProvider::sample();

        let error = provider
            .remove_path("conn-a", "/pub/nope.txt", false)
            .await
            .expect_err("nothing to remove");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn removing_from_an_unknown_connection_is_reported_as_not_found() {
        let provider = FakeRemoteProvider::sample();

        let error = provider
            .remove_path("conn-missing", "/pub/readme.txt", false)
            .await
            .expect_err("unknown connection");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }
}
