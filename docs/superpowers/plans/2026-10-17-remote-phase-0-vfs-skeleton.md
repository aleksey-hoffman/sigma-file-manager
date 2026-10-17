<!--
  阶段 0 执行计划 —— 由 superpowers:writing-plans 生成。
  规格来源：docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md §8 阶段表
-->

# 阶段 0：远程空间 VFS 骨架

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans

**Goal:** 铺出 FTP/SFTP 后续六个阶段都依赖的地基 —— `sfm://remote/<连接id>/<远端路径>` 路径族（Rust 与 TypeScript 双份、语义逐条对齐）、后端 provider trait 与错误分类、前端 `remote` 动作门禁、远程路径的父级导航。**本阶段不含任何 FTP / SFTP 代码，不注册任何 Tauri command，不产生任何用户可见功能。**

**Architecture:** 两侧各持一份路径族纯函数（Rust `src-tauri/src/remote/path.rs`、TS `src/utils/remote-paths.ts`），语义必须逐条一致 —— 这是整个功能唯一的跨语言共享契约，写错会被后面六个阶段全部继承。Rust 侧定义 `RemoteProvider` 异步 trait 与 `RemoteError` 七分类，`FakeRemoteProvider` 是它唯一的实现。前端在 `entry-action-policy.ts` 增加第四种策略 `remote`，并在 `getNavigableParentPath` 里加远程分支。两端全部是纯函数，因此可以用单元测试完整覆盖，不需要真机、不需要网络、不需要打包产物。

**Tech Stack:** Rust 1.90（edition 2021，`async-trait` 0.1）、TypeScript 5.x、Vue 3、Vitest、naive-ui 无关。

## Global Constraints

这几条是**硬约束**，每个 Task 都受它们约束。违反其中任何一条都会导致后面无法收口。

1. **`cargo test --lib` 红线**：本阶段新增的 `remote` 模块被测试二进制链接，因此
   **不得出现 `tauri::AppHandle`、`tauri::async_runtime::*`、`tauri::` 的任何路径**。
   一旦碰到，Tauri 全局运行时的默认类型参数 `Wry` 被单态化，把 tao 整条窗口链
   （含 `comctl32!TaskDialogIndirect`）拖进测试二进制，进程在**加载阶段**以
   `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉 —— 一个测试都跑不了，且报错与本模块毫无关系。
   本阶段**不注册任何 Tauri command**，正是为了从根上避开这条线。
   （参照 `src-tauri/src/dir_reader.rs:24-38` 的注释；本阶段不需要 `*_blocking` 入口，
   因为阶段 1 接 command 时才需要。）

2. **Rust 编译环境**：`cargo` 不在 PATH。每个 bash 调用都要重新注入：
   ```cmd
   call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cargo test --lib remote::
   ```

3. **门禁基线（HEAD=`b87665ea`，本分支起点）** —— 必须逐字对照，混口径会误判成回归：

   | 命令 | 基线 |
   |---|---|
   | `cargo test --lib` | 386 passed |
   | `npx vue-tsc --build` | 0 error |
   | `npx eslint src` | **179 errors** |
   | `npx vitest run` | 186 文件 / 1465 用例 |
   | `node scripts/verify-changelog.mjs` | 退出码 0 |

   - `npx eslint .`（整仓）基线是 **186 errors / 121 warnings**，与 `eslint src` 口径不同。
     本阶段**只用 `npx eslint src`**，因为基线数字是这个口径。
   - 本阶段预期 `eslint src` 仍是 **179**（净增 0），新增文件必须零违规。
     若增加，说明新代码引入了基线之外的违规，必须修到 179 再提交。

4. **PowerShell 陷阱**：
   - 调 `npm` / `npx` 前后显式 `$ErrorActionPreference = 'Continue'`，否则原生命令的 stderr
     会变成终止错误，门禁脚本带 exit 1 退出，看起来像门禁挂了。
   - `vitest --reporter=basic` 在本仓库这版**不存在**，会 `Failed to load custom Reporter`
     直接中止。用默认 reporter。
   - 绝不用 `Get-Content -Raw` / `Set-Content` 改含中文的源文件（PS 5.1 按 ANSI 读无 BOM 的
     UTF-8，中文注释读进来就是乱码）。改 `.rs` / `.ts` 一律用编辑工具；
     批量改用 node `fs.readFileSync/writeFileSync(..., 'utf8')`。
   - 提交信息文件一律用 node `fs.writeFileSync(..., 'utf8')` 写到 `.git/afm-commit-msg.txt`
     再 `git commit -F`（`Out-File -Encoding utf8` 会加 BOM）。用完不删，写进 `.git/` 不进版本库。

5. **仓库文件头**：所有新增 `.rs` / `.ts` 文件顶部保留与邻居一致的三行 SPDX 头：
   ```rust
   // SPDX-License-Identifier: GPL-3.0-or-later
   // License: GNU GPLv3 or later. See the license file in the project root for more information.
   // Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
   ```

6. **不改动受保护常量**：mDNS 服务名、legacy 数据目录名、Tauri `identifier`。本阶段不碰它们。

---

## 路径族规范（Rust 与 TypeScript 必须逐条一致）

这是**整个功能唯一的跨语言共享契约**。两侧实现必须通过同一组断言。

| 输入 | `parse` 结果 | 规范化规则 |
|---|---|---|
| `sfm://remote` | `None`（这是根，不是某连接的路径） | 根路径不带连接 id |
| `sfm://remote/` | `None` | 同上，尾斜杠不改变性质 |
| `sfm://remote/<connId>` | `{ connId, remotePath: "/" }` | 连接根 = 远端根目录 |
| `sfm://remote/<connId>/` | `{ connId, remotePath: "/" }` | 尾斜杠剥离 |
| `sfm://remote/<connId>/pub` | `{ connId, remotePath: "/pub" }` | |
| `sfm://remote/<connId>/pub/docs/` | `{ connId, remotePath: "/pub/docs" }` | 尾斜杠剥离 |
| `sfm://remote/<connId>/pub//docs` | `{ connId, remotePath: "/pub/docs" }` | **连续斜杠折叠**（用户会手输，要宽容） |
| `sfm://remote/<connId>/pub/./docs` | `None` | `.` 段**拒绝** |
| `sfm://remote/<connId>/pub/../etc` | `None` | `..` 段**拒绝**（不做词法解析，防 VFS 命名空间逃逸） |
| `sfm://remote//pub` | `None` | 空连接 id **拒绝** |
| `sfm://remotex/<connId>` | `None` | 前缀必须精确匹配 |
| `C:/Users` | `None` | 本地路径不是远程路径 |

