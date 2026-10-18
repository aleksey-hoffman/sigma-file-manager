<!--
  阶段 1 执行计划 —— 由 superpowers:writing-plans 生成。
  规格来源：docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md §8 阶段表
  上游：阶段 0 已合入 main（3810069e）
-->

# 阶段 1：连接管理 + 凭据存储 + 设置页 + 传输层

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans

**Goal:** 让用户能在设置页里保存一条 FTP / FTPS / SFTP 连接（密码经 DPAPI 加密落盘），
并让传输层具备直连 / SOCKS5 / HTTP CONNECT / SOCKS5 BIND 四种出口且被单测覆盖。
**本阶段仍然不接任何真实协议库** —— `remote_read_dir` 继续由 `FakeRemoteProvider` 应答，
所以没有 FTP / SFTP 流量。

**Architecture:** 三条互不干扰的线。
① 传输层 `transport.rs` 完全不依赖协议库，只负责「给我一条已连上的双向字节流」，
SOCKS5 委托 `fast-socks5`，HTTP CONNECT 自写 —— 阶段 2 接 FTP 时只剩「数据通道怎么用 BIND」
这一个协议问题。② 连接元数据走既有 storage 文件链（新增第 5 个文件）。
③ 密码**不进 storage 链**，走独立文件 + DPAPI，两条链不混。

**Tech Stack:** Rust 1.90（edition 2021，`async-trait`、`fast-socks5`、`windows` crate 的
`Win32_Security_Cryptography`）、TypeScript 5.x、Vue 3、Vitest、17 个语言包。

## Global Constraints

1. **`cargo test --lib` 红线**：本阶段新增代码被测试二进制链接，**不得出现
   `tauri::AppHandle`、`tauri::async_runtime::*`、`tauri::` 的任何路径**。
   Tauri command 一律走 `*_blocking` 同步内核 + 调用方选执行器（参照 `dir_reader.rs`）。
   阶段 1 首次引入 Tauri command，**这是本阶段最可能踩线的地方**。

2. **Rust 环境**：每次 bash 调用都要重注入，用 `cmd /c ".superpowers\sdd\cargo-lib.cmd <args>"`。
   那个 `.cmd` **必须保持纯 ASCII** —— cmd.exe 按 ANSI 读 `.cmd`，UTF-8 中文注释会变成
   一串「不是内部或外部命令」的假报错。

3. **门禁基线**（HEAD=`3810069e`，本分支起点），必须逐字对照：

   | 命令 | 基线 |
   |---|---|
   | `cargo test --lib` | 409 |
   | `npx vitest run` | 187 文件 / 1483 用例 |
   | `npx vue-tsc --build` | 0 error |
   | `npx eslint src` | **179 errors** |
   | `node scripts/verify-changelog.mjs` | 退出码 0 |

