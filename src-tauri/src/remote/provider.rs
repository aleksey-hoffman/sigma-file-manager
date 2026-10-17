// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

use crate::remote::error::RemoteError;
use async_trait::async_trait;
use serde::{Deserialize, Serialize};

/// 远程目录条目。
///
/// 时间单位与 `dir_reader::types::DirEntry.modified_time` 一致：
/// **Unix 纪元毫秒**（后端 `metadata_times_unix_ms`）。这里写死是因为
/// `RemoteEntry` 最终要被适配成本地 `DirEntry`，单位不一致会让「按修改时间排序」
/// 在远程目录下变成一片随机顺序，而且不会报错。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteEntry {
    pub name: String,
    /// 完整 `sfm://remote/<连接id>/<远端路径>` 形式，可直接喂给前端导航。
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified_time: u64,
    pub is_hidden: bool,
    pub is_symlink: bool,
}

/// 所有远程协议（FTP / FTPS / SFTP）的统一入口。
///
/// 刻意是 **async**：FTP 与 SFTP 库（`suppaftp` / `russh-sftp`）都是异步的。
/// 现在写成同步的，阶段 2 就要把这个 trait 连同所有调用点一起推翻重来。
///
/// 刻意用 `#[async_trait]` 而非原生 AFIT：阶段 1 的连接注册表要存
/// `HashMap<String, Box<dyn RemoteProvider>>`，而原生 AFIT 不是 dyn 兼容的。
/// 有一条测试专门锁住这个决策（见下方 `providers_are_usable_through_a_trait_object`）。
#[async_trait]
pub trait RemoteProvider: Send + Sync {
    /// 列出 `remote_path` 下的直接子项。
    ///
    /// 实现方**必须**把传入的 `remote_path` 过一遍 `normalize_remote_path` ——
    /// 调用方可能是用户手输的 `pub//docs`。返回的每个 `RemoteEntry.path`
    /// 必须是完整的 `sfm://remote/...` 路径。
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError>;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::remote::error::RemoteErrorKind;
    use crate::remote::fake::FakeRemoteProvider;

    #[tokio::test]
    async fn fake_provider_returns_configured_entries() {
        let provider = FakeRemoteProvider::sample();
        let entries = provider
            .read_dir("conn-a", "/")
            .await
            .expect("sample root must be readable");

        assert_eq!(entries.len(), 2);
        assert!(entries
            .iter()
            .all(|entry| entry.path.starts_with("sfm://remote/conn-a/")));
    }

    #[tokio::test]
    async fn fake_provider_normalizes_the_incoming_remote_path() {
        let provider = FakeRemoteProvider::sample();

        // 与 `parse_remote_path` 同一套规范化：尾斜杠与连续斜杠都要被折叠
        let with_slash = provider
            .read_dir("conn-a", "/pub/")
            .await
            .expect("trailing slash must still resolve");
        let without_slash = provider
            .read_dir("conn-a", "/pub")
            .await
            .expect("plain path must resolve");
        let doubled = provider
            .read_dir("conn-a", "/pub//")
            .await
            .expect("repeated slash must still resolve");

        assert_eq!(with_slash, without_slash);
        assert_eq!(doubled, without_slash);
        assert_eq!(with_slash.len(), 1);
    }

    #[tokio::test]
    async fn fake_provider_reports_unknown_paths_as_not_found() {
        let provider = FakeRemoteProvider::sample();
        let error = provider
            .read_dir("conn-a", "/nope")
            .await
            .expect_err("unknown path must fail");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn fake_provider_reports_unknown_connections_as_not_found() {
        let provider = FakeRemoteProvider::sample();
        let error = provider
            .read_dir("conn-missing", "/")
            .await
            .expect_err("unknown connection must fail");

        assert_eq!(error.kind, RemoteErrorKind::NotFound);
    }

    #[tokio::test]
    async fn fake_provider_rejects_dot_segments_as_protocol_errors() {
        let provider = FakeRemoteProvider::sample();
        let error = provider
            .read_dir("conn-a", "/pub/../etc")
            .await
            .expect_err("dot-dot segments must be rejected");

        assert_eq!(error.kind, RemoteErrorKind::Protocol);
    }

    #[tokio::test]
    async fn providers_are_usable_through_a_trait_object() {
        // 这一条锁住「dyn 兼容」这个决策：如果哪天有人把 `#[async_trait]` 换成原生 AFIT，
        // 这条测试会**编译失败**，从而在阶段 1 动手之前就把问题暴露出来。
        let provider: Box<dyn RemoteProvider> = Box::new(FakeRemoteProvider::sample());

        assert_eq!(
            provider
                .read_dir("conn-a", "/")
                .await
                .expect("read through the trait object")
                .len(),
            2
        );
    }

    #[test]
    fn remote_entry_serializes_for_the_frontend() {
        let entry = RemoteEntry {
            name: "readme.txt".to_string(),
            path: "sfm://remote/conn-a/readme.txt".to_string(),
            is_dir: false,
            size: 12,
            modified_time: 1_700_000_000_000,
            is_hidden: false,
            is_symlink: false,
        };
        let json = serde_json::to_value(&entry).expect("serialize");

        assert_eq!(json["name"], "readme.txt");
        assert_eq!(json["path"], "sfm://remote/conn-a/readme.txt");
        assert_eq!(json["is_dir"], false);
        assert_eq!(json["size"], 12);
        assert_eq!(json["modified_time"], 1_700_000_000_000_u64);
    }
}