**`build` 规则**：`build(connId, "")` 与 `build(connId, "/")` 都产出 `sfm://remote/<connId>`；
`build(connId, "/pub/docs/")` 产出 `sfm://remote/<connId>/pub/docs`。
连接 id 为空或含 `/` 时返回 `None`。

**`parent` 规则**：`.../<connId>/pub/docs` → `.../<connId>/pub`；`.../<connId>/pub` → `.../<connId>`；
`.../<connId>` → `sfm://remote`；`sfm://remote` → `None`。

**不做百分号编码**。远端路径里的空格与 Unicode 原样存放，与本项目已有的本地路径
（`C:/My Documents/`）处理一致，也避免编码/解码不对称。

---

## Task 1：Rust 远程路径族

**Files:**
- Create: `src-tauri/src/remote/mod.rs`
- Create: `src-tauri/src/remote/path.rs`
- Modify: `src-tauri/src/lib.rs`（加一行 `pub mod remote;`）

**Interfaces:**
```rust
// src-tauri/src/remote/path.rs

/// 远程空间根路径，等于前端 `REMOTE_SCHEME`。
pub const REMOTE_SCHEME: &str = "sfm://remote";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RemotePath {
    pub connection_id: String,
    /// 恒以 `/` 开头；根目录为 `"/"`；不含尾斜杠（根目录除外）。
    pub remote_path: String,
}

/// 是否落在 `sfm://remote` 前缀下。注意：这**不**保证路径合法 ——
/// `sfm://remote/c/../x` 前缀成立但 `parse_remote_path` 返回 `None`。
pub fn is_remote_path(path: &str) -> bool;

/// 解析并规范化。任一段是 `.` / `..`，或连接 id 为空，返回 `None`。
pub fn parse_remote_path(path: &str) -> Option<RemotePath>;

/// 反向构造。`remote_path` 为 `""` 或 `"/"` 时产出连接根。
/// 连接 id 为空或含 `/` 时返回 `None`。
pub fn build_remote_path(connection_id: &str, remote_path: &str) -> Option<String>;

/// `sfm://remote/<connId>`。连接 id 非法时返回 `None`。
pub fn build_remote_connection_path(connection_id: &str) -> Option<String>;

/// 词法父级。已在连接根时返回 `Some("sfm://remote")`；已在根时返回 `None`。
/// 路径非法时返回 `None`。
pub fn get_remote_parent_path(path: &str) -> Option<String>;

/// 是否恰好是某个连接的根（`sfm://remote/<connId>`，可带尾斜杠）。
pub fn is_remote_connection_root_path(path: &str) -> bool;
```

**Steps:**

- [ ] **Step 1.1** 建模块根 `src-tauri/src/remote/mod.rs`：
  ```rust
  // SPDX-License-Identifier: GPL-3.0-or-later
  // License: GNU GPLv3 or later. See the license file in the project root for more information.
  // Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

  mod path;

  pub use path::{
      build_remote_connection_path, build_remote_path, get_remote_parent_path,
      is_remote_connection_root_path, is_remote_path, parse_remote_path, RemotePath, REMOTE_SCHEME,
  };
  ```
  再在 `src-tauri/src/lib.rs` 的 `mod open_with;` 之后（字母序）插入 `pub mod remote;`。
  用 `pub mod` 而不是 `mod`，是因为 crate-type 含 `rlib`，`pub` 项属于公开 API，不会触发 dead_code 警告。
  （先例：`pub mod mcp;`、`pub mod utils;`。）

- [ ] **Step 1.2** 写**失败的**测试。在 `src-tauri/src/remote/path.rs` 末尾追加：
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn parses_connection_root_and_nested_paths() {
          assert_eq!(
              parse_remote_path("sfm://remote/conn-a"),
              Some(RemotePath { connection_id: "conn-a".to_string(), remote_path: "/".to_string() })
          );
          assert_eq!(
              parse_remote_path("sfm://remote/conn-a/"),
              Some(RemotePath { connection_id: "conn-a".to_string(), remote_path: "/".to_string() })
          );
          assert_eq!(
              parse_remote_path("sfm://remote/conn-a/pub"),
              Some(RemotePath { connection_id: "conn-a".to_string(), remote_path: "/pub".to_string() })
          );
          assert_eq!(
              parse_remote_path("sfm://remote/conn-a/pub/docs/"),
              Some(RemotePath { connection_id: "conn-a".to_string(), remote_path: "/pub/docs".to_string() })
          );
      }

      #[test]
      fn collapses_repeated_slashes() {
          assert_eq!(
              parse_remote_path("sfm://remote/conn-a/pub//docs"),
              Some(RemotePath { connection_id: "conn-a".to_string(), remote_path: "/pub/docs".to_string() })
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
          assert_eq!(build_remote_path("conn-a", "").as_deref(), Some("sfm://remote/conn-a"));
          assert_eq!(build_remote_path("conn-a", "/").as_deref(), Some("sfm://remote/conn-a"));
          assert_eq!(
              build_remote_path("conn-a", "/pub/docs/").as_deref(),
              Some("sfm://remote/conn-a/pub/docs")
          );
          assert_eq!(build_remote_path("", "/pub"), None);
          assert_eq!(build_remote_path("a/b", "/pub"), None);
          assert_eq!(build_remote_connection_path("conn-a").as_deref(), Some("sfm://remote/conn-a"));
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
          assert_eq!(get_remote_parent_path("sfm://remote/conn-a/pub/docs").as_deref(), Some("sfm://remote/conn-a/pub"));
          assert_eq!(get_remote_parent_path("sfm://remote/conn-a/pub").as_deref(), Some("sfm://remote/conn-a"));
          assert_eq!(get_remote_parent_path("sfm://remote/conn-a").as_deref(), Some("sfm://remote"));
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
  ```
  此刻 `parse_remote_path` 等函数还没写完，编译必然失败 —— 这正是要的。

