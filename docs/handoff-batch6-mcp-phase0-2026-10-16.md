# 批次 6：MCP Phase 0 —— 可行性 spike 与只读工具集

- 日期：2026-10-16
- 基线：`3.1.3` 正式版已发布（`c07ed2b8`，HEAD == origin/main，工作区干净）
- 本批范围：**只做 Phase 0 + Phase 1**。Phase 2（写工具）在本批之后重新评估
- 调研报告（比本文档详细，含完整证据索引）：`docs/mcp-feasibility-report-2026-10-16.md`

---

## 0. 一句话现状

Alpha 要接 MCP。基础设施**已经全部现成**（HTTP 服务栈 + 145 个 command），MCP 层是适配器不是新功能。真正的难点只有三个：**传输选型、权限模型、鉴权**。本文档给的是选型结论与 Phase 0 的验收标准，不是让你重新调研。

---

## 1. 本批做什么、不做什么

### 做

1. **Phase 0 spike（1–2 人日）** —— 目的不是交付，是**证伪**。详见 §3.1
2. **Phase 1 只读工具集（4–6 人日）** —— 6 个只读工具 + 权限开关 + 鉴权 + 状态指示器 + 17 语言包 + 测试 + 真机验收

### 不做（明确划界，做了算超范围）

| 不做 | 原因 |
|---|---|
| 写工具（复制/移动/删除/重命名） | 误删不可逆。Phase 0 拿到真实连接数据后再决定 |
| `terminal` 的 3 个 command | 给 agent shell 能力 = 绕过全部权限设计 |
| `set_default_file_manager` | 改系统默认关联程序不该由 agent 决定 |
| `app_updater::*` | 同上 |
| stdio sidecar 二进制 | 只为解决「应用退出即失效」，先用主方案拿数据 |
| Windows ODR 注册 | 微软预发布，只在 Dev/Beta 频道，等转正 |
| MCP 作为「扩展市场里的包」 | **结构上做不到**，见 §2.3 |

---

## 2. 选型结论（不要重新调研）

### 2.1 传输：内置 Streamable HTTP，绑 127.0.0.1

MCP 当前规范 **2026-07-28**，传输只剩 `stdio` 与 `Streamable HTTP`（**SSE 已移除**），2026-07-28 为 stateless（仅 POST，GET/DELETE → 405）。

**GUI 应用不能被 stdio client 当子进程拉起**，而 Alpha 的价值恰恰在「运行中会话的内存态」，新起的子进程拿不到。所以选 Alpha 自己监听本地 HTTP。

参考先例：**DRAFT**（`https://github.com/p4inz-code/Draft/blob/main/docs/mcp.md`）——同为 Tauri 桌面应用做 MCP，问题几乎同构，它的完整论证可直接引用。

### 2.2 已被证伪的方案：本地 socket

DRAFT 做了本地 socket（Windows 命名管道 / Unix domain socket，托管在运行中的桌面应用内），技术上更优雅。但它同时明确写下：

> 没有任何主流 MCP 客户端的配置面支持「拨号这个命名管道 / Unix socket 路径」。它们的配置项是 `command/args/env`（stdio）或 `url`（HTTP）——**两者都映射不到 OS IPC 句柄**。

**不要走这条路。** 选了就等于要求用户自己写客户端。

### 2.3 「MCP 作为扩展」这个诉求要改口径

`src-tauri/src/extensions/manifest_permissions.rs:28-82` 显示扩展的 `http` 权限是**出站** host 白名单（`{"name":"http","hosts":[...]}`，scheme 由 `security.rs:145-147` 校验必须是 http/https）。`extension_http.rs` 是带缓存的出站客户端，**没有入站监听能力**。

扩展形态是 `package.json` manifest（`types.rs:10`）+ 本地二进制 + 子进程执行（`types.rs:26-30`），无 JS 运行时沙箱。

- ✅ 「**可选开启**」能做 —— 默认关闭，设置里打开
- ❌ 「扩展市场里的一个包」做不到 —— 需要新增一整套扩展能力（入站服务权限 + 生命周期管理 + 二进制分发），另一个量级的工程

按**应用内置的可选功能**设计与排期。

### 2.4 已经有的基础设施（零新增依赖）

`src-tauri/Cargo.toml:66-74` 已声明 `axum 0.8` / `axum-server 0.8` / `tokio` / `rcgen 0.14` / `mdns-sd 0.20` / `local-ip-address`。

`src-tauri/src/lan_share/server.rs:53-124` 已把 MCP Streamable HTTP 端点需要的每一步做完，**可直接当模板复制**：

