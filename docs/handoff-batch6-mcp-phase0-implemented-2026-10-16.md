# 批次 6：MCP Phase 0 + Phase 1（只读工具集）—— 实施结果与交接

- 日期：2026-10-16
- 基线：`3.1.3` 正式版（`c07ed2b8`）→ 本批起点 `730b4b0e`
- 范围：**只做 Phase 0 + Phase 1**。Phase 2（写工具）仍未启动
- 上一份交接（本文档要取代的范围说明）：`docs/handoff-batch6-mcp-phase0-2026-10-16.md`
- 调研报告：`docs/mcp-feasibility-report-2026-10-16.md`

---

## 0. 一句话结论

MCP **接上了**：官方 MCP Inspector 通过 Streamable HTTP 真实连上 `http://127.0.0.1:55100/mcp`，
`tools/list` 返回 6 个只读工具，`tools/call` 真实返回了本机 5 个盘符与目录内容。
**唯一未达成**的是交接文档要求的「Claude Desktop 也连一次」—— 本机没有安装 Claude Desktop。

---

## 1. 选型落地情况（对照 handoff §2）

| handoff 的结论 | 实际落地 | 偏差 |
|---|---|---|
| 内置 Streamable HTTP，绑 127.0.0.1 | ✅ `mcp/server.rs` 只绑回环 | 无 |
| 用 `rmcp` | ✅ `rmcp =3.5.1` | **版本不是 3.0.1**，见 §2.1 |
| 端口取 55000–55999 子段，不照抄 80 | ✅ `55100–55199` | 无 |
| 随机 token 存 app-data | ✅ `mcp-access.json`（含 token + 档位） | 无 |
| Origin 校验 → 403 | ✅ 由 `rmcp` 内置实现兜住 | 无 |
| 权限四档、每次调用重查 | ✅ `mcp/permission.rs` + `tools.rs::require_read` | 无 |
| 拒绝返回结构化错误 | ✅ `{error, currentMode, requiredMode, hint}` | 无 |
| `tools/list` 不受限 | ✅ | 无 |
| 状态栏常驻连接数 | ✅ 只在 >0 时显示 | 无 |
| 审计日志进 Phase 1 基线 | ✅ `mcp-audit.jsonl` | 无 |
| 工具是既有 command 的薄封装 | ⚠️ **不是薄封装** | 见 §2.2，这是本批最大的技术债 |

### 2.1 `rmcp` 版本：3.0.1 → 3.5.1（锁定）

handoff 写的是 `rmcp` 3.0.1。实际 crates.io 上最新是 **3.5.1**，且
`rust-version = 1.88` —— **与本 crate 的 MSRV 恰好相同，零余量**这一点仍然成立，
所以 `Cargo.toml` 里用的是精确版本 `=3.5.1` 而不是 `3`。

新增依赖共 8 个：`rmcp` / `rmcp-macros` / `schemars_derive` / `serde_derive_internals` /
`pastey` / `sse-stream` / `futures` / `tokio-stream`。`Cargo.lock` 其余部分零变化。

> ⚠️ 升级 `rmcp` 前先跑 `cargo +1.88.0 check`。SDK 抬 MSRV 会直接卡住本项目，
> 而 Cargo 只会给一个含糊的编译错误。

### 2.2 「工具是既有 command 的薄封装」没做到 —— 原因与代价

handoff §2.4 要求工具直接调既有 command（`dir_reader::read_dir` 等）。**照做会让
`cargo test --lib` 的测试二进制整个起不来。**