- [ ] **Step 1.3** 跑测试确认失败：
  ```cmd
  call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cargo test --lib remote::path
  ```
  预期：`error[E0425]: cannot find function ... in this scope`。
  **把这段错误读一遍**确认是「函数不存在」而不是别的（比如 `mod remote` 没接上）。

- [ ] **Step 1.4** 实现 `src-tauri/src/remote/path.rs` 的非测试部分。核心逻辑：
  ```rust
  pub fn is_remote_path(path: &str) -> bool {
      path == REMOTE_SCHEME || path.starts_with(&format!("{REMOTE_SCHEME}/"))
  }
  ```
  `parse_remote_path` 的实现顺序（每一步都可能返回 `None`）：
  1. 剥掉 `sfm://remote` 前缀；剥不掉返回 `None`。
  2. 剩下的按 `/` 切分，用 `filter(|s| !s.is_empty())` **折叠连续斜杠**。
  3. 切分结果为空 → `None`（这就是 `sfm://remote` 与 `sfm://remote/`）。
  4. 第 0 段作 `connection_id`；为空则整体已被 filter 掉，实际到不了，但**显式再判一次**并返回 `None`。
  5. 剩余段里任一段等于 `.` 或 `..` → `None`。
  6. `remote_path` = `"/"` + 剩余段用 `/` 连接；剩余段为空时为 `"/"`。
  `get_remote_parent_path`：先 `parse_remote_path`；解析失败返回 `None`；
  `remote_path == "/"` 时若 `is_remote_path(path)` 为真返回 `Some(REMOTE_SCHEME.to_string())`，否则 `None`；
  否则对 `remote_path` 做 `rsplit_once('/')`，前缀为空（不可能，因为恒以 `/` 开头）时兜底 `/`，
  再 `build_remote_path(connection_id, 前缀)`。
  `is_remote_connection_root_path`：`parse_remote_path(p)` 得到 `Some` 且 `remote_path == "/"`。

- [ ] **Step 1.5** 跑测试确认通过：
  ```cmd
  call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cargo test --lib remote::path
  ```
  预期 9 passed。

- [ ] **Step 1.6** 跑**全量** `cargo test --lib`，确认 386 + 9 = 395 passed。
  若总数不是 395，说明有别的测试受影响 —— 停下来查，不要继续。

- [ ] **Step 1.7** 提交：
  ```
  feat(remote): 阶段 0 Task 1 —— Rust 远程路径族
  ```

---

## Task 2：Rust 错误分类

**Files:**
- Create: `src-tauri/src/remote/error.rs`
- Modify: `src-tauri/src/remote/mod.rs`（加 `mod error;` + `pub use`）

**Interfaces:**
```rust
// src-tauri/src/remote/error.rs

/// 错误分类。序列化用 snake_case，与 `dir_reader::types::DirEntryLinkType` 保持一致。
/// 七类都不可再合并 —— 规格 §6 要求「不能只报『连接失败』」。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RemoteErrorKind {
    /// 凭据错误：认证失败、账号锁定。
    Auth,
    /// 网络不可达：DNS 失败、连接被拒、超时。
    Unreachable,
    /// 已连上但没权限：远端拒绝该操作。
    Permission,
    /// 路径或条目不存在。
    NotFound,
    /// 协议层错误：命令语法不被接受、响应无法解析。
    Protocol,
    /// 文件名编码无法按当前配置解码。
    Encoding,
    /// 连接已建立但中途断开。
    Disconnected,
    /// 兜底。**只在确实归不进上面七类时用**，不是「懒得分类」。
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct RemoteError {
    pub kind: RemoteErrorKind,
    pub message: String,
}

impl RemoteError {
    pub fn new(kind: RemoteErrorKind, message: impl Into<String>) -> Self;
    pub fn auth(message: impl Into<String>) -> Self;
    pub fn unreachable(message: impl Into<String>) -> Self;
    pub fn permission(message: impl Into<String>) -> Self;
    pub fn not_found(message: impl Into<String>) -> Self;
    pub fn protocol(message: impl Into<String>) -> Self;
    pub fn encoding(message: impl Into<String>) -> Self;
    pub fn disconnected(message: impl Into<String>) -> Self;
    pub fn unknown(message: impl Into<String>) -> Self;
}

impl std::fmt::Display for RemoteError;   // 输出 `"{kind}: {message}"`
impl std::error::Error for RemoteError;
```