| 需要的能力 | 现成实现 | 行号 |
|---|---|---|
| 找空闲端口 | `find_available_port()` | `network.rs` |
| 监听 | `tokio::net::TcpListener::bind()` | `server.rs:68-71` |
| 路由分发 | axum `Router` → `into_make_service()` | `server.rs:73-84` |
| 优雅关闭 | `axum_server::Handle` + `watch` channel | `server.rs:67, 89-99` |
| 端口广播 | `register_mdns()` | `server.rs:111-119` |

业务逻辑同样现成：`src-tauri/src/lib.rs:290-438` 的 `generate_handler!` 已注册 **145 个 command**，工具实现几乎全是既有 command 的薄封装。

**agent 的写操作必须走 `file_operations` 既有 command**，这样冲突检测（`check_conflicts`）、进度回调（`copy_move_job` / `delete_job`）、人类在界面上能看到 agent 在做什么——这些全部自动继承。不要另写一套。

---

## 3. Phase 0 spike：证伪四件事

**交付标准：MCP Inspector 与 Claude Desktop 各真实连上一次并成功调通一个 `dir_reader::read_dir` 包装工具。连不上就地停，不要往下走。**

必须验证：

1. `rmcp` 3.0.1（stateless、无 `initialize`）能否与 `axum 0.8` 共存
2. MSRV 确实够用 —— `Cargo.toml:9` 是 `rust-version = "1.88.0"`，`rmcp` 3.0.x 的 MSRV **恰好也是 1.88**，**零余量**。SDK 后续小版本抬 MSRV 会直接卡住。建议 spike 里锁死版本，并在 CI 加一条 MSRV 检查
3. 绑 `127.0.0.1` + token + Origin 校验的端点能被真实客户端连上
4. 一个真实 `tools/call` 走通既有 command

Rust 官方 SDK 是 **`rmcp`**。备选 `rust-mcp-sdk` + `rust-mcp-axum`（`mcp_routes()`，BYO-server，不交出 server 生命周期）。**2.2.0 是旧末版，必须显式 pin。**

### ⚠️ 端口不要照抄 lan_share

`lan_share/types.rs:16` 的 `HTTP_DEFAULT_PORT = 80`。**MCP 端点不能用它** —— Windows 上绑 80 端口需要管理员权限，且与 LAN 共享撞车。用 `PORT_RANGE_START..PORT_RANGE_END`（`types.rs:18-19`，55000–55999）区间内找空闲端口，或定义独立常量。

---

## 4. 工具集设计

分三档，**默认只开第一档**。

### 第一档：只读（默认可用）

| 工具 | 复用 command | 说明 |
|---|---|---|
| `list_directory` | `dir_reader::read_dir` | 列目录 |
| `get_drives` | `dir_reader::get_system_drives` | 盘符 |
| `get_mountable_devices` | `dir_reader::get_mountable_devices` | 可挂载设备 |
| `search_files` | `global_search::global_search_query` | **核心差异化** |
| `get_directory_size` | `dir_size::get_dir_size` | 目录大小（带缓存） |
| `get_favorites` | 收藏 store | 收藏分类 |

`search_files` 要透传批量 5 已加的选项：`includeFiles` / `includeDirectories` / `exactMatch` / `typoTolerance` / `resultLimit`（复用既有 `userSettings.globalSearch.*`，无需改 schema）。**默认深度已经是 9**，不要再传深度参数。

### 第二档：写（需显式授权，本批不做）

`copy_items` / `move_items` / `create_item` / `rename_item` / `delete_items` / `batch_rename`

### 第三档：会话状态（Alpha 独有，通用 MCP 没有）

| 工具 | 说明 |
|---|---|
| `get_current_location` | agent 知道人在哪 |
| `get_selection` | 人在选什么（对应 DRAFT 的 `get_selection`） |
| `open_in_alpha` | 把结果推回界面给人看 |

`open_in_alpha` 单独强调：它把「AI 干了活」变成「AI 干了活**并且人看到了**」。这是这类功能能不能被日常使用的分水岭。详见 §5.4。

---

## 5. 权限模型

抄 DRAFT 的形状（它踩过坑），对删除再加一道。

### 5.1 形态

应用内一个显式下拉（状态栏或设置页）：**关闭 / 只读 / 可写 / 每次审批**。默认「关闭」。

### 5.2 四条硬规则

