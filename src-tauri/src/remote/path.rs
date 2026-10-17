// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//! 远程空间的路径族：`sfm://remote/<连接id>/<远端路径>`。
//!
//! 这是整个功能**唯一的跨语言共享契约**，前端 `src/utils/remote-paths.ts`
//! 是本文件的逐条镜像。两边必须通过同一组断言，任何一侧改动都要同步另一侧。
//!
//! 规范化规则（两端一致）：
//! - 尾斜杠一律剥离，远端根固定为 `"/"`
//! - 连续斜杠折叠（用户会手输，要宽容）
//! - `.` 与 `..` 段**拒绝**，不做词法解析，防 VFS 命名空间逃逸
//! - 空连接 id 拒绝
//! - **不做百分号编码**，空格与 Unicode 原样存放 —— 与本项目已有的本地路径
//!   （`C:/My Documents/`）处理一致，也避免编码/解码不对称。

/// 远程空间根路径，等于前端 `REMOTE_SCHEME`。
pub const REMOTE_SCHEME: &str = "sfm://remote";

/// 一条解析后的远程路径。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemotePath {
    pub connection_id: String,
    /// 恒以 `/` 开头；根目录为 `"/"`；不含尾斜杠（根目录除外）。
    pub remote_path: String,
}

/// 连接 id 是否可用：非空，且不含正反斜杠。
///
/// 正斜杠由「按首个斜杠切分」天然排除，这里显式再挡一次是为了让规则自洽可读；
/// 反斜杠是真需要挡的 —— Windows 上误传一个 `a\b` 会让两端解析出不同结果。
fn is_valid_connection_id(connection_id: &str) -> bool {
    !connection_id.is_empty() && !connection_id.contains('/') && !connection_id.contains('\\')
}

/// 把远端路径切成规范化段序列。任一段是 `.` / `..` 则返回 `None`。
fn normalize_remote_segments(remote_path: &str) -> Option<Vec<&str>> {
    let segments: Vec<&str> = remote_path
        .split('/')
        .filter(|segment| !segment.is_empty())
        .collect();

    if segments
        .iter()
        .any(|segment| *segment == "." || *segment == "..")
    {
        return None;
    }

    Some(segments)
}

/// 是否落在 `sfm://remote` 前缀下。
///
/// 注意：这**不**保证路径合法 —— `sfm://remote/c/../x` 前缀成立，
/// 但 `parse_remote_path` 对它返回 `None`。两者分工不同，不要混用。
pub fn is_remote_path(path: &str) -> bool {
    path == REMOTE_SCHEME || path.starts_with(&format!("{REMOTE_SCHEME}/"))
}

/// 解析并规范化。任一段是 `.` / `..`，或连接 id 为空，返回 `None`。
pub fn parse_remote_path(path: &str) -> Option<RemotePath> {
    let remainder = path.strip_prefix(&format!("{REMOTE_SCHEME}/"))?;

    // 连接 id 取「首个斜杠之前」的那一段，不折叠空段 ——
    // 否则 `sfm://remote//pub` 会被折叠成合法的 `pub` 连接。
    let (connection_id, tail) = match remainder.split_once('/') {
        Some((head, tail)) => (head, tail),
        None => (remainder, ""),
    };

    if !is_valid_connection_id(connection_id) {
        return None;
    }

    let segments = normalize_remote_segments(tail)?;
    let remote_path = if segments.is_empty() {
        "/".to_string()
    } else {
        format!("/{}", segments.join("/"))
    };

    Some(RemotePath {
        connection_id: connection_id.to_string(),
        remote_path,
    })
}

/// 反向构造。`remote_path` 为 `""` 或 `"/"` 时产出连接根。
/// 连接 id 为空或含正反斜杠时返回 `None`。
pub fn build_remote_path(connection_id: &str, remote_path: &str) -> Option<String> {
    if !is_valid_connection_id(connection_id) {
        return None;
    }

    let segments = normalize_remote_segments(remote_path)?;

    if segments.is_empty() {
        return Some(format!("{REMOTE_SCHEME}/{connection_id}"));
    }

    Some(format!("{REMOTE_SCHEME}/{connection_id}/{}", segments.join("/")))
}

/// `sfm://remote/<连接id>`。连接 id 非法时返回 `None`。
pub fn build_remote_connection_path(connection_id: &str) -> Option<String> {
    if !is_valid_connection_id(connection_id) {
        return None;
    }

    Some(format!("{REMOTE_SCHEME}/{connection_id}"))
}

/// 词法父级。已在连接根时返回 `Some("sfm://remote")`；已在根或路径非法时返回 `None`。
pub fn get_remote_parent_path(path: &str) -> Option<String> {
    let parsed = parse_remote_path(path)?;

    if parsed.remote_path == "/" {
        return if is_remote_path(path) {
            Some(REMOTE_SCHEME.to_string())
        } else {
            None
        };
    }

    // 必须在**最后一个**斜杠处切，不能用 `split_once`：`/pub/docs` 用 `split_once`
    // 会切成 `("", "pub/docs")`，父级变成空串、直接退回连接根。
    // 此分支下 `remote_path` 恒以 `/` 开头且长度 > 1，故左半段必然非空。
    let (parent, _leaf) = parsed.remote_path.rsplit_once('/')?;

    build_remote_path(&parsed.connection_id, parent)
}

