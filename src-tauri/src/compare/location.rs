// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 比较引擎的「一侧」与「条目」模型。
//!
//! 这一层**刻意不碰 tauri**：它只描述数据，序列化给前端用。
//! 见 `compare/commands.rs` 顶部的红线说明。

use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// 条目的种类。
///
/// 符号链接**单独成一类**而不是并进文件：比较时**不跟随**链接
/// （跟随会走进环里，比较就停不下来），所以它按「链接本身」参与比较。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryKind {
    File,
    Directory,
    Symlink,
    Other,
}

impl EntryKind {
    /// 是否是目录。**只有目录会被递归下去。**
    pub fn is_directory(self) -> bool {
        matches!(self, EntryKind::Directory)
    }
}

/// 比较的一侧。
///
/// 本地侧是路径，远程侧是「连接 id + 远端路径」。
///
/// 两侧用**同一套类型**表达，所以「本地 ↔ 本地」「本地 ↔ 远程」
/// 在引擎里走的是同一条代码路径 —— 阶段 A 支持本地↔本地
/// 就是靠这个泛化白拿的，不用另写一套。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LocationRef {
    Local {
        path: PathBuf,
    },
    Remote {
        #[serde(rename = "connectionId")]
        connection_id: String,
        path: String,
    },
}

impl LocationRef {
    pub fn local(path: impl Into<PathBuf>) -> Self {
        LocationRef::Local {
            path: path.into(),
        }
    }

    pub fn remote(connection_id: impl Into<String>, path: impl Into<String>) -> Self {
        LocationRef::Remote {
            connection_id: connection_id.into(),
            path: path.into(),
        }
    }

    /// 界面上显示的一行说明。
    pub fn display_label(&self) -> String {
        match self {
            LocationRef::Local { path } => path.display().to_string(),
            LocationRef::Remote {
                connection_id,
                path,
            } => format!("sfm://remote/{connection_id}{path}"),
        }
    }

    /// 在这一侧下面挂一个相对路径，得到新的一侧。
    ///
    /// `rel_path` 用 `/` 分隔（收集阶段就是这么产的），
    /// 本地侧按段拼，远程侧直接接在远端路径后面。
    pub fn join_relative(&self, rel_path: &str) -> LocationRef {
        match self {
            LocationRef::Local { path } => {
                let mut joined = path.clone();

                for segment in rel_path.split('/').filter(|part| !part.is_empty()) {
                    joined.push(segment);
                }

                LocationRef::Local { path: joined }
            }
            LocationRef::Remote {
                connection_id,
                path,
            } => {
                LocationRef::Remote {
                    connection_id: connection_id.clone(),
                    path: join_remote_base(path, rel_path),
                }
            }
        }
    }
}

/// 把相对路径接到远端根路径后面。
///
/// 根是 `/` 时不能拼成 `//foo` —— 在某些 SFTP 服务器上那是两条不同的路径。
fn join_remote_base(base: &str, rel_path: &str) -> String {
    let trimmed = base.trim_end_matches('/');
    let mut result = String::with_capacity(trimmed.len() + rel_path.len() + 1);

    if !trimmed.is_empty() {
        result.push_str(trimmed);
    }

    for segment in rel_path.split('/').filter(|part| !part.is_empty()) {
        result.push('/');
        result.push_str(segment);
    }

    if result.is_empty() {
        result.push('/');
    }

    result
}

/// 收集到的一侧的条目元数据。
///
/// 时间单位是 **Unix 纪元毫秒**，与 `dir_reader::types::DirEntry.modified_time`
/// 和 `remote::provider::RemoteEntry.modified_time` 一致 —— 三处必须同单位，
/// 否则「按修改时间排序」会变成一片随机顺序，而且不会报错。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EntryMeta {
    pub name: String,
    pub kind: EntryKind,
    pub size: u64,
    pub modified_time: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joining_a_relative_path_onto_a_local_root_keeps_the_segments() {
        let root = LocationRef::local("/tmp/base");
        let joined = root.join_relative("sub/a.txt");

        let LocationRef::Local { path } = joined else {
            panic!("joined must stay local");
        };

        // 不写死分隔符：Windows 上 `PathBuf::push` 用 `\`，
        // 但根路径里原有的 `/` 会留着，直接比字符串会跨平台翻车。
        assert_eq!(path.file_name().and_then(|name| name.to_str()), Some("a.txt"));
        assert_eq!(
            path.parent()
                .and_then(|parent| parent.file_name())
                .and_then(|name| name.to_str()),
            Some("sub")
        );
        assert!(path
            .ancestors()
            .any(|ancestor| ancestor.file_name().and_then(|name| name.to_str()) == Some("base")));
    }

    #[test]
    fn joining_a_relative_path_onto_a_remote_root_uses_forward_slashes() {
        let root = LocationRef::remote("conn-a", "/pub");
        let joined = root.join_relative("sub/a.txt");

        assert_eq!(joined, LocationRef::remote("conn-a", "/pub/sub/a.txt"));
    }

    #[test]
    fn joining_onto_the_remote_root_never_produces_a_double_slash() {
        let root = LocationRef::remote("conn-a", "/");
        let joined = root.join_relative("pub/readme.txt");

        assert_eq!(joined, LocationRef::remote("conn-a", "/pub/readme.txt"));
    }

    #[test]
    fn the_location_serializes_with_a_type_tag_for_the_frontend() {
        let local = serde_json::to_value(LocationRef::local("/tmp/x")).expect("serialize");
        assert_eq!(local["type"], "local");
        assert_eq!(local["path"], "/tmp/x");

        let remote =
            serde_json::to_value(LocationRef::remote("conn-a", "/pub")).expect("serialize");
        assert_eq!(remote["type"], "remote");
        assert_eq!(remote["connectionId"], "conn-a");
        assert_eq!(remote["path"], "/pub");
    }

    #[test]
    fn the_location_deserializes_from_the_frontend_shape() {
        let parsed: LocationRef =
            serde_json::from_value(serde_json::json!({"type": "remote", "connectionId": "conn-b", "path": "/x"}))
                .expect("deserialize");

        assert_eq!(parsed, LocationRef::remote("conn-b", "/x"));
    }
}