现象：测试二进制在**加载阶段**以 `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉，
一个测试都跑不了，报错里完全看不出跟 MCP 有关。

**根因（已定位，证据在 `dumpbin /IMPORTS` 的导入表 diff）**：

1. 本项目 `lib.rs` 里的 `.run()` 持有全部 145 个 command，但测试不会调 `run()`，
   所以基线上 **tao 一条导入都没有** —— GUI 代码整段被链接器丢掉。
2. MCP 的工具会被测试链接到。它一旦调用 `crate::dir_reader::read_dir`，
   就会走到 `tauri::async_runtime::spawn_blocking`；
   而 tauri 的 `static RUNTIME: OnceLock<GlobalRuntime<Wry>>` **带默认类型参数 `Wry`**，
   一处调用就单态化出 `<Wry as Runtime>`，把 tao 整条窗口链拖进来。
3. tao 里有 `comctl32.dll!TaskDialogIndirect`。它属于 **comctl32 v6**，
   只有 application manifest 声明了 v6 才会解析到；测试二进制没有 manifest，
   加载器找不到导出 → 0xC0000139。实测新增 152 个导入，其中 user32 占 104 个。

**改法**（`dir_reader.rs` / `global_search.rs` 新增阻塞内核入口）：

```rust
pub(crate) fn read_dir_blocking(path: String, options: Option<ReadDirOptions>) -> Result<DirContents, String>
pub(crate) fn get_system_drives_blocking() -> Result<Vec<DriveInfo>, String>
pub(crate) fn global_search_query_blocking(base_dir: PathBuf, query: String, options: ...) -> ...
pub(crate) fn search_directory_recursive_blocking(root_path: String, query: String, ...) -> ...
```

工具侧用 `tokio::task::spawn_blocking`（MCP 自己的运行时）包这些内核，
**业务逻辑一行没改**，只是换了承载线程池的地方。人类那条路完全没动。

**这条约束写进了 `src/mcp/mod.rs` 的模块文档**，后续任何人往 MCP 里加
`tauri::AppHandle` 或 `tauri::async_runtime::*` 都会撞上同一堵墙。

### 2.3 `tauri::AppHandle` 也不许出现在 MCP 模块里

同一次排查的结论：`mcp` 模块内任何位置出现 `AppHandle`（哪怕只是字段或参数）
都会触发 §2.2 的同一条链。因此 AppHandle 的活儿全部上移到 `commands.rs`，
算好 app-data 目录后以 `PathBuf` 形式传进 `McpRuntime`。

---

## 2.4 Phase 0 证伪结果（逐条）

| # | 待证伪 | 结果 |
|---|---|---|
| 1 | `rmcp` 与 `axum 0.8` 共存 | ✅ 通过。`rmcp` 自带测试就是用 `axum 0.8` 的 `Router::nest_service("/mcp", service)` 接线，本项目照抄 |
| 2 | MSRV 1.88 够用 | ✅ 编过（本机 1.90）。**但未用 1.88 实际编译**，见 §7 待办 |
| 3 | 127.0.0.1 + token + Origin 能被真实客户端连上 | ✅ Inspector 连上；Origin/Host 校验实测 403 |
| 4 | 一个真实 `tools/call` 走通既有 command | ✅ `list_directory` / `get_drives` 均返回真实数据 |

### 安全探针实测结果

```
no Origin (原生客户端)                → 200
Origin=http://localhost:6274          → 200   ← MCP Inspector 浏览器
Origin：https://evil.example.com      → 403   "Forbidden: Origin header is not allowed"
Host：evil.example.com                → 403   "Forbidden: Host header is not allowed"
无 Authorization / 错 token           → 401
```

---

## 3. 交付了什么

### 3.1 Rust：`src-tauri/src/mcp/`（全新，6 个文件）

| 文件 | 职责 |
|---|---|
| `mod.rs` | 模块文档（含 §2.2 那条约束）、`McpRuntime` 全局状态、`MCP_RUNTIME` |
| `permission.rs` | `AgentMode` 四档、`allows_read/write`、结构化拒绝体 |
| `auth.rs` | token 生成/轮换/常量时间比对、Bearer 解析、配置片段生成、`mcp-access.json` |
| `audit.rs` | JSONL 审计、轮转、损坏行跳过 |
| `tools.rs` | 6 个只读工具（`#[tool_router]` + `#[tool_handler]`） |
| `server.rs` | axum 路由、鉴权中间件、Origin/Host 白名单、端口查找、客户端活动追踪 |
| `commands.rs` | 6 个 Tauri command + `bootstrap` |
| `spike.rs` | Phase 0 spike 入口（`examples/mcp-spike.rs` 调用） |

### 3.2 工具集（第一档，只读）