序列化契约：这套类型就是阶段 1 Tauri command 的 `Err` 载荷，前端收到
`{ "kind": "auth", "message": "..." }`。**本阶段就要把这个形状测死**，
否则阶段 1 改字段名要回头改前端。

**Steps:**

- [ ] **Step 2.1** 在 `src-tauri/src/remote/error.rs` 写**失败的**测试：
  ```rust
  #[cfg(test)]
  mod tests {
      use super::*;

      #[test]
      fn serializes_kind_as_snake_case() {
          let json = serde_json::to_string(&RemoteError::auth("密码错误")).expect("serialize");
          assert_eq!(json, r#"{"kind":"auth","message":"密码错误"}"#);
      }

      #[test]
      fn covers_every_documented_kind() {
          let kinds = [
              RemoteErrorKind::Auth,
              RemoteErrorKind::Unreachable,
              RemoteErrorKind::Permission,
              RemoteErrorKind::NotFound,
              RemoteErrorKind::Protocol,
              RemoteErrorKind::Encoding,
              RemoteErrorKind::Disconnected,
              RemoteErrorKind::Unknown,
          ];
          let expected = [
              "auth", "unreachable", "permission", "not_found",
              "protocol", "encoding", "disconnected", "unknown",
          ];
          for (kind, name) in kinds.iter().zip(expected) {
              assert_eq!(serde_json::to_string(kind).expect("serialize"), format!("\"{name}\""));
          }
      }

      #[test]
      fn constructors_set_the_matching_kind() {
          assert_eq!(RemoteError::auth("m").kind, RemoteErrorKind::Auth);
          assert_eq!(RemoteError::unreachable("m").kind, RemoteErrorKind::Unreachable);
          assert_eq!(RemoteError::permission("m").kind, RemoteErrorKind::Permission);
          assert_eq!(RemoteError::not_found("m").kind, RemoteErrorKind::NotFound);
          assert_eq!(RemoteError::protocol("m").kind, RemoteErrorKind::Protocol);
          assert_eq!(RemoteError::encoding("m").kind, RemoteErrorKind::Encoding);
          assert_eq!(RemoteError::disconnected("m").kind, RemoteErrorKind::Disconnected);
          assert_eq!(RemoteError::unknown("m").kind, RemoteErrorKind::Unknown);
          assert_eq!(RemoteError::new(RemoteErrorKind::Protocol, "m").kind, RemoteErrorKind::Protocol);
      }

      #[test]
      fn displays_kind_and_message() {
          assert_eq!(RemoteError::not_found("没有那个目录").to_string(), "not_found: 没有那个目录");
      }

      #[test]
      fn round_trips_through_json() {
          let original = RemoteError::disconnected("连接被远端关闭");
          let text = serde_json::to_string(&original).expect("serialize");
          let parsed: RemoteError = serde_json::from_str(&text).expect("deserialize");
          assert_eq!(parsed, original);
      }
  }
  ```

- [ ] **Step 2.2** 跑 `cargo test --lib remote::error`，确认因类型缺失而失败。

- [ ] **Step 2.3** 实现 `error.rs`。枚举 + 结构体 + 八个构造函数 + `Display` + `Error`。
  `Display` 用 `write!(f, "{:?}: {}", self.kind, self.message)` 之外**不能**引入额外格式 ——
  `kind` 的 `Debug` 输出是变体名（`Auth` / `NotFound`），而测试期望的是 snake_case（`auth` / `not_found`）。
  所以正确写法是从 `kind` 反序列化或手写一个 `kind.as_str()`：
  ```rust
  impl RemoteErrorKind {
      pub fn as_str(self) -> &'static str {
          match self {
              Self::Auth => "auth",
              Self::Unreachable => "unreachable",
              Self::Permission => "permission",
              Self::NotFound => "not_found",
              Self::Protocol => "protocol",
              Self::Encoding => "encoding",
              Self::Disconnected => "disconnected",
              Self::Unknown => "unknown",
          }
      }
  }
  ```
  `Display` 用 `write!(f, "{}: {}", self.kind.as_str(), self.message)`。
  （这是刻意的：`as_str()` 让前端不必反序列化就能拿到分类字符串，阶段 1 的文案映射直接用它。）

- [ ] **Step 2.4** 跑 `cargo test --lib remote::error`，预期 6 passed。
- [ ] **Step 2.5** 跑全量 `cargo test --lib`，预期 401 passed。
- [ ] **Step 2.6** 提交：
  ```
  feat(remote): 阶段 0 Task 2 —— RemoteError 七分类与序列化契约
  ```

---

## Task 3：Provider trait 与假 provider

**Files:**
- Create: `src-tauri/src/remote/provider.rs`
- Create: `src-tauri/src/remote/fake.rs`
- Modify: `src-tauri/src/remote/mod.rs`
- Modify: `src-tauri/Cargo.toml`（新增 `async-trait = "0.1"`）

