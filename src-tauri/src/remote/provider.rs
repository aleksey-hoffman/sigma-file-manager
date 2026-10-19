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

    /// 读取远程文件全部内容。
    ///
    /// **没有流式版本**：这是阶段 3 的已知限制，一个大文件会整份进内存。
    /// trait 上刻意不提供 `read_to`/`write_from` 之类的流接口 —— 那样每个协议
    /// 都要实现两套（FTP 的数据连接是「按顺序的字节流」，SFTP 是「按偏移量的
    /// 读写句柄」，形状对不上），而收益要等真的有用户抱怨大文件时才兑现。
    async fn read_file(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<u8>, RemoteError>;

    /// 写入远程文件（**覆盖**语义）。
    ///
    /// 「不静默覆盖已存在的同名文件」**不是**这一层的责任：`transfer` 模块
    /// 在调用之前就会先 `read_dir` 目标目录并把同名项放进 `skipped`。
    /// 这一层要保证的只是「用户显式要求覆盖时能覆盖」。
    async fn write_file(
        &self,
        connection_id: &str,
        remote_path: &str,
        content: Vec<u8>,
    ) -> Result<(), RemoteError>;

    /// 创建远程目录（父目录必须已存在；已存在视为成功）。
    async fn make_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<(), RemoteError>;

    /// 设置权限位（`mode` 是八进制数值，`0755` 传 `0o755`）。
    ///
    /// **FTP / FTPS 不支持，必须返回 `RemoteErrorKind::Protocol` 的明确错误，
    /// 绝不静默成功。** 这里**刻意不给默认实现** ——
    /// 有默认实现的话，新加一个 provider 时「忘了写」会变成编译通过、
    /// 用户点了没反应、报告还显示成功。宁可让编译器逼每个实现方表态。
    async fn set_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
        mode: u32,
    ) -> Result<(), RemoteError>;

    /// 读取权限位（低 12 位，`0o7777` 掩码）。
    ///
    /// `Ok(None)` 表示「**取不到**」，两种情形共用它：
    /// 路径不存在，以及**该协议压根没有可靠的权限位**（FTP / FTPS）。
    /// 权限设置对话框要靠这个区分「显示当前权限」与「不支持改权限」，
    /// 所以走错成 `Err` 会让每一次打开对话框都变成一次未捕获异常。
    async fn get_permissions(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Option<u32>, RemoteError>;
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

    /// 阶段 3 加的五个方法同样要能被 dyn 调用 ——
    /// `transfer.rs` 的整个递归编排就是靠 `&dyn RemoteProvider` 跑的。
    #[tokio::test]
    async fn the_transfer_methods_are_usable_through_a_trait_object() {
        let provider: Box<dyn RemoteProvider> =
            Box::new(FakeRemoteProvider::sample_with_writable_files(vec![]));

        provider
            .write_file("conn-a", "/pub/new.txt", b"body".to_vec())
            .await
            .expect("write");
        assert_eq!(
            provider.read_file("conn-a", "/pub/new.txt").await.expect("read"),
            b"body".to_vec()
        );

        provider.make_dir("conn-a", "/pub/sub").await.expect("mkdir");
        provider
            .set_permissions("conn-a", "/pub/sub", 0o750)
            .await
            .expect("chmod");
        assert_eq!(
            provider.get_permissions("conn-a", "/pub/sub").await.expect("mode"),
            Some(0o750)
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