| 工具 | 底层 |
|---|---|
| `list_directory` | `dir_reader::read_dir_blocking`，上限 2000 条且显式标 `truncated` |
| `get_drives` | `dir_reader::get_system_drives_blocking` |
| `get_mountable_devices` | `dir_reader::get_mountable_devices` |
| `search_files` | 全局索引 / 目录内递归（深度 9）双路，`typoTolerance` 等 5 个选项已透传 |
| `get_directory_size` | `dir_size::get_dir_size`，120s 超时 |
| `get_favorites` | 前端推送的收藏分类快照 |

**刻意不暴露**：`terminal::*`、`set_default_file_manager`、`app_updater::*`。

### 3.3 前端

| 文件 | 内容 |
|---|---|
| `src/stores/runtime/mcp.ts` | 状态、档位、token 轮换、配置片段、审计、收藏同步 |
| `.../experimental/mcp-server.vue` | 设置分区：档位下拉 + 运行状态 + 端点/客户端数/token + 复制配置 + 轮换 token + 最近调用列表 |
| `file-browser-status-bar.vue` | 「N 个 agent 已连接」徽标，**仅在 >0 时显示**，开着才轮询（5s） |
| `user-stats.ts` | `saveStats()` 末尾把收藏分类推给 Rust（失败只 warn） |
| `src/localization/messages/*.json` | 17 语种；`ch`/`en` 完整正文，其余落英文 |

**档位不放在 `user-settings.json`**：它是 Rust 侧的执行门控，Rust 必须能在不解析前端
schema、不跑迁移的前提下独立读出。存进用户设置就得同时改「读白名单 + 写列表」两处，
漏一处就是「界面显示只读、实际按关闭处理」。

---

## 4. 门禁

| 项 | 基线（`0a09af18` 批次 5 末） | 本批 | 判定 |
|---|---|---|---|
| `cargo test --lib` | 324 passed | **367 passed, 0 failed** | ✅ +43 |
| `npx vue-tsc --build` | 0 error | 0 error | ✅ |
| `npx eslint src` | 179 errors / 59 warnings | **179 / 59** | ✅ 逐字相同 |
| `npx vitest run` | 182 文件 / 1418 用例 | **183 / 1427** | ✅ +1 文件 +9 用例 |

> ⚠️ 跑门禁时又踩到批次 5 记过的那个坑：**vitest 与 eslint 并发**会让
> `lucide-icons.test.ts` 报 1 个失败（独占复跑即绿，183/1427）。
> 「Failed Tests」与「断言失败」仍然要分开看。

---

## 5. 本轮踩的坑（都是新的）

1. **`#[tool_router]` 不等于接线完成。** 只写 `#[tool_router] impl X {…}` +
   自己写的 `impl ServerHandler for X { fn get_info }`，编译通过、单测通过、
   **只有 `tools/list` 返回 `{"tools":[]}`**，一个工具都调不到。必须给
   `impl ServerHandler` 加 `#[tool_handler]`。
   rustc 对 `tool_router` 字段报 `never read` 警告 —— 当时差点当成噪音忽略，
   实际是这条线索。**「字段没被读」在这里不是误报。**

2. **`STATUS_ENTRYPOINT_NOT_FOUND` 会伪装成「测试框架坏了」。** 0xC0000139 不带
   任何 Rust 侧线索，看起来像工具链/依赖问题。定位手段：
   `dumpbin /DEPENDENTS` → 二分 `mod` 声明 → `dumpbin /IMPORTS` 与基线逐项 diff 导入表。

3. **与基线比导入表要对「刚重建的基线二进制」。** 拿 `target/debug/deps` 里的历史
   产物当基线会得出「新增 152 个 tao 导入」的假结论 —— 那些是不同 commit、不同
   时刻的构建。正确做法：`git stash` 后重建一份基线二进制再比。

4. **PowerShell 里 `$args` 是保留变量**（自动变量），`& npx @args` 会展开成空，
   表现为命令没反应。要用别的变量名（本次用 `$inspectorArgs`）。

5. **`npx @modelcontextprotocol/inspector --cli` 的 `--transport` 只接受
   `sse` / `http` / `stdio`**，写 `streamable-http` 会直接报
   `Invalid transport type`。本项目用的是 `http`。

6. **`--header "Authorization: Bearer <token>"` 含空格**，经 `cmd /c` 会被拆坏；
   用 PowerShell 参数数组 `@(...)` 展开才正确。