**Interfaces:**
```rust
// src-tauri/src/remote/provider.rs

/// 远程目录条目。时间单位与 `dir_reader::types::DirEntry.modified_time` 一致：
/// **Unix 纪元毫秒**（后端 `metadata_times_unix_ms`）。
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
/// 刻意是 **async**：FTP 与 SFTP 库（`suppaftp` / `russh-sftp`）都是异步的，
/// 现在写成同步的，阶段 2 就要把这个 trait 连同所有调用点一起推翻。
///
/// 刻意用 `#[async_trait]` 而非原生 AFIT：阶段 1 的连接注册表要存
/// `HashMap<String, Box<dyn RemoteProvider>>`，原生 AFIT 不是 dyn 兼容的。
#[async_trait]
pub trait RemoteProvider: Send + Sync {
    /// 列出 `remote_path` 下的直接子项。`remote_path` 恒以 `/` 开头。
    /// 返回的每个 `RemoteEntry.path` 必须是完整 `sfm://remote/...` 路径。
    async fn read_dir(
        &self,
        connection_id: &str,
        remote_path: &str,
    ) -> Result<Vec<RemoteEntry>, RemoteError>;
}
```

```rust
// src-tauri/src/remote/fake.rs

/// 阶段 0 的唯一 provider 实现：读内存里的固定目录树，不碰网络。
/// 阶段 1 会用真实注册表取代它；本类型保留下来做回归夹具。
pub struct FakeRemoteProvider {
    /// 连接 id → `(远端路径 → 子项)`。
    tree: HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>,
}

impl FakeRemoteProvider {
    pub fn new(tree: HashMap<String, BTreeMap<String, Vec<RemoteEntry>>>) -> Self;
    /// 构造一棵固定示例树：连接 `conn-a`，根下 `pub/`（含 `readme.txt`）
    /// 与 `empty/`（空目录）。返回 `FakeRemoteProvider`。
    pub fn sample() -> Self;
}

#[async_trait]
impl RemoteProvider for FakeRemoteProvider { /* 见 Step 3.3 */ }
```

**关于 `async-trait` 的依赖决策**：这是本阶段唯一新增的第三方 crate。选它而不是手写
`Pin<Box<dyn Future>>` 的理由：MIT OR Apache-2.0（符合 GPL-3.0-or-later 的链接要求）、
MSRV 远低于本项目的 1.90、且是 dyn 兼容 trait 的社区标准写法。
**不要用 `async-trait` 去碰 Tauri 运行时** —— 它只做类型转换，不涉及执行器。

**Steps:**

- [ ] **Step 3.1** 在 `src-tauri/Cargo.toml` 的 `[dependencies]` 里，
  紧跟 `tokio-util = { ... }` 之后加一行，并加中文注释说明为什么是它：
  ```toml
  # 远程 provider trait 的异步方法包装。MIT OR Apache-2.0，MSRV 远低于本项目的 1.90。
  # 选它而不是原生 AFIT：阶段 1 的连接注册表要存 Box<dyn RemoteProvider>，AFIT 不是 dyn 兼容的。
  async-trait = "0.1"
  ```

- [ ] **Step 3.2** 在 `src-tauri/src/remote/provider.rs` 写**失败的**测试：
  ```rust
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
          assert!(entries.iter().all(|entry| entry.path.starts_with("sfm://remote/conn-a/")));
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
      async fn providers_are_usable_through_a_trait_object() {
          // 这一条锁住「dyn 兼容」这个决策：如果哪天有人把 #[async_trait] 换成原生 AFIT，
          // 这条测试会编译失败，从而在阶段 1 之前就把问题暴露出来。
          let provider: Box<dyn RemoteProvider> = Box::new(FakeRemoteProvider::sample());
          assert_eq!(provider.read_dir("conn-a", "/").await.expect("read").len(), 2);
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
          assert_eq!(json["modified_time"], 1_700_000_000_000_u64);
      }
  }
  ```

- [ ] **Step 3.3** 在 `src-tauri/src/remote/fake.rs` 写 `FakeRemoteProvider`：
  - `sample()` 构造：
    - 连接 `conn-a`，远端 `/` → `pub/`（目录）、`empty/`（目录）
    - 连接 `conn-a`，远端 `/pub` → `readme.txt`（文件，`size: 12`，
      `modified_time: 1_700_000_000_000`）
    - 连接 `conn-a`，远端 `/empty` → `Vec::new()`
  - 每个 `RemoteEntry.path` 用 `build_remote_path(conn_id, &format!("{parent}/{name}"))` 生成，
    **不要手写字符串** —— 这样路径族改了，假 provider 自动跟上。
  - `read_dir` 实现：连接 id 不在 `tree` 里 → `RemoteError::not_found(...)`；
    远端路径不在该连接的表里 → `RemoteError::not_found(...)`；否则 `Ok(entries.clone())`。
    **`remote_path` 传进来的值要先规范化**（尾斜杠、连续斜杠），与 Task 1 的规则一致。
  - `impl RemoteProvider for FakeRemoteProvider` 上加 `#[async_trait]`。

- [ ] **Step 3.4** 在 `src-tauri/src/remote/mod.rs` 加：
  ```rust
  mod error;
  mod fake;
  mod path;
  mod provider;

  pub use error::{RemoteError, RemoteErrorKind};
  pub use fake::FakeRemoteProvider;
  pub use path::{ /* Task 1 的导出 */ };
  pub use provider::{RemoteEntry, RemoteProvider};
  ```
  把 Task 1 原来的 `pub use path::{...}` 整行替换掉，避免重复导出。