4. **PowerShell**：调 `npm` / `npx` 前后显式 `$ErrorActionPreference = 'Continue'`；
   `vitest --reporter=basic` 不存在；**绝不用 `Get-Content -Raw` / `Set-Content` 改含中文的源文件**；
   **`node -e "..."` 的参数里只要可能出现 `"`、`` ` ``、`$`，就改用 write 工具落盘再执行**
   （PowerShell 会先于 node 解析引号，曾导致提交信息错配）。

5. **ESLint**：2 空格缩进、单引号、尾逗号；**对象属性各自一行**
   （`@stylistic/object-property-newline`）。新增文件 `--fix` 后**必须再跑全量**对照。

6. **不改动受保护常量**：mDNS 服务名、legacy 数据目录名、Tauri `identifier`。

## 已核实的外部事实（不要重新猜，也不要改）

`fast-socks5` v1.0.0 的真实签名，2026-10-18 从 `~/.cargo/registry` 源码逐字核对：

| 符号 | 真实签名 | 备注 |
|---|---|---|
| `fast_socks5::Socks5Command` | `enum { TCPConnect, TCPBind, UDPAssociate }` | **在 crate 根**，不是 `fast_socks5::command::` |
| `fast_socks5::AuthenticationMethod` | `enum { None, Password { username: String, password: String } }` | 变体名是 **`Password`** 不是 `UsernamePassword` |
| `fast_socks5::ReplyError` | `enum { Succeeded, ConnectionNotAllowed, NetworkUnreachable, HostUnreachable, ConnectionRefused, ... }` | SOCKS5 REP 码，需映射到 `RemoteErrorKind` |
| `fast_socks5::SocksError` | `thiserror` 枚举，含 `ArgumentInputError(&'static str)` / `Other(anyhow::Error)` 等 | 顶层错误 |
| `fast_socks5::client::Config` | 字段私有；`Default` + `set_connect_timeout(&mut self, Duration) -> &mut Self` + `set_skip_auth` | **必须 `Config::default()` 再 setter**，不能字面量构造 |
| `Socks5Stream<S>` | `S: AsyncRead + AsyncWrite + Unpin`，实现 `AsyncRead` + `AsyncWrite` + `Debug` + `Send` + `Sync` + `Unpin` | |
| `Socks5Stream::<TcpStream>::connect_raw` | `async fn connect_raw<T: ToSocketAddrs>(cmd: Socks5Command, socks_server: T, target_addr: String, target_port: u16, auth: Option<AuthenticationMethod>, config: Config) -> Result<Self>` | **BIND 入口** |
| `Socks5Stream::<TcpStream>::connect` | `async fn connect<T: ToSocketAddrs>(socks_server: T, target_addr: String, target_port: u16, config: Config) -> Result<Self>` | 无认证 CONNECT |
| `Socks5Stream::<S>::use_stream` | `async fn use_stream(socket: S, auth: Option<AuthenticationMethod>, config: Config) -> Result<Self>` | 复用已有 socket |

许可证 **MIT**，crate 描述写明「maintained by anyip.io」，GitHub 仓库是 `dizda/fast-socks5`，
文档覆盖率 31%。**「anyip.io 维护」这句话本身是对的，错的是把它当成 GitHub owner。**

## 已核实的仓库现状（不要重新调查）

- **全仓没有 DPAPI 先例。** `mcp-access.json` 是**明文**落盘 + `icacls` 收权限。
- `mcp-access.json` 落在 `app_data_dir` 根（`%APPDATA%/com.sigma-file-manager.app/`），
  **不在** `user-data/` 下，与后者平级。
- 既有敏感数据写入方式：**Rust command 直写文件**，不经 `tauri-plugin-store`。
  前端 `src/stores/runtime/mcp.ts` 只 `invoke`，从不碰路径。
- 新增第 5 个 storage 文件要改 **5 处**：
  1. `src-shared/user-storage-files.json` 的 `fileNames`
  2. `src-tauri/src/user_storage_files_config.rs` 的 `StorageFileNames`
  3. `src-tauri/src/startup_storage_bootstrap.rs`（`StartupStorageBootstrapPayload` +
     `build_error_payload` + `load_startup_storage_bootstrap` 三处）
     —— **不要动 `legacy_file_names`**，那会触发历史文件 rename
  4. `src/stores/storage/utils/startup-storage-bootstrap.ts` 的 interface
  5. `src/stores/storage/user-paths.ts`（`customPaths` 初值 + `setCustomPaths()`）
- 设置页分类注册表在 `src/stores/runtime/settings.ts` 的 `settingsTabs` 数组 + 动态 import。
  **`nav.vue` 不用改**，它只 v-for 渲染。
- i18n：17 个 `src/localization/messages/<2字母locale>.json`（中文是 `ch`），
  `npm run sync-i18n`（`npx tsx ./scripts/sync-i18n.js`）以 `en.json` 为准补缺键。
  **必须在仓库根跑**（脚本用相对路径）。**没有完整性校验测试。**
  键名约定：项标题 `settings.<分类>.<项>.title`，页签 `settingsTabs.<name>`。

---

## Task 1：传输层 `transport.rs`

**Files:**
- Create: `src-tauri/src/remote/transport.rs`
- Modify: `src-tauri/src/remote/mod.rs`
- Modify: `src-tauri/Cargo.toml`（加 `fast-socks5 = "1.0"`，**已在本分支加好**）

**Interfaces:**
```rust
// src-tauri/src/remote/transport.rs

/// 代理类型。三种出口对上层看起来一模一样 —— 这是本模块存在的全部理由。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ProxyConfig {
    Direct,
    Socks5 {
        host: String,
        port: u16,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
    HttpConnect {
        host: String,
        port: u16,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        username: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        password: Option<String>,
    },
}

/// SOCKS5 命令。FTP 被动模式的数据通道必须用 `Bind`。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Socks5CommandKind { Connect, Bind }

/// 已建立连接的字节流。三种出口统一成一种，协议层不需要知道走的哪条路。
pub enum TransportStream { /* Direct(TcpStream) | Socks5(..) | HttpConnect(TcpStream) */ }
impl AsyncRead for TransportStream { /* 委托 */ }
impl AsyncWrite for TransportStream { /* 委托 */ }

/// 建立一条到 `target_host:target_port` 的字节流。
pub async fn connect(
    proxy: &ProxyConfig,
    target_host: &str,
    target_port: u16,
    command: Socks5CommandKind,
) -> Result<TransportStream, RemoteError>;

/// HTTP CONNECT 的请求行拼装，**独立成纯函数**以便单测 —— 握手是这里最容易出错的部分。
pub fn build_http_connect_request(target_host: &str, target_port: u16, auth: Option<(&str, &str)>) -> String;

/// 从 HTTP CONNECT 响应里判定成功。**必须要求状态行是 2xx**，不能只判断「收到了响应」。
pub fn is_http_connect_success(status_line: &str) -> bool;

/// SOCKS5 `REP` → `RemoteErrorKind` 的映射。§3.6 要求「REP 必须映射成可读文案」。
pub fn map_socks5_reply_to_kind(rep: u8) -> RemoteErrorKind;
```

**Steps:**

- [ ] **1.1** 先写**纯函数**的失败测试（`build_http_connect_request` / `is_http_connect_success` /
      `map_socks5_reply_to_kind`）。这三者不碰 socket，可以先测透，是本 Task 的判别力基础。
- [ ] **1.2** 跑 `cargo test --lib remote::transport` 确认失败（函数不存在）。
- [ ] **1.3** 实现三个纯函数 + `ProxyConfig` / `Socks5CommandKind` / `RemoteErrorKind` 映射。
- [ ] **1.4** 再写 `connect()` 的失败测试，用 `fast-socks5` 自带的 **server 模块**当本地夹具
      （这是选它的额外好处：测试用的假代理与生产客户端出自同一份实现）。覆盖：
      - 直连连本机 echo 服务
      - SOCKS5 无认证 CONNECT
      - SOCKS5 用户名密码 CONNECT
      - SOCKS5 **BIND**：断言确实回传了一个可用的监听地址
      - 代理不可达 → `RemoteErrorKind::Unreachable`
      - 代理拒绝（REP=0x02）→ `RemoteErrorKind::Permission` 而**不是**笼统的 Unknown
      - HTTP CONNECT 200 / 403 / 连接被拒
- [ ] **1.5** 实现 `connect()` 与 `TransportStream` 的 `AsyncRead`/`AsyncWrite` 委托。
      委托时**用 `Pin::new(&mut ...)`**：三个底层类型都实现了 `Unpin`，
      所以不需要 `pin-project`。
- [ ] **1.6** 跑 `cargo test --lib remote::transport`，全绿。
- [ ] **1.7** 跑**全量** `cargo test --lib`，确认 409 + N。
      **这一步是本 Task 的生死线** —— 若测试二进制以 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉，
      说明 `fast-socks5` 拖进了不该有的东西，按 AGENTS.md 的 `dumpbin /IMPORTS` 逐项 diff 定位。
- [ ] **1.8** 提交。

## Task 2：连接模型与 storage 文件

**Files:**
- Modify: `src-shared/user-storage-files.json`、`src-tauri/src/user_storage_files_config.rs`、
  `src-tauri/src/startup_storage_bootstrap.rs`、`src/stores/storage/user-paths.ts`、
  `src/stores/storage/utils/startup-storage-bootstrap.ts`
- Create: `src-tauri/src/remote/connection.rs`、`src/stores/storage/remote-connections.ts`

**Interfaces:**
```rust
pub enum RemoteProtocol { Ftp, FtpsExplicit, FtpsImplicit, Sftp }
pub struct RemoteConnection {
    pub id: String,          // uuid v4 simple，不含 `/` 与 `\`
    pub name: String,
    pub protocol: RemoteProtocol,
    pub host: String,
    pub port: u16,
    pub username: String,
    pub initial_path: String,   // 规范化后的远端路径，恒以 `/` 开头
    pub proxy: ProxyConfig,
    /// DPAPI 密文的键（不是密码本身）。
    pub credential_key: Option<String>,
}
```
校验（写成纯函数，逐条测）：主机名非空且不含空白；端口 1..=65535；
`id` 不含 `/` `\`；`initial_path` 过 `normalize_remote_path`。

**Steps:**
- [ ] **2.1** 失败测试：序列化往返、每条校验规则。
- [ ] **2.2** 跑测试确认失败 → **2.3** 实现 → **2.4** 跑测试确认通过。
- [ ] **2.5** 改 5 处 storage 注册表；`cargo test --lib startup_storage` 与
      `npx vitest run` 相关用例保持绿。
- [ ] **2.6** 跑全量门禁 → **2.7** 提交。

## Task 3：DPAPI 凭据存储

**Files:**
- Create: `src-tauri/src/remote/credentials.rs`
- Modify: `src-tauri/Cargo.toml`（`windows` 加 `Win32_Security_Cryptography`）

**Interfaces:**
```rust
/// 用当前用户的 DPAPI 加密。**必须**用 `CRYPTPROTECT_UI_FORBIDDEN`。
pub fn protect(plaintext: &[u8]) -> Result<Vec<u8>, RemoteError>;
pub fn unprotect(ciphertext: &[u8]) -> Result<Vec<u8>, RemoteError>;
/// 落盘：`<app_data_dir>/remote-credentials.json`，仿 `mcp-access.json` 的位置与 icacls 收权限。
pub fn load_credential(app_data_dir: &Path, key: &str) -> Result<Option<String>, RemoteError>;
pub fn save_credential(app_data_dir: &Path, key: &str, secret: &str) -> Result<(), RemoteError>;
pub fn delete_credential(app_data_dir: &Path, key: &str) -> Result<(), RemoteError>;
```

**红线（写在这里是因为它们各自都能被「顺手优化」掉）：**
- `CRYPTPROTECT_UI_FORBIDDEN` 不可省 —— 少了它，任何进程都可能弹 UI 索要凭据。
- 密文**不进 storage 文件链**，走独立文件。两条链混用会绕过前端 schema 迁移与读白名单
  （AGENTS.md 已记录过「读写两侧不同步导致重启丢数据」）。
- 非 Windows 平台（macOS / Linux）**必须返回 `Unsupported` 类错误而不是 panic**。
  首版只支持 Windows，但代码要能在别的平台编译过。
- 本文件被 `cargo test --lib` 链接，**不得碰 tauri**。

**Steps:**
- [ ] **3.1** 失败测试（round-trip、空串、超长输入、随机字节当密文要报错）。
- [ ] **3.2** 跑确认失败 → **3.3** 实现 → **3.4** 跑确认通过。
- [ ] **3.5** 全量 `cargo test --lib`。**再查一次 `STATUS_ENTRYPOINT_NOT_FOUND`** ——
      DPAPI 走 crypt32/advapi32，与 comctl32 v6 无关，但这一步要确认而不是假设。
- [ ] **3.6** 提交。

## Task 4：Tauri command（`remote_list_connections` / `remote_save_connection` / …）

**红线**：command 里**必须**走 `remote::*_blocking` 同步内核，`spawn_blocking` 放在
`commands.rs` 里 —— 这正是 `cargo test --lib` 红线的正中间。

**Steps:** 失败测试 → 跑确认失败 → 实现（内核 + command 两层）→ 跑确认通过 →
全量 `cargo test --lib` → 提交。

## Task 5：前端 store 与命令封装

**Files:** `src/stores/storage/remote-connections.ts`、`src/modules/remote/**`
**Steps:** vitest 失败测试 → 跑确认失败 → 实现 → 跑确认通过 → `vue-tsc` + `eslint src` 回 179 → 提交。

## Task 6：设置页「远程」分类

**Files:** `src/stores/runtime/settings.ts`（`settingsTabs` 加一项）、
`src/modules/settings/ui/categories/remote/**`
**Steps:** 加 `settingsTabs` 条目 → 建分类组件（参照
`categories/appearance/show-hidden-items.vue` 的开关模板）→ 动态 import 注册 →
`vue-tsc` + `eslint src` 回 179 → 提交。

## Task 7：17 个语言包

**Steps:** 在 `en.json` 写全部新键 → 在 `ch.json` 写简体中文值 → `npm run sync-i18n`
（在**仓库根**跑）→ 逐个确认 17 个文件都补齐 → 提交。

## Task 8：全量门禁与收口

| 门禁 | 预期 |
|---|---|
| `cargo test --lib` | 409 + 本阶段新增 |
| `npx vitest run` | 187 文件 + 本阶段新增 |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **179** |
| `node scripts/verify-changelog.mjs` | 退出码 0 |
| `tauri build` + 真机验收 | **本阶段需要**（有用户可见的设置页） |

最后一步要跑 `tauri build` 的**打包产物**，不能用 `tauri dev`（dev 构建路由页内容区空白，
界面结论一律作废）。

## 本阶段刻意**不做**

- 不接 `suppaftp` / `russh`（阶段 2 / 5）
- 不改 `resolveDirectoryContents` —— 它要 invoke `remote_read_dir`，
  而那个 command 到阶段 2 才有真实实现
- 不做连接测试按钮（要真实协议栈，阶段 2）
- 不做跨边界拖拽 / 复制粘贴（阶段 7）
- 不做远程写操作（阶段 3）