1. **每次工具调用都重查模式**，不是连接时查一次。DRAFT 的 `AgentMode::allows_read()` / `allows_write()` 就是每次调用都查
2. **拒绝时返回结构化错误，不是静默**。DRAFT 返回 `{"error":"no read access","current_mode":"manual"}` —— agent 知道该去让用户切什么档
3. **`tools/list` 不受限**。能力发现不涉及数据泄露，让 agent 看到「切到可写档就能写」反而能引导用户正确授权
4. **状态栏常驻「N 个 agent 已连接」**。DRAFT 做进了 header（`LiveState.connections`）

### 5.3 删除单独再上一道锁

即便在「可写」档：`delete_items` 默认走**回收站**（项目已依赖 `trash = "5.2.6"`）而非硬删除；「每次审批」档下强制逐条确认；工具描述里写明「此操作会移动到回收站」。

### 5.4 审计日志进 Phase 1 基线，不是 Phase 3

这是信任设施不是增强功能 —— 用户让 AI 碰自己的文件，「它到底改了什么」必须随时可查。

---

## 6. 安全硬要求

三条，缺一不可。

### 6.1 只绑 127.0.0.1

⚠️ **不能照抄 `lan_share/server.rs:68`** —— 那里是 `SocketAddr::from(([0, 0, 0, 0], http_port))`，绑 `0.0.0.0`。LAN 共享要对外所以那样是对的，**MCP 端点必须只绑回环**。

### 6.2 随机 token + Origin 校验

启动时生成随机 token，写进**用户自己的 app-data 目录**（**不是共享临时目录**），MCP 配置里作为 header 传入。同时按规范校验 `Origin`，非法返回 **403**（防 DNS rebinding，规范硬要求）。

### 6.3 不要相信「loopback-only 就是安全」

DRAFT 在安全评审里发现过：

> 「loopback-only」描述的是 TCP 套接字的绑定地址，**不是** Unix socket 文件或命名管道的 ACL —— 后者默认值比「仅本用户」**更宽松**（未加固的 Windows 命名管道默认 DACL 按 `CreateNamedPipe` 文档是给 Everyone 组读权限）。

放到 Alpha 身上：**本机任何进程都能连 127.0.0.1 的端口**。token 是唯一屏障，不能省。

### 6.4 Embedded 形态的两个已知风险

| 风险 | 缓解 |
|---|---|
| tool panic = 宿主崩溃 | 每个工具调用 Rust 侧 `catch_unwind` 兜住 + 超时上限 |
| 权限全有或全无 | §5 的分级授权 + **每次调用重查** |

---

## 7. 用户怎么用：五个真实例子

> ⚠️ **以下是对设计意图的举例，功能尚未实现、这些例子未经真机验证。** 它们的作用是反过来检验工具集设计是否够用——如果某个例子需要一套没设计的工具才能做，说明设计有缺口。

配置方式（应用内「复制配置片段」按钮可直接产出）：

```json
{
  "mcpServers": {
    "alpha-file-manager": {
      "url": "http://127.0.0.1:<端口>/mcp",
      "headers": { "Authorization": "Bearer <应用内显示的 token>" }
    }
  }
}
```