- [ ] **Step 3.5** 跑 `cargo test --lib remote::provider`，确认失败（类型缺失）。
- [ ] **Step 3.6** 实现 `provider.rs`（`RemoteEntry` + trait + `#[async_trait]`）。
- [ ] **Step 3.7** 跑 `cargo test --lib remote::provider`，预期 5 passed。
- [ ] **Step 3.8** 跑全量 `cargo test --lib`，预期 406 passed。
  **这是本阶段最关键的一次全量跑** —— 如果测试二进制在这一步以
  `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉，说明 `remote` 模块把 tao 拖进来了。
  真发生了，按 `dumpbin /IMPORTS` 与基线二进制逐项 diff 的方法定位（AGENTS.md 里有完整流程）。
- [ ] **Step 3.9** 提交：
  ```
  feat(remote): 阶段 0 Task 3 —— RemoteProvider trait 与假 provider
  ```

---

## Task 4：TypeScript 路径族镜像

**Files:**
- Create: `src/utils/remote-paths.ts`
- Create: `src/utils/__tests__/remote-paths.test.ts`

**Interfaces:**
```ts
// src/utils/remote-paths.ts

export const REMOTE_SCHEME = 'sfm://remote';

export interface RemotePath {
  connectionId: string;
  /** 恒以 `/` 开头；根目录为 `/`；不含尾斜杠（根目录除外）。 */
  remotePath: string;
}

/** 前缀判定。与 Rust 的 `is_remote_path` 同义：不保证路径合法。 */
export function isRemotePath(path: string): boolean;

/** 解析并规范化。与 Rust 的 `parse_remote_path` 逐条对齐。 */
export function parseRemotePath(path: string): RemotePath | null;

/** 反向构造。连接 id 为空或含 `/` 返回 `null`。 */
export function buildRemotePath(connectionId: string, remotePath: string): string | null;

/** `sfm://remote/<connectionId>`。 */
export function buildRemoteConnectionPath(connectionId: string): string | null;

/** 词法父级。已在连接根时返回 `REMOTE_SCHEME`；已在根时返回 `null`。 */
export function getRemoteParentPath(path: string): string | null;

/** 是否恰好是某个连接的根。 */
export function isRemoteConnectionRootPath(path: string): boolean;
```

**Steps:**

- [ ] **Step 4.1** 写**失败的**测试 `src/utils/__tests__/remote-paths.test.ts`。
  用例与 Task 1 的 Rust 测试**一一对应**（同样的输入、同样的期望），
  外加一条 TS 特有的：
  ```ts
  it('keeps unicode and spaces verbatim', () => {
    const built = buildRemotePath('conn-a', '/中文目录/文件 1.txt');
    expect(built).toBe('sfm://remote/conn-a/中文目录/文件 1.txt');
    expect(parseRemotePath(built!)).toEqual({
      connectionId: 'conn-a',
      remotePath: '/中文目录/文件 1.txt',
    });
  });
  ```

- [ ] **Step 4.2** 跑测试确认失败：
  ```powershell
  $ErrorActionPreference = 'Continue'
  npx vitest run src/utils/__tests__/remote-paths.test.ts
  ```
  预期：`Failed to resolve import "@/utils/remote-paths"`。

- [ ] **Step 4.3** 实现 `src/utils/remote-paths.ts`，逻辑与 Rust 版逐条对应。
  注意本仓库 ESLint 风格：4 空格缩进、单引号、尾逗号、分号、箭头函数。
  `buildRemotePath` 里连接 id 的校验用 `/[\/\\]/` 同时挡正反斜杠
  （虽然 Rust 侧只挡 `/`，前端多挡一层不改变合法输入的判定）。

- [ ] **Step 4.4** 跑 `npx vitest run src/utils/__tests__/remote-paths.test.ts`，预期全部通过。
- [ ] **Step 4.5** 跑 `npx vue-tsc --build`，预期 0 error。
- [ ] **Step 4.6** 跑 `npx eslint src`，**预期仍是 179**。
- [ ] **Step 4.7** 提交：
  ```
  feat(remote): 阶段 0 Task 4 —— 前端远程路径族（与 Rust 侧逐条对齐）
  ```

---

## Task 5：前端 `remote` 动作门禁

**Files:**
- Modify: `src/utils/entry-action-policy.ts`
- Modify: `src/utils/__tests__/entry-action-policy.test.ts`

**Interfaces:**
```ts
// src/utils/entry-action-policy.ts

export type EntryActionPolicy = 'virtual-location' | 'remote' | 'system-mount-root' | 'normal';

/**
 * 远程空间在阶段 0 的门禁：**只放行导航类动作**。
 *
 * 阶段 0 还没有传输与远程写操作，放行它们会让用户点到没接线的按钮。
 * 阶段 3（新建目录 / 重命名 / 删除）与阶段 7（跨边界拖拽 / 复制粘贴）
 * 会**逐条从这里移出去** —— 每移一条，同步更新
 * `entry-action-policy.test.ts` 里那条「阶段 0 只放行导航」的断言。
 */
const REMOTE_PHASE0_BLOCKED_ACTIONS = new Set<ContextMenuAction>([
  'rename', 'batch-rename', 'copy', 'cut', 'link', 'paste',
  'delete', 'delete-permanently', 'open-with', 'properties',
  'quick-view', 'print', 'share',
]);

export function getEntryActionPolicy(path: string, platform: string | null): EntryActionPolicy;
```

**关键决策 —— `remote` 必须在 `virtual-location` 之前判断：**
`isVirtualDirectoryPath()` 目前只认 `sfm://locations` 与 `//wsl.localhost`，所以 `sfm://remote/...`
现在会掉到 `isProtectedSystemPath()` 分支被判成 `system-mount-root`。
`remote` 分支加在最前面，才能保证远程路径拿到自己的门禁而不是继承盘符根的。
后续 `sfm://remote` 会被接进 `isVirtualDirectoryPath`（阶段 1 连接列表落地时），
但那时 `remote` 判断仍在最前，顺序不会打架。

