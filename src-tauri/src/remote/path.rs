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

use crate::remote::error::RemoteError;

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

/// 规范化一个**远端**路径（不含连接 id）：折叠连续斜杠、剥离尾斜杠，
/// 根目录固定为 `"/"`。任一段是 `.` / `..` 则返回 `None`。
///
/// 阶段 2/5 的 FTP、SFTP 库交回来的路径要过这里才能和前端对齐。
pub fn normalize_remote_path(remote_path: &str) -> Option<String> {
    let segments = normalize_remote_segments(remote_path)?;

    if segments.is_empty() {
        return Some("/".to_string());
    }

    Some(format!("/{}", segments.join("/")))
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

    let remote_path = normalize_remote_path(tail)?;

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

    Some(format!(
        "{REMOTE_SCHEME}/{connection_id}/{}",
        segments.join("/")
    ))
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

/// 字符串里有没有控制字符。
///
/// FTP 的控制通道是行文本协议（一条命令以 `\r\n` 结束），所以一个含 `\r\n` 的
/// 路径不是「一条路径」而是「两条命令」——`normalize_remote_path` 只挡 `.` / `..`，
/// 不挡控制字符，而路径来自前端（用户在地址栏能敲出 `\r`）。
/// 这不是理论问题：它意味着用户可以让服务器去执行第二条命令。
pub fn contains_control_characters(value: &str) -> bool {
    value.chars().any(|character| character.is_control())
}

/// 远端路径含控制字符就拒绝。**在开连接之前**调。
/// FTP 侧原本只在自己的命令发送器里挡（`ftp_provider` 的 `command`），
/// SFTP 没有行文本协议因而一直没有这道闸。现在两侧共用这一个函数：
/// 挡住的理由不是协议，而是「前端的入参是用户手输的」，跟下游是什么协议无关。
pub fn reject_path_control_characters(path: &str) -> Result<(), RemoteError> {
    if contains_control_characters(path) {
        return Err(RemoteError::protocol(format!(
            "远端路径里出现了控制字符，已拒绝发送：{path:?}"
        )));
    }

    Ok(())
}

/// 校验一个**条目名**（不是完整路径）。
///
/// 阶段 3 的「远程重命名」与「远程新建目录」都要用到：两者最终都是把
/// **一个名字**交给服务器，而不是一条路径。这个函数是那道闸。
///
/// 逐条拒绝的理由：
///
/// - 空串：服务器多半会回「参数无效」，但那是个没法照着做的错误。
/// - 含 `/`：那就不是名字而是路径了。放进「改名」里会让一次改名变成
///   **跨目录移动**（后果比改名重得多），放进「新建目录」里会建到别处去。
/// - 含 `\`：Windows 上是分隔符。远端是 POSIX 语义，但前端与用户都跑在
///   Windows 上，让 `a\b` 原样过去只会在两端产生不同的解释。
/// - `.` / `..`：词法逃逸。`normalize_remote_path` 挡的是路径里的这两段，
///   这里挡的是**名字本身**就是这两段的情形。
/// - 控制字符：FTP 是行文本协议，一个含 `\r\n` 的名字会变成两条命令。
///
/// **在开连接之前**调 —— 名字不合法是本地判定，一秒都不该花在网络上。
pub fn validate_remote_entry_name(name: &str) -> Result<(), RemoteError> {
    if name.is_empty() {
        return Err(RemoteError::protocol("条目名不能为空"));
    }

    if name == "." || name == ".." {
        return Err(RemoteError::protocol(format!(
            "「{name}」不是一个可用的条目名"
        )));
    }

    if name.contains('/') || name.contains('\\') {
        return Err(RemoteError::protocol(format!(
            "条目名里不能包含路径分隔符：{name:?}"
        )));
    }

    if contains_control_characters(name) {
        return Err(RemoteError::protocol(format!(
            "条目名里出现了控制字符，已拒绝发送：{name:?}"
        )));
    }

    Ok(())
}

/// 规范化远端路径 → `(父目录, 条目名)`。
///
/// `/pub/a.txt` → `("/pub", "a.txt")`，`/a.txt` → `("/", "a.txt")`。
/// FTP 的 `RETR` / `STOR` / `MKD` 都只接受**名字**（先 `CWD` 到父目录），
/// 所以这几个动词必须先拆开。
///
/// 远端根没有条目名，返回 `Err`。
pub fn split_remote_parent_and_name(remote_path: &str) -> Result<(String, String), RemoteError> {
    let normalized = normalize_remote_path(remote_path)
        .ok_or_else(|| RemoteError::protocol(format!("远端路径不合法：{remote_path}")))?;

    let name = normalized
        .rsplit('/')
        .next()
        .filter(|segment| !segment.is_empty())
        .ok_or_else(|| RemoteError::protocol("远端空间根不是一个条目，没有可用的条目名"))?
        .to_string();

    // `rsplit_once` 在 `/pub/a.txt` 上切成 `("/pub", "a.txt")`，
    // 在 `/a.txt` 上切成 `("", "a.txt")` —— 后者要还原成 `"/"`。
    let parent = match normalized.rfind('/') {
        Some(0) | None => "/".to_string(),
        Some(index) => normalized[..index].to_string(),
    };

    Ok((parent, name))
}

/// `split_remote_parent_and_name` 的逆运算：把父目录与条目名拼回一条完整路径。
///
/// 根目录拼出来是 `/name`（不是 `//name`）。
///
/// 阶段 3 的「远程重命名」用它算目标路径：目标**必须在源目录内**，
/// 所以父目录取自源路径，而不是由调用方另传 —— 这样「改名」在协议层
/// 就不可能是「移动」。
pub fn join_remote_parent_and_name(parent: &str, name: &str) -> String {
    if parent == "/" {
        format!("/{name}")
    } else {
        format!("{parent}/{name}")
    }
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
    fn normalizes_remote_paths_without_a_connection_id() {
        assert_eq!(normalize_remote_path(""), Some("/".to_string()));
        assert_eq!(normalize_remote_path("/"), Some("/".to_string()));
        assert_eq!(normalize_remote_path("pub"), Some("/pub".to_string()));
        assert_eq!(normalize_remote_path("/pub/docs/"), Some("/pub/docs".to_string()));
        assert_eq!(normalize_remote_path("pub//docs"), Some("/pub/docs".to_string()));
        assert_eq!(normalize_remote_path("/中文目录/"), Some("/中文目录".to_string()));
        assert_eq!(normalize_remote_path("/pub/../etc"), None);
        assert_eq!(normalize_remote_path("./x"), None);
    }

    #[test]
    fn detects_connection_roots() {
        assert!(is_remote_connection_root_path("sfm://remote/conn-a"));
        assert!(is_remote_connection_root_path("sfm://remote/conn-a/"));
        assert!(!is_remote_connection_root_path("sfm://remote"));
        assert!(!is_remote_connection_root_path("sfm://remote/conn-a/pub"));
        assert!(!is_remote_connection_root_path("C:/Users"));
    }

    #[test]
    fn control_characters_are_rejected_before_they_reach_any_protocol() {
        assert!(contains_control_characters("/pub\r\nDELE /secret"));
        assert!(contains_control_characters("/pub\nQUIT"));
        assert!(contains_control_characters("/pub\0"));
        assert!(contains_control_characters("/pub\r"));

        // 正常路径不该被误伤。
        assert!(!contains_control_characters("/"));
        assert!(!contains_control_characters("/pub/文档 2024"));

        // SFTP 没有行文本协议，但**前端入参是用户手输的**这件事与协议无关，
        // 所以这道闸两侧共用。
        assert!(reject_path_control_characters("/pub\r\nQUIT").is_err());
        assert!(reject_path_control_characters("/pub/文档 2024").is_ok());
    }

    #[test]
    fn splits_a_remote_path_into_its_parent_and_its_name() {
        assert_eq!(
            split_remote_parent_and_name("/pub/a.txt").expect("valid"),
            ("/pub".to_string(), "a.txt".to_string())
        );
        // 顶层条目的父目录必须还原成 `/`，而不是空串 ——
        // `CWD ""` 会被大多数服务器直接拒掉。
        assert_eq!(
            split_remote_parent_and_name("/a.txt").expect("valid"),
            ("/".to_string(), "a.txt".to_string())
        );
        assert_eq!(
            split_remote_parent_and_name("/pub/文档 1.txt").expect("valid"),
            ("/pub".to_string(), "文档 1.txt".to_string())
        );
    }

    #[test]
    fn the_remote_root_has_no_name_to_split_off() {
        assert!(split_remote_parent_and_name("/").is_err());
        assert!(split_remote_parent_and_name("/pub/../etc").is_err());
    }

    #[test]
    fn joins_a_parent_and_a_name_back_into_a_path() {
        assert_eq!(join_remote_parent_and_name("/pub", "a.txt"), "/pub/a.txt");
        // 根目录拼出来是 `/name`，不是 `//name`。
        assert_eq!(join_remote_parent_and_name("/", "a.txt"), "/a.txt");
        assert_eq!(
            join_remote_parent_and_name("/pub/docs", "中文 1.txt"),
            "/pub/docs/中文 1.txt"
        );
    }

    #[test]
    fn joins_and_splits_are_inverses() {
        for (parent, name) in [
            ("/pub", "a.txt"),
            ("/", "a.txt"),
            ("/pub/docs", "中文 1.txt"),
        ] {
            let joined = join_remote_parent_and_name(parent, name);
            assert_eq!(
                split_remote_parent_and_name(&joined).expect("valid"),
                (parent.to_string(), name.to_string())
            );
        }
    }

    #[test]
    fn accepts_ordinary_entry_names() {
        // 阳性对照：正常的名字不能被误伤 ——
        // 中文、空格、点开头的文件（`.gitignore`）都是合法的远端条目名。
        for name in ["a.txt", "中文目录", "文档 1.txt", ".gitignore", "..hidden"] {
            assert!(
                validate_remote_entry_name(name).is_ok(),
                "{name:?} 是一个合法的条目名"
            );
        }
    }

    #[test]
    fn rejects_entry_names_that_are_not_a_single_segment() {
        // 空名：服务器多半回「参数无效」，那是个没法照着做的错误。
        assert!(validate_remote_entry_name("").is_err());

        // 含斜杠：那就不是名字而是路径了 ——
        // 放进「改名」里会让一次改名变成跨目录移动。
        assert!(validate_remote_entry_name("a/b").is_err());
        assert!(validate_remote_entry_name("/a").is_err());

        // 反斜杠：Windows 上是分隔符。
        assert!(validate_remote_entry_name("a\\b").is_err());

        // `.` 与 `..`：词法逃逸。
        assert!(validate_remote_entry_name(".").is_err());
        assert!(validate_remote_entry_name("..").is_err());

        // 控制字符：FTP 是行文本协议，含 `\r\n` 的名字会变成两条命令。
        assert!(validate_remote_entry_name("a\r\nRNTO /secret").is_err());
        assert!(validate_remote_entry_name("a\0").is_err());
    }
}
