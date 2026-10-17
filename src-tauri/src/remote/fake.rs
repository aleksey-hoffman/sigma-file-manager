// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::remote::error::RemoteError;
use crate::remote::path::{build_remote_path, normalize_remote_path};
use crate::remote::provider::{RemoteEntry, RemoteProvider};
use async_trait::async_trait;
use std::collections::{BTreeMap, HashMap};

/// 阶段 0 的唯一 provider 实现：读内存里的固定目录树，不碰网络。
///
/// 它的作用不是「假装能用」，而是**让 trait 有一个可执行的定义** ——
/// 阶段 2 的 FTP provider 与阶段 5 的 SFTP provider 都得对着它跑同一组断言。
/// 阶段 1 会用真实连接注册表取代它在产品路径上的位置，但这个类型保留下来当回归夹具。
pub struct FakeRemoteProvider {
    /// 连接 id → `(规范化远端路径 → 该目录的直接子项)`。
    ///
    /// 内层用 `BTreeMap` 是为了让目录枚举顺序稳定，测试才有可断言的输出；
    /// 真实 provider 的顺序由远端服务器决定，阶段 2 起才需要在前端做稳定排序。
    tree: HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>,
}

impl FakeRemoteProvider {
    pub fn new(tree: HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>) -> Self {
        Self { tree }
    }

    /// 固定示例树：连接 `conn-a`，根下 `pub/`（内含 `readme.txt`）与 `empty/`（空目录）。
    ///
    /// 条目的 `path` 一律用 `build_remote_path` 生成，**不手写字符串** ——
    /// 路径族的规范化规则改了，假 provider 自动跟上，不会悄悄漂移。
    pub fn sample() -> Self {
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

        Self::new(tree)
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
        let normalized = normalize_remote_path(remote_path).ok_or_else(|| {
            RemoteError::protocol(format!("远端路径含有不合法的段: {remote_path}"))
        })?;

        let directories = self.tree.get(connection_id).ok_or_else(|| {
            RemoteError::not_found(format!("未知的远程连接: {connection_id}"))
        })?;

        let entries = directories.get(&normalized).ok_or_else(|| {
            RemoteError::not_found(format!("远程路径不存在: {connection_id}{normalized}"))
        })?;

        Ok(entries.clone())
    }
}