7. **工具返回值是被 JSON 转义过的**（塞在 `text` content 里），断言不能写
   `"\"entries\""`，否则永远不匹配、看起来像「工具没返回数据」。断言 `entries` 即可。

8. **`i18n` 批量写入用 node `fs` + `JSON.stringify(data, null, 2)`**，与仓库现有
   缩进一致时 `git diff` 只增不改（本次 +612 行，17 个文件，无格式漂移）。

---

## 6. 未完成 / 未验证（重要）

| 项 | 状态 |
|---|---|
| **Claude Desktop 真实连接** | ❌ **本机未安装**（无 exe、无注册表卸载项，只有 `%APPDATA%\Claude\` 的残留配置目录）。交接文档要求两个客户端各连一次，Inspector 已达成，**Claude Desktop 这一半没做，也不能假装做过** |
| MSRV 1.88 实际编译 | ❌ 只在本机 1.90 编过。「零余量」是**未验证的风险**，不是已验证的事实 |
| `tauri build` 打包产物真机验收 | ❌ 未做。本批的验证全部在 `cargo run --example mcp-spike`（同一个 `mcp` 模块）上完成。**应用内接线**（`setup_handler` → `bootstrap` → `set_mode`）的界面表现尚未在真机上看过 |
| `search_files` 工具 | ⚠️ spike 里没有 AppHandle，会明确返回「正在启动」的报错。**真机路径未验证** |
| 写工具（Phase 2） | 未做，范围外 |
| `open_in_alpha` / `get_current_location` / `get_selection`（第三档） | 未做，范围外 |

### 需要人来做的一步

装好 Claude Desktop 后，把设置页「复制配置片段」的内容粘进
`%APPDATA%\Claude\claude_desktop_config.json` 的 `mcpServers`，**完整退出重启**（关窗口不算）。

---

## 7. 待办

- [ ] 装 Claude Desktop，补上交接文档要求的第二个客户端连接
- [ ] `tauri build` 打包，在**打包版**上验收：设置页分区、状态栏徽标、切档启停、`search_files`
- [ ] `cargo +1.88.0 check` 确认 MSRV 真能编（需要装 1.88 工具链）
- [ ] CI 加一条 MSRV 检查
- [ ] Phase 1 剩余打磨：`catch_unwind` + 超时上限（handoff §6.4），目前只有 `dir_size` 的 120s 超时
- [ ] Phase 2 写工具（本批之后重新评估）
- [ ] 登记但不做：重复文件检测、Windows ODR 注册

---

## 8. 关键路径

| 用途 | 路径 |
|---|---|
| MCP 模块 | `src-tauri/src/mcp/`（先读 `mod.rs` 的模块文档） |
| Phase 0 spike | `cargo run --example mcp-spike -- C:\Users\Duanyi\afm-mcp-spike readOnly` |
| 阻塞内核入口 | `src-tauri/src/dir_reader.rs:24`、`src-tauri/src/global_search.rs:20` |
| 前端状态 | `src/stores/runtime/mcp.ts` |
| 设置分区 | `src/modules/settings/ui/categories/experimental/mcp-server.vue` |
| 审计日志 | `%APPDATA%\com.sigma-file-manager.app\mcp-audit.jsonl` |
| token 与档位 | `%APPDATA%\com.sigma-file-manager.app\mcp-access.json` |
| 一次性脚本 | `.superpowers/sdd/`（git-ignored）：`diff-imports.cjs`、`drop-app-handle.cjs`、`add-mcp-i18n.cjs` 等 |

---

## 9. 一次性脚本目录（git-ignored）

`.superpowers/sdd/` 下本批新增：`diff-imports.cjs`（导入表 diff）、
`fix-types.cjs`、`add-mcp-i18n.cjs`（17 语种文案）、`drop-app-handle.cjs`、
`probe-security.cjs`（Origin/Host/token 探针）、`restore-wiring.cjs`。
参考它们的写法：**批量改仓库文件一律用 node `fs` 脚本文件 + `writeFileSync(..., 'utf8')`**，
不要用 PowerShell 管道（会吃掉引号、写出 BOM）。