/// 是否恰好是某个连接的根（`sfm://remote/<连接id>`，可带尾斜杠）。
pub fn is_remote_connection_root_path(path: &str) -> bool {
    parse_remote_path(path).is_some_and(|parsed| parsed.remote_path == "/")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_connection_root_and_nested_paths() {
        assert_eq!(
            parse_remote_path("sfm://remote/conn-a"),
            Some(RemotePath {
                connection_id: "conn-a".to_string(),
                remote_path: "/".to_string()
            })
        );
        assert_eq!(
            parse_remote_path("sfm://remote/conn-a/"),
            Some(RemotePath {
                connection_id: "conn-a".to_string(),
                remote_path: "/".to_string()
            })
        );
        assert_eq!(
            parse_remote_path("sfm://remote/conn-a/pub"),
            Some(RemotePath {
                connection_id: "conn-a".to_string(),
                remote_path: "/pub".to_string()
            })
        );
        assert_eq!(
            parse_remote_path("sfm://remote/conn-a/pub/docs/"),
            Some(RemotePath {
                connection_id: "conn-a".to_string(),
                remote_path: "/pub/docs".to_string()
            })
        );
    }

    #[test]
    fn collapses_repeated_slashes() {
        assert_eq!(
            parse_remote_path("sfm://remote/conn-a/pub//docs"),
            Some(RemotePath {
                connection_id: "conn-a".to_string(),
                remote_path: "/pub/docs".to_string()
            })
        );
    }

    #[test]
    fn rejects_dot_and_dot_dot_segments() {
        assert_eq!(parse_remote_path("sfm://remote/conn-a/pub/./docs"), None);
        assert_eq!(parse_remote_path("sfm://remote/conn-a/pub/../etc"), None);
    }

    #[test]
    fn rejects_scheme_root_and_empty_connection_id() {
        assert_eq!(parse_remote_path("sfm://remote"), None);
        assert_eq!(parse_remote_path("sfm://remote/"), None);
        assert_eq!(parse_remote_path("sfm://remote//pub"), None);
        assert_eq!(parse_remote_path("sfm://remotex/conn-a"), None);
        assert_eq!(parse_remote_path("C:/Users"), None);
    }

    #[test]
    fn detects_the_scheme_prefix_independently_of_validity() {
        assert!(is_remote_path("sfm://remote"));
        assert!(is_remote_path("sfm://remote/conn-a/pub/../x"));
        assert!(!is_remote_path("sfm://locations"));
        assert!(!is_remote_path("C:/Users"));
    }

    #[test]
    fn builds_canonical_paths() {
        assert_eq!(
            build_remote_path("conn-a", "").as_deref(),
            Some("sfm://remote/conn-a")
        );
        assert_eq!(
            build_remote_path("conn-a", "/").as_deref(),
            Some("sfm://remote/conn-a")
        );
        assert_eq!(
            build_remote_path("conn-a", "/pub/docs/").as_deref(),
            Some("sfm://remote/conn-a/pub/docs")
        );
        assert_eq!(build_remote_path("", "/pub"), None);
        assert_eq!(build_remote_path("a/b", "/pub"), None);
        assert_eq!(
            build_remote_connection_path("conn-a").as_deref(),
            Some("sfm://remote/conn-a")
        );
        assert_eq!(build_remote_connection_path(""), None);
    }

    #[test]
    fn round_trips_build_and_parse() {
        for remote in ["/", "/pub", "/pub/docs", "/中文目录/文件 1.txt"] {
            let built = build_remote_path("conn-a", remote).expect("valid connection id");
            let parsed = parse_remote_path(&built).expect("built path must parse");

            assert_eq!(parsed.connection_id, "conn-a");
            assert_eq!(parsed.remote_path, remote);
        }
    }

    #[test]
    fn walks_up_to_the_scheme_root() {
        assert_eq!(
            get_remote_parent_path("sfm://remote/conn-a/pub/docs").as_deref(),
            Some("sfm://remote/conn-a/pub")
        );
        assert_eq!(
            get_remote_parent_path("sfm://remote/conn-a/pub").as_deref(),
            Some("sfm://remote/conn-a")
        );
        assert_eq!(
            get_remote_parent_path("sfm://remote/conn-a").as_deref(),
            Some("sfm://remote")
        );
        assert_eq!(get_remote_parent_path("sfm://remote"), None);
        assert_eq!(get_remote_parent_path("C:/Users"), None);
    }

    #[test]
    fn detects_connection_roots() {
        assert!(is_remote_connection_root_path("sfm://remote/conn-a"));
        assert!(is_remote_connection_root_path("sfm://remote/conn-a/"));
        assert!(!is_remote_connection_root_path("sfm://remote"));
        assert!(!is_remote_connection_root_path("sfm://remote/conn-a/pub"));
        assert!(!is_remote_connection_root_path("C:/Users"));
    }
}