放到 `claude_desktop_config.json`（Windows：`%APPDATA%\Claude\`）或 Claude Code 的 `.mcp.json`。**Claude Desktop 改完要完整退出重启**，关窗口不算。

---

### 例 1 · 找回一个记不清名字的文件

> 「帮我在 `D:\photos` 里找出所有文件名带 `095` 的文件，按修改时间倒序排给我。」

走的工具：`search_files`

**为什么只有 Alpha 做得到**：通用 filesystem MCP 只有「遍历 + 字符串匹配」，得当场扫完整棵目录树。Alpha 有 tantivy 索引 + 拼写容错 + 排除规则。实测 `G:\photos` 有 43,167 个条目 —— 这正是用户上一批反馈的场景，搜 `095` 应该命中 `20251009_0095_27.jpg`。

---

### 例 2 · 记忆不精确时的模糊查询

> 「找出我上个月改过、文件名像是带『季度报』的表格。」

走的工具：`search_files`（`typoTolerance = true`）

用户拼成 `jidubaogao` 也能命中。**关闭容错时拼错的查询依然搜不到** —— 两个方向都有 Rust 回归测试守着（`recursive_scan_cap` 模块）。

---

### 例 3 · 批量整理，而且**人看得见**

> 「把 `D:\下载` 里所有 zip 解压出来，按顶层文件夹名归到 `E:\项目\<项目名>\`，重名的加 ` (2)` 这样的序号，**弄完跳到那个目录让我看看**。」

走的工具：`list_directory` → `create_item` → `move_items` → `open_in_alpha`

**最后一步是分水岭。** 没有它，agent 干完活只回一句「已完成」，你还得自己去翻目录找结果。有了它，Alpha 界面直接切到整理好的目录。**这条是第三档工具里最该优先做的。**

---

### 例 4 · 从「人在看什么」接力

> 「我现在在 Alpha 里开着哪个目录？把那个目录下的 `.tmp` 清掉，**删之前先列给我看**。」

走的工具：`get_current_location` → `get_selection` → `list_directory` → 人工确认 → `delete_items`

**通用 MCP 结构上做不到这条**：stdio 子进程看不到运行中的内存会话，你得自己把路径念给 AI。agent 先读到你正打开的目录，省掉整轮描述。

---

### 例 5 · 跨盘清点，零风险

> 「统计 C/D/E 三个盘里超过 1GB 的视频文件，按所在目录分组给我一份清单，**先别动**。」

走的工具：`get_drives` → `list_directory` + `get_directory_size`

**只读档就能完成，全程零风险。** 这是本批 Phase 1 交付后用户马上能用的场景，也是验证「默认只读」这个设计决策是否正确的第一道考题。

---

### 反例：为什么不要给 agent 开 `terminal`

本项目有 `terminal` 的 3 个 command。**不要暴露。** 给 agent shell 能力等于让它能绕过路径白名单、绕过回收站、绕过所有权限设计——前面五条例子建立的信任瞬间归零。`src-tauri/src/lib.rs:290-438` 里有它们，但 MCP 不给。

---

## 8. 门禁与基线

| 项 | 基线（`0a09af18` 批次 5 结束时） |
|---|---|
| `cargo test --lib` | **324 passed, 0 failed** |
| `npx vue-tsc --build` | 0 error |
| `npx eslint src` | **179 errors**（逐字相同的基线）/ 59 warnings |
| `npx vitest run` | **182 文件 / 1418 用例**全绿 |
| `node scripts/verify-changelog.mjs` | 转绿（3.1.3 条目已在） |

**基线必须用同一条命令量**（`eslint src`，不是 `eslint .`）。`eslint .` 在同一提交上是 186/121，口径混用会凭空多出 7 个「回归」。

**不要用 `tempfile::TempDir` 建 Rust 夹具。** `global_search/ignore.rs` 的 `builtin_ignored_paths()` 覆盖 `/AppData/Local/Temp`，TempDir 默认建在那里，`filter_entry` 会剪掉整棵夹具导致命中恒为 0。改用 `~/afm-rust-search-fixtures/<label>-<pid>-<nanos>-<seq>/` + `Drop` 清理。本项目已栽同一坑两次（前端一次、Rust 一次）。

---

## 9. 本项目与 MCP 相关的环境坑

1. **构建必须串行单跑。** 曾因两套 `npm run tauri build` 并发写同一 `dist/` + `target/` 失败。
2. **打包必须用 `tauri build` 的产物做真机验收，不能用 `tauri dev`。** `tauri dev` 下所有路由页面内容区空白，是 dev 构建特有的已知问题，**不是代码缺陷**，在 dev 上做的界面验收结论一律作废。
3. **PowerShell 引号陷阱。** `node -e "..."` 里的引号与 `$1` 会被 PS 吃掉并报 `ParseError`；`>` 重定向用 PS 默认编码写坏文件。**一律改用 `.superpowers\sdd\*.cjs` 脚本文件 + node `fs.writeFileSync(..., 'utf8')`。**
4. **不要用 `Get-Content -Raw` / `Set-Content` 改带中文注释的源文件。** PS 5.1 按 ANSI 读无 BOM 的 UTF-8，中文注释读进来就是乱码，写回去就把文件毁了。本项目栽过，代价是一个文件中文全变 mojibake。改完立刻用 node 验：`s.includes('某个中文')` 且 `s.match(/\uFFFD/g)` 为空。
5. **`Out-File -Encoding utf8` 会给文件加 BOM。** 写提交信息一律用 node `fs.writeFileSync(..., 'utf8')`（表现为 `git log` 里 `docs:` 前有不可见字符）。
6. **`$ErrorActionPreference = 'Stop'` 会把原生命令的 stderr 变成终止错误。** 门禁脚本调 `npm` / `npx` 前后必须显式切回 `Continue`。
7. **`vitest --reporter=basic` 在本仓库这版不存在**，会 `Failed to load custom Reporter` 直接中止。跑全量用默认 reporter，再按 `Test Files` / `Tests` 两行抓结果。
8. **Rust 工具链不在 PATH。** 在 `C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`；MSVC 靠 `call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat"`。可直接复用 `.superpowers/sdd/build-fb4.cmd` 与 `.superpowers/sdd/test-rust.cmd`。**测试脚本只把 MSVC 置顶、不删 PATH**（删 `Git\usr\bin` 会让 `dir_reader` 两个调外部程序建 `.lnk` 的测试报 program not found）。