**Steps:**

- [ ] **Step 5.1** 在 `entry-action-policy.test.ts` 追加**失败的**测试：
  ```ts
  describe('remote policy', () => {
    it('classifies remote paths as remote, not as virtual or mount root', () => {
      expect(getEntryActionPolicy('sfm://remote/conn-a', 'windows')).toBe('remote');
      expect(getEntryActionPolicy('sfm://remote/conn-a/pub', 'windows')).toBe('remote');
      expect(getEntryActionPolicy('sfm://remote', 'windows')).toBe('remote');
    });

    it('blocks every non-navigation action on remote paths in phase 0', () => {
      const entries = [createEntry('sfm://remote/conn-a/pub')];

      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('rename', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('paste', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('properties', entries, 'windows')).toBe(true);
      // 导航类必须放行，否则远程路径根本点不进去
      expect(isActionBlockedByEntryPolicy('open-in-new-tab', entries, 'windows')).toBe(false);
      expect(isActionBlockedByEntryPolicy('toggle-favorite', entries, 'windows')).toBe(false);
    });

    it('takes the strictest policy when a selection mixes remote and normal entries', () => {
      const mixed = [createEntry('C:/Users'), createEntry('sfm://remote/conn-a/pub')];

      expect(isActionBlockedByEntryPolicy('delete', mixed, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', mixed, 'windows')).toBe(true);
    });

    it('leaves local paths on the normal policy', () => {
      expect(getEntryActionPolicy('C:/Users', 'windows')).toBe('normal');
      expect(isActionBlockedByEntryPolicy('copy', [createEntry('C:/Users')], 'windows')).toBe(false);
    });
  });
  ```
  把这段放进 `describe('entry-action-policy', ...)` 内部。

- [ ] **Step 5.2** 跑 `npx vitest run src/utils/__tests__/entry-action-policy.test.ts`，
  确认远程相关断言**失败**（`toBe('remote')` 拿到的是 `'system-mount-root'`），
  而 `'leaves local paths on the normal policy'` 那条**通过**。
  **这一步很关键**：如果全绿，说明断言没跑到被测代码。

- [ ] **Step 5.3** 改 `entry-action-policy.ts`：
  1. `import { isRemotePath } from '@/utils/remote-paths';`
  2. 联合类型插入 `'remote'`。
  3. 加 `REMOTE_PHASE0_BLOCKED_ACTIONS` 常量 + 中文注释（写明阶段 3/7 会逐条放开）。
  4. `getEntryActionPolicy` 最前面加：
     ```ts
     if (isRemotePath(path)) {
       return 'remote';
     }
     ```
  5. `isActionBlockedByEntryPolicy` 的循环里加：
     ```ts
     if (policy === 'remote' && REMOTE_PHASE0_BLOCKED_ACTIONS.has(action)) {
       return true;
     }
     ```

- [ ] **Step 5.4** 跑 `npx vitest run src/utils/__tests__/entry-action-policy.test.ts`，预期全部通过。
- [ ] **Step 5.5** 跑 `npx vue-tsc --build`（0 error）与 `npx eslint src`（179）。
- [ ] **Step 5.6** 提交：
  ```
  feat(remote): 阶段 0 Task 5 —— 远程路径动作门禁
  ```

---

## Task 6：远程路径的父级导航

**Files:**
- Modify: `src/utils/virtual-locations.ts`
- Modify: `src/utils/__tests__/virtual-locations.test.ts`

**Interfaces:**
```ts
// src/utils/virtual-locations.ts —— getNavigableParentPath 增加远程分支
export function getNavigableParentPath(path: string, platform: string | null): string | null;
```

分支必须放在 `isVirtualLocationPath` 之后、`canonicalizePath` 之前 ——
`canonicalizePath` 会把 `sfm://remote/conn-a/pub` 拆成盘符路径，语义全毁。

**Steps:**

- [ ] **Step 6.1** 在 `virtual-locations.test.ts` 的 `describe('getNavigableParentPath')` 内追加**失败的**测试：
  ```ts
  it('walks up the remote path family', () => {
    expect(getNavigableParentPath('sfm://remote/conn-a/pub/docs', 'windows')).toBe('sfm://remote/conn-a/pub');
    expect(getNavigableParentPath('sfm://remote/conn-a/pub', 'windows')).toBe('sfm://remote/conn-a');
    expect(getNavigableParentPath('sfm://remote/conn-a', 'windows')).toBe('sfm://remote');
    expect(getNavigableParentPath('sfm://remote', 'windows')).toBeNull();
  });

  it('does not let remote paths fall through to local parent resolution', () => {
    // 阳性对照：没有这个分支时它会被 canonicalizePath 拆成盘符路径，返回一堆本地父级
    expect(getNavigableParentPath('sfm://remote/conn-a/pub', 'linux')).toBe('sfm://remote/conn-a');
    expect(getNavigableParentPath('sfm://remote/conn-a', 'macos')).toBe('sfm://remote');
  });

  it('leaves invalid remote paths to their existing behaviour', () => {
    // `..` 段让 parseRemotePath 返回 null，此时不应走远程分支
    expect(getNavigableParentPath('sfm://remote/conn-a/pub/../etc', 'windows')).not.toBe('sfm://remote');
  });
  ```
  第三条是**刻意的边界测试**：`..` 路径不是合法远程路径，交给原有逻辑处理，
  本阶段不去管它会变成什么 —— 阶段 1 的命令入口会给出显式错误。

- [ ] **Step 6.2** 跑 `npx vitest run src/utils/__tests__/virtual-locations.test.ts`，
  确认前两条**失败**（当前返回的是本地父级或 `null`），第三条**通过**。

- [ ] **Step 6.3** 改 `virtual-locations.ts`：
  1. `import { getRemoteParentPath, isRemotePath } from '@/utils/remote-paths';`
  2. 在 `isWslHostVirtualPath` 分支之后、`const canonicalPath = ...` 之前插入：
     ```ts
     if (isRemotePath(normalizedPath)) {
       return getRemoteParentPath(normalizedPath);
     }
     ```

- [ ] **Step 6.4** 跑 `npx vitest run src/utils/__tests__/virtual-locations.test.ts`，预期全部通过。
- [ ] **Step 6.5** 跑 `npx vue-tsc --build`（0 error）与 `npx eslint src`（179）。
- [ ] **Step 6.6** 提交：
  ```
  feat(remote): 阶段 0 Task 6 —— 远程路径父级导航
  ```

---

## Task 7：全量门禁对照与收口

**Files:** 无新增代码。只做验证与文档。

**Steps:**

- [ ] **Step 7.1** Rust 全量：
  ```cmd
  call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat" && cargo test --lib
  ```
  预期 **406 passed**（386 基线 + Task 1 的 9 + Task 2 的 6 + Task 3 的 5）。
  数字对不上就停下查，不要合并。

- [ ] **Step 7.2** 前端全量：
  ```powershell
  $ErrorActionPreference = 'Continue'
  npx vitest run
  ```
  预期 **188 文件 / 1475 用例**（186 + Task 4 的 remote-paths + Task 5/6 是扩已有文件，不新增文件）。
  抓 `Test Files` / `Tests` 两行读数。

- [ ] **Step 7.3** 类型与 lint：
  ```powershell
  $ErrorActionPreference = 'Continue'
  npx vue-tsc --build
  npx eslint src
  ```
  预期 0 error / **179 errors**。179 变了就是回归。

- [ ] **Step 7.4** changelog 校验：
  ```powershell
  node scripts/verify-changelog.mjs
  ```
  预期退出码 0。若报缺条目，按脚本提示补 `CHANGELOG`。

- [ ] **Step 7.5** **本阶段不需要 `tauri build` 与真机验收** —— 阶段 0 没有任何用户可见功能，
  没有可点的界面可以验。打包与真机验收从阶段 1 开始。
  这一条写在这里，是为了避免下一个会话看到「没打包」误判成漏了步骤。

- [ ] **Step 7.6** 在计划文档末尾追加「实际结果」小节，逐条记录 7.1–7.4 的**实际数字**，
  而不是抄这里的预期值。数字对不上时如实写，并说明处置。

- [ ] **Step 7.7** 提交：
  ```
  docs(plan): 阶段 0 门禁实测结果
  ```

---

## 本阶段刻意**不做**的事

写下来是为了让后续会话不要「顺手补上」：

- **不注册任何 Tauri command**。阶段 1 才注册 `remote_read_dir` 等。
  提前注册会让 command 里出现 `spawn_blocking`，那是 `cargo test --lib` 红线的正中间。
- **不把 `sfm://remote` 加进 `isVirtualDirectoryPath()`**。它现在会喂给
  `virtual-location` 策略，而那份门禁**禁止 copy / paste / delete** ——
  恰好与远程空间需要的相反。阶段 1 连接列表落地时再接，届时 `remote` 判断已在最前。
- **不改 `is-protected-system-path.ts`**。它只被 `entry-action-policy.ts` 与
  `getNavigableParentPath` 调用，而这两处都已加了独立的 `remote` 分支，
  改它只会扩大爆炸半径、零收益。
- **不改 `resolveDirectoryContents` / `resolveDirEntry`**。它们要 invoke 尚不存在的 command，
  会让用户手输 `sfm://remote/...` 时看到一个来源不明的报错。阶段 1 接上 command 再改。
- **不做远程缩略图 / 快速查看 / 打印 / 终端 / 全局搜索**。
- **不引入 `suppaftp` / `russh` / `fast-socks5`**。阶段 1 只加 `fast-socks5`，
  阶段 2 才加 `suppaftp`。

## 阶段 0 交付后，阶段 1 接手时要用的接口

这些接口在本阶段定下，阶段 1 直接用，不再重新设计：

| 接口 | 位置 | 阶段 1 的用途 |
|---|---|---|
| `RemoteError` / `RemoteErrorKind` | `src-tauri/src/remote/error.rs` | 作为 Tauri command 的 `Err` 载荷；`as_str()` 给文案映射 |
| `RemoteProvider` | `src-tauri/src/remote/provider.rs` | `HashMap<String, Box<dyn RemoteProvider>>` 连接注册表的元素类型 |
| `FakeRemoteProvider` | `src-tauri/src/remote/fake.rs` | 回归夹具；阶段 1 用真实注册表取代它在产品路径上的位置 |
| `parse_remote_path` / `build_remote_path` | `src-tauri/src/remote/path.rs` | command 入参校验与出参构造 |
| `remote-paths.ts` 全部导出 | `src/utils/remote-paths.ts` | `resolveDirectoryContents` 分流、`getRemoteParentPath` 已接好 |
| `EntryActionPolicy` 的 `'remote'` | `src/utils/entry-action-policy.ts` | 阶段 3/7 逐条放开动作时改这一处 |