---

## 10. 待办

- [ ] Phase 0 spike：证伪四件事，产出「连得上 / 连不上」的明确结论
- [ ] Phase 1：6 个只读工具 + 权限下拉 + 状态指示器 + 鉴权 + 审计日志 + 17 语言包
- [ ] Phase 1 验收：用 `tauri build` 产物，Claude Desktop + MCP Inspector 各连一次
- [ ] 拿到真实使用数据后重新评估 Phase 2（写工具）是否值得
- [ ] 登记但不做：重复文件检测（已核实 Alpha **没有**该功能，`ch.json` 里所有 `duplicate` 命中都是「重复标签页」「重名」；它是独立新功能，不属 MCP 范畴）
- [ ] 登记但不做：Windows ODR 注册（微软预发布，见调研报告 §11.4）

---

## 11. 必读文档与关键路径

### 必读（按顺序）

| 路径 | 为什么 |
|---|---|
| `AGENTS.md` | **硬约束，优先级高于本文档**。产品名、受保护常量、真机验收纪律 |
| `docs/mcp-feasibility-report-2026-10-16.md` | 完整调研，含证据索引、传输选型论证、豆包分析复核 |
| `docs/handoff-batch5-search-fixes-2026-10-16.md` | 上一批做了什么、`search_files` 的选项与行为 |
| 本文档 | Phase 0 范围与验收标准 |

### 关键代码路径（全部相对 `F:\soft\00selfmade\filemanager\sigma-file-manager\`）

| 用途 | 路径 |
|---|---|
| 可复用 HTTP 服务模板 | `src-tauri/src/lan_share/server.rs:53-124` |
| 端口查找 / 格式化 URL | `src-tauri/src/lan_share/network.rs` |
| 端口常量（**别照抄 80**） | `src-tauri/src/lan_share/types.rs:15-19` |
| 已注册的 145 个 command | `src-tauri/src/lib.rs:290-438` |
| 目录读取能力 | `src-tauri/src/dir_reader/` |
| 全局搜索 | `src-tauri/src/global_search/query.rs`、`commands.rs`、`scoring.rs`、`ignore.rs` |
| 文件操作（agent 写操作要走的路） | `src-tauri/src/file_operations.rs` |
| 扩展权限模型（证明做不成扩展包） | `src-tauri/src/extensions/manifest_permissions.rs:28-82`、`security.rs:145-147` |
| Tauri 插件注册 / setup hook | `src-tauri/src/lib.rs` |
| 更新弹窗与本地化回退 | `src/modules/changelog/composables/use-changelog.ts` |
| 发版流水线 | `scripts/release-publish.mjs` |
| 语言包（17 语种，中文 locale 是 `ch`） | `src/localization/messages/` |

### 一次性脚本目录（git-ignored）

`.superpowers/sdd/` —— `build-fb4.cmd`（打包）、`test-rust.cmd`（Rust 测试）、`bump-beta-version.cjs`、`promote-changelog-313.cjs`（参考它的写法：批量改 JSON/Markdown 一律用 node `fs`，不要用 PowerShell 管道）

---

## 12. 外部参考

| 事实 | 来源 |
|---|---|
| 规范版本、传输、stateless、Origin 校验、AAIF 治理 | MCP 官方规范（modelcontextprotocol） |
| `rmcp` 3.0.x、MSRV 1.88 | crates.io |
| Tauri 桌面应用做 MCP 的完整先例、stdio 不适用的论证、本地 socket 无主流客户端可连、AgentMode 权限模型、loopback≠只有本用户的坑 | `https://github.com/p4inz-code/Draft/blob/main/docs/mcp.md` |
| Claude Desktop / Claude Code 配置路径与形态 | `https://www.claudemap.org/zh/guides/mcp-servers-configuration` |
| Windows 11 原生 MCP（ODR、File Explorer connector、Agent Session）——**官方只做了基础档**，语义搜索锁 Copilot+ | Microsoft Learn《Model Context Protocol (MCP) on Windows》 |
| Embedded / Sidecar / Remote 权衡矩阵 | theneurbase.com MCP in IDP 指南 |
