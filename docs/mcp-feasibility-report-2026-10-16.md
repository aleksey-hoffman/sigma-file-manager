# Alpha File Manager 接入 MCP 的调研与可行性报告

- 日期：2026-10-16
- 版本基线：`3.1.3-beta.2`（HEAD `0a09af18`）
- 结论摘要：**有价值，且已被微软官方验证。价值不在「让 AI 搬文件」，而在「微软自己只做了基础档」。建议做，分阶段，先做只读。核心工作量 13–21 人日，最小可用形态 5–8 人日。**
- 修订：同日复核了豆包对本课题的分析（§11）。结论**不变且被加强**，但工作量的构成认知需要修正——豆包把最大的一块工程量误当成了协议自带能力。

---

## 0. 一句话结论

Alpha 已经有 MCP 所需的**全部基础设施**（`axum` + `tokio` + 自签 TLS + mDNS）和**全部业务逻辑**（145 个已注册 command），MCP 层本身是一个**适配器**，不是新功能。真正的难点不在协议，而在三件事：**权限模型、鉴权、以及「应用退出后服务就没了」这个传输选型**。

---

## 1. 为什么有价值：差异化不在「文件读写」

需要先说清楚一件容易被误判的事：**通用的 filesystem MCP server 已经存在且成熟**（`@modelcontextprotocol/server-filesystem`，月下载量以万计）。如果 Alpha 的 MCP 只做「读目录、读文件、写文件」，那它和现成方案的差别只有「我们是自家做的」——那不值得做。

Alpha 真正能提供、而通用 server 结构上做不到的，是这四类：

### 1.1 已建索引的全局搜索（最强的一张牌）

`src-tauri/src/global_search`（8 个 command）背后是 `tantivy 0.26` 全文索引，加上：

- 递归扫描，默认深度 **9 层**（本批次刚从 7 提上来）
- **拼写容错**（`TYPO_TOLERANCE_COEFFICIENT_THRESHOLD = 0.7`）
- 排除规则（`builtin_ignored_paths()`，含 `/tmp`、`/node_modules`、`/.git`、`/target` 等）
- 结果数上限、包含文件/目录开关、精确匹配

通用 filesystem MCP 只有「遍历 + 字符串匹配」，没有索引、没有容错、没有排除规则。

agent 能问出、而通用 server 答不出的话：

> 「找出我去年所有大于 500MB 的照片，按拍摄时间排序」
> 「我在 D 盘根目录下的那个 `095` 是哪个文件来着」

第二条就是本批次用户真实反馈的场景——当时 `min_score` 门槛把 3 字符查询的子串命中杀掉了。这说明**搜索质量本身就是用户痛点**，把它开放给 agent 是自然延伸。

### 1.2 运行中会话的实时状态

用户在 Alpha 里正打开某个目录、选中了一批文件、右边分屏开着搜索——agent 能看到并操作**同一个会话**。

这是 stdio 子进程形态**结构上做不到**的事，下面 §4.1 会详细讲为什么。

### 1.3 元数据与组织体系

收藏分类、目录树、标签页/工作区状态、批量重命名、目录大小计算。这些 Alpha 有，通用 server 没有。

### 1.4 更细的授权粒度

10,000+ 公共 server 里质量差异极大，filesystem 类的权限模型基本是「你给我目录，我全都能动」。Alpha 已有 `extensions/security.rs` 的 URL/host 模式校验基建，可以做**比通用方案更严**的分级授权（§5）。

### 反向价值（本轮不做，登记备查）

MCP 也让 Alpha 作为 **client** 去连别人的 server。但这与当前需求方向相反，且要引入 client 侧 SDK 与配置 UI，本轮不纳入。

---

## 2. Alpha 侧现状（已取证）

### 2.1 HTTP 服务栈已经在仓库里 —— 这是最重要的发现

`src-tauri/Cargo.toml:66-74` 已声明：

```toml
axum        = { version = "0.8", features = ["multipart"] }
axum-server = { version = "0.8", features = ["tls-rustls"] }
tokio       = { version = "1", features = ["rt", "rt-multi-thread", "sync"] }
rcgen       = "0.14"
mdns-sd     = { version = "0.20", features = ["async"] }
local-ip-address = "0.6"
```

而 `src-tauri/src/lan_share/server.rs:53-101` 已经把 MCP Streamable HTTP 端点需要做的事**全部做了一遍**：

| MCP 需要的能力 | `lan_share` 里的现成实现 | 行号 |
|---|---|---|
| 找一个空闲端口 | `find_available_port(HTTP_DEFAULT_PORT, &[])` | `server.rs:54` |
| 监听 socket | `tokio::net::TcpListener::bind(http_addr)` | `server.rs:68-71` |
| 路由分发 | axum `Router` → `into_make_service()` | `server.rs:73-84` |
| TLS（可选） | `rcgen` 自签 + `axum_server::bind_rustls` | `server.rs:87-99` |
| 优雅关闭 | `axum_server::Handle` + `watch` channel | `server.rs:67, 89-99` |
| 端口发现/广播 | `register_mdns(http_port, local_ip)` | `server.rs:111-119` |

**结论：引入 MCP 不需要新增任何网络依赖，也不需要新的架构模式。** 这把最大的未知项消掉了。

### 2.2 业务逻辑已经写好

`src-tauri/src/lib.rs:290-438` 的 `generate_handler!` 已注册 **145 个 command**：

| 模块 | 数量 | 对 MCP 的用途 |
|---|---|---|
| `extensions` | 41 | 扩展管理（与 MCP 工具面无直接关系） |
| `dir_reader` | 20 | **列目录、盘符、路径判断、挂载设备** |
| `system_clipboard` | 12 | 剪贴板读写 |
| `open_with` | 9 | 用默认程序打开 |
| `global_search` | 8 | **全局搜索（核心差异化）** |
| `dir_size` | 7 | 目录大小计算与缓存 |
| `file_operations` | 7 | **复制/移动/重命名/删除/新建/冲突检测** |
| `image_thumbnails` | 5 | 缩略图 |
| `batch_rename` | 4 | 批量重命名 |
| `lan_share` | 3 | HTTP 服务启停 |
| `terminal` | 3 | 终端 |
| `dir_watcher` | 3 | 目录监听 |
| 其余 | 26 | 更新、托盘、后台任务等 |

MCP 工具的实现**几乎全是既有 command 的薄封装**，不是新写的业务逻辑。这也意味着 agent 的写操作与人类操作**走同一条代码路径**——冲突检测、进度回调、批量任务管理自动继承，不会出现「agent 绕过 UI 直接调底层」的两套语义。

### 2.3 扩展系统不能监听端口 —— 这否掉了「MCP 做成普通扩展」

`src-tauri/src/extensions/manifest_permissions.rs:28-82` 的 `parse_extension_http_allowed_hosts` 显示，扩展的 `http` 权限是**出站白名单**：

```json
{ "permissions": [ { "name": "http", "hosts": ["https://httpbin.org"] } ] }
```

由 `security.rs:145-147` 校验 scheme 必须是 `http`/`https`。`extensions/extension_http.rs` 是带缓存的**出站** HTTP 客户端，不是服务器。

扩展的实际形态是 `package.json` manifest（`types.rs:10`）+ 本地二进制 + 子进程执行（`types.rs:26-30` 的 `ExtensionCommandResult { code, stdout, stderr }`，`binaries.rs` 25.4 KB，`processes.rs` 17.1 KB）——**没有 JS 运行时沙箱，也没有入站监听能力**。

**结论：MCP 不能作为「用户可安装的第三方扩展」实现。** 只能内置，或随应用打包一个二进制。用户说的「作为扩展，可选装」可以实现为**「应用内置的一个可选开启的功能」**，而不是**「扩展市场里的一个包」**。这个区别需要在需求上对齐。

---

## 3. MCP 生态事实（截至 2026-10）

| 项 | 事实 |
|---|---|
| 规范当前版本 | **2026-07-28** |
| 传输 | 仅 **`stdio`** + **`Streamable HTTP`**。**SSE 传输已被移除** |
| 2026-07-28 形态 | **stateless**：仅 POST，GET/DELETE 返回 405 |
| Streamable HTTP 硬要求 | **必须校验 `Origin` header**，非法返回 **403**，防 DNS rebinding |
| 治理 | 2025-12-09 捐给 Linux Foundation 下的 **Agentic AI Foundation (AAIF)**，与 goose (Block)、AGENTS.md (OpenAI) 并列创始项目 |
| 规模 | 2025-12 月 SDK 下载量 > 9700 万；活跃公共 server **10,000+** |
| Rust 官方 SDK | **`rmcp` 3.0.x**（3.0.1 对应 2026-07-28 规范），**MSRV Rust 1.88**；2.2.0 为旧末版，指南需显式 pin |
| Rust 备选 SDK | `rust-mcp-sdk` + `rust-mcp-axum` / `rust-mcp-actix`，支持 BYO-server（`mcp_routes()` / `mcp_scope()`），不交出 server 生命周期 |

### 3.1 一个必须注意的巧合

`Cargo.toml:9` 声明 `rust-version = "1.88.0"`，而 `rmcp` 3.0.1 的 MSRV **恰好也是 1.88**。

匹配，但**零余量**。SDK 后续小版本一旦抬 MSRV，Alpha 会被直接卡住。建议 spike 阶段就把 `rmcp` 锁死版本，并在 CI 里加一条 MSRV 检查。

### 3.2 客户端兼容矩阵

| 客户端 | stdio | Streamable HTTP |
|---|---|---|
| Claude Desktop | ✅ | ✅ |
| Claude Code / Agent SDK | ✅ | ✅（SDK 另支持 in-process） |
| Cursor | ✅ | ✅ |
| VS Code / GitHub Copilot | ✅ | ✅ |
| Zed | ✅ | — |
| Devin Desktop | ✅ | ✅ |
| ChatGPT | ❌ | ✅（**仅远端 HTTP**） |

ChatGPT 那一行值得单独看：它只支持 remote HTTP，且 2026-07-28 弃用了 Dynamic Client Registration。对本地桌面应用而言，这意味着**本地 HTTP server 不在 ChatGPT 的可达范围内**，不必为它做公网暴露。

---

## 4. 传输选型：这是最关键的决策

### 4.1 为什么不能只用 stdio（有一个几乎同构的先例）

**DRAFT**（`https://github.com/p4inz-code/Draft/blob/main/docs/mcp.md`）是一个 Tauri 桌面应用，同样在做 MCP，核心问题与我们**几乎完全相同**。它的结论值得逐字引用：

> 大多数 MCP server 是 agent host 拉起的子进程，通过 stdio 通信——**这对「除了每次重新加载之外没有状态」的 server 成立**。DRAFT 的 MCP server 需要暴露**一个正在被人主动编辑的、已经运行中的桌面应用的状态**。新起的子进程拿不到那份内存会话，所以在这里单用 stdio 是错误的默认选择。

**这正是 Alpha 的处境**：用户在 Alpha 里打开的目录、选中的文件、当前工作区，是内存态。stdio 子进程看不到。

DRAFT 最终做了**两个真实传输**，都用真实 `rmcp` client 做了端到端测试：

1. **本地 socket** —— Windows 命名管道 `\\.\pipe\draft-mcp` / Unix domain socket，loopback-only，**托管在运行中的桌面应用内**（从 `setup` hook 启动）。读写的是画布写入的**同一个 `Arc<Mutex<Graph>>`**，所以 agent 能实时看到编辑；agent 写回时人类也能看到。
2. **stdio** —— `draft-mcp` CLI 二进制，操作已保存的项目目录，供 headless/CI 用。**启动时加载一次，看不到后续编辑。**

### 4.2 但 DRAFT 同时给出了一条关键的负面结论

> 本地 socket 这个「live」传输是 DRAFT 桌面应用自己的通道，**不是一个通用的 MCP 入口**。它在管道/socket 上说的是真正的 MCP 线协议（同一个 rmcp server 逻辑，同一套 JSON-RPC 分帧）——**但没有任何主流 MCP 客户端的配置面支持「拨号这个命名管道 / Unix socket 路径」来访问 server**。它们的配置项是 `command/args/env`（stdio）或 `url`（HTTP）——**两者都映射不到 OS IPC 句柄**。

**结论：本地 socket 这条路对 Alpha 同样不可行。** 不能因为它技术上更优雅就选它——选了就等于要求用户自己写客户端。

### 4.3 候选方案对比

| 方案 | 主流客户端可连 | 能否看到运行中状态 | 权限隔离 | 额外成本 |
|---|---|---|---|---|
| **A. 内置 Streamable HTTP**（绑 127.0.0.1） | ✅ 全部 | ✅ | ❌ 与应用同权限 | 无（复用 `lan_share`） |
| B. 打包 headless sidecar 走 stdio | ✅ 全部 | ❌ 看到的是快照 | ✅ 独立进程 | 多一个二进制 + 跨进程协议 |
| C. 本地 socket | ❌ **无** | ✅ | ✅ | — |

### 4.4 推荐：A 为主，B 作为可选补充

**选 A（内置 Streamable HTTP）**，理由：

1. **唯一能被所有主流客户端直接连上的实时方案**（C 已被 DRAFT 证伪）
2. **零新增基础设施**——`lan_share/server.rs` 已经是一份可直接复制的模板
3. 与人类操作走同一条 command 路径，语义一致

**A 的固有代价，必须明说：应用退出，工具全部失败。**

这是真实体验问题，不是技术问题。缓解手段：

- 工具报错文案明确写「Alpha File Manager 未运行，请启动后重试」，而不是笼统的 connection refused
- 提供「Alpha 退出时保持 MCP 服务」的托盘常驻选项
- **B 方案（sidecar）存在的唯一理由就是这个**。如果实测中「Claude 干活到一半用户关了 Alpha」成为高频投诉，再补 B

**建议：本轮只做 A，把 B 记为 Phase 3 可选项。** 理由是 B 要多维护一个二进制 + 一套跨进程协议 + 一份兼容性测试，收益却只覆盖一个边缘场景。先用 A 拿到真实使用数据再决定。

### 4.5 关于 Embedded 的已知风险

社区架构权衡给出的对照：

| 架构 | 延迟 | 权限 | 耦合 | 运维复杂度 |
|---|---|---|---|---|
| Embedded（同进程） | 0ms | **共享** | 紧 | 低 |
| Sidecar | 50–200ms | 隔离 | 松 | 中 |
| Remote | 500ms+ | 隔离 | 解耦 | 高 |

Embedded 的两个风险要正视：

1. **tool crash = 宿主 crash**。缓解：每个工具调用的 Rust 侧用 `catch_unwind` 兜住，超时设上限。
2. **权限全有或全无**。缓解：§5 的分级授权 + 每次调用重查，而不是连接时查一次。

这两条都不是「不要做 Embedded」的理由——Alpha 单机单用户、工具调用延迟要求极低、根本不需要 Sidecar 的隔离能力。但风险必须在设计里显式回应。

---

## 5. 权限模型

抄 DRAFT 的形状（它踩过坑），但对文件删除再加一道。

### 5.1 形态

应用内一个显式下拉（放在状态栏或设置页）：

| 档位 | 行为 |
|---|---|
| **关闭** | 默认。不监听端口 |
| **只读** | 仅第一档工具 |
| **可写** | 第一档 + 写工具 |
| **每次审批** | 每个写操作弹一次确认 |

### 5.2 四条硬规则（每条都有先例支撑）

1. **每次工具调用都重查模式**，不是连接时查一次。DRAFT 的 `AgentMode::allows_read()` / `allows_write()` 就是每次调用都查。
2. **拒绝时返回结构化错误，不是静默**。DRAFT 的 Manual 模式返回 `{"error":"no read access","current_mode":"manual"}`——agent 知道该去问用户该切什么档。
3. **`tools/list` 不受限**。能力发现不涉及数据泄露，让 agent 能看到「切到 Build 档就能写」，反而能引导用户正确授权。
4. **状态栏常驻「N 个 agent 已连接」**。DRAFT 把它做进了 header（`LiveState.connections`）。

### 5.3 写操作必须与人类同路径

agent 的写操作**必须**走 `file_operations` 既有 command，而不是另写一套。这样自动继承：

- 冲突检测（`file_operations::check_conflicts`）
- 进度回调与批量任务（`copy_move_job` / `delete_job`）
- 人类在界面上能看到 agent 正在做什么

DRAFT 的做法是 agent 写入打上 `Actor::Agent` 标记，与人类操作进同一个 `apply_operations`，「没有单独的『agent 写了』的处理逻辑需要同步」。这个设计值得照搬。

### 5.4 删除单独再上一道锁

删除**不可逆**。即便在「可写」档，`delete_items` 也应：

- 默认走回收站（项目已依赖 `trash = "5.2.6"`）而非硬删除
- 「每次审批」档下强制逐条确认
- 工具描述里写明「此操作会移动到回收站」

---

## 6. 鉴权（Streamable HTTP 的硬要求）

三条，缺一不可：

1. **只绑 `127.0.0.1`**

   ⚠️ 注意**不能照抄 `lan_share/server.rs:68`**——那里是 `SocketAddr::from(([0, 0, 0, 0], http_port))`，绑 `0.0.0.0`。LAN 共享要对外，所以那样是对的；**MCP 端点必须只绑回环**。

2. **随机 token + Origin 校验**

   启动时生成随机 token，写进用户自己的 app-data 目录（**不是共享临时目录**），用户配置 MCP 时作为 header 传入。同时按规范校验 `Origin`，非法返回 403。

3. **不要相信「loopback-only 就是安全」**

   DRAFT 在安全评审里发现过这个问题：

   > 「loopback-only」描述的是 TCP 套接字的绑定地址，**不是** Unix socket 文件或命名管道的 ACL——后者的默认值比「仅本用户」**更宽松**（共享临时目录里的 socket 文件继承 umask，通常组内/全局可读；**未加固的 Windows 命名管道的默认 DACL 按 `CreateNamedPipe` 自己的文档是给 Everyone 组读权限**）。

   放到 Alpha 身上对应的是：**本机任何进程都能连 127.0.0.1 的端口**。token 是唯一屏障，不能省。

---

## 7. 建议的工具集

分三档。**默认只开第一档。**

### 第一档：只读（默认可用）

| 工具 | 复用的 command | 说明 |
|---|---|---|
| `list_directory` | `dir_reader::read_dir` | 列目录 |
| `get_drives` | `dir_reader::get_system_drives` | 盘符 |
| `get_mountable_devices` | `dir_reader::get_mountable_devices` | 可挂载设备 |
| `search_files` | `global_search::*` | **核心差异化**，含索引 + 容错 + 排除规则 |
| `get_directory_size` | `dir_size::get_dir_size` | 目录大小（带缓存） |
| `get_favorites` | 收藏 store | 收藏分类 |

### 第二档：写（需显式授权）

| 工具 | 复用的 command |
|---|---|
| `copy_items` | `file_operations::copy_items` |
| `move_items` | `file_operations::move_items` |
| `create_item` | `file_operations::create_item` |
| `rename_item` | `file_operations::rename_item` |
| `delete_items` | `file_operations::delete_items`（走回收站 + 二次锁） |
| `batch_rename` | `batch_rename::*` |

### 第三档：会话状态（Alpha 独有）

这一档通用 MCP **完全没有**，是「agent 与 GUI 同会话」的具体体现：

| 工具 | 说明 |
|---|---|
| `get_current_location` | agent 知道人在哪个目录 |
| `get_selection` | 人在选什么（对应 DRAFT 的 `get_selection`） |
| `open_in_alpha` | 把结果推回界面给人看——**这条是整个功能的人机协作闭环**，没有它 agent 就是个盲写工具 |

`open_in_alpha` 值得单独强调：它把「AI 干了活」变成「AI 干了活**并且人看到了**」。这是这类功能能不能被日常使用的分水岭。

### 刻意不做的

- 不暴露 `terminal`（3 个 command）——让 agent 有 shell 能力，等于绕过全部权限设计
- 不暴露 `default_file_manager::set_default_file_manager`——改系统默认关联程序不该由 agent 决定
- 不暴露 `app_updater::*`——同上

---

## 8. 工作量评估

假设：1 人日 = 8 小时净开发时间，不含真机验收与返工。

### Phase 0：可行性 spike —— **1–2 人日**

目的不是交付，是**证伪**。必须验证四件事：

1. `rmcp` 3.0.1（stateless、无 `initialize`）能否与 `axum 0.8` 共存
2. MSRV 1.88 确实够用
3. 绑 `127.0.0.1` + token + Origin 校验的端点能被 **MCP Inspector 与 Claude Desktop 真实连上**
4. 一个真实 `tools/call` 走通 `dir_reader::read_dir`

**交付标准**：Inspector 与 Claude Desktop 各连上一次并成功调一个工具。做不到就地停，不要往下走。

### Phase 1：只读可用 —— **4–6 人日**

- 第一档 6 个工具
- 权限下拉 UI + 状态栏连接指示器
- 鉴权（token 生成/存储/展示/复制配置片段）
- 17 个语言包文案
- Rust 单测（工具 schema、权限门控、Origin 校验、路径校验）
- 前端单测
- 真机验收（**必须用 `tauri build` 产物**，dev 构建的界面结论一律作废）

### Phase 2：写入 —— **5–8 人日**

- 第二档 + 第三档工具
- 冲突检测对接、agent 操作的进度反馈
- `delete_items` 的回收站 + 二次锁
- 撤销路径
- **这一档风险最高**：agent 误删文件不可逆，验收要用破坏性夹具，且夹具**不得建在 `%TEMP%` 下**（`builtin_ignored_paths()` 会剪掉整棵子树）

### Phase 3：打磨 —— **3–5 人日**（可选）

- stdio sidecar 二进制（应对「应用退出即失效」）
- 审计日志、调用配额、超时与熔断
- `catch_unwind` 兜底，防止 tool panic 拖垮宿主

### 总计

| 范围 | 人日 |
|---|---|
| Phase 0 + 1（**推荐起点**） | **5–8** |
| Phase 0 + 1 + 2（完整可用） | **10–14** |
| 全部 | **13–21** |

**建议从 Phase 0 开始，交付后重新评估 Phase 2 是否值得。** Phase 0 的产出（能不能连上）直接决定后面全部工作是否有意义。

---

## 9. 主要风险

| 风险 | 影响 | 缓解 |
|---|---|---|
| **应用退出即服务失效** | 高频体验受损 | 明确报错文案 + 托盘常驻选项；Phase 3 补 sidecar |
| **agent 误删文件** | 不可逆 | 回收站 + 二次锁 + 默认只读档 + 强制夹具验收 |
| **本机任意进程可连 MCP 端口** | 越权 | 绑 127.0.0.1（**不照抄 `lan_share` 的 `0.0.0.0`**）+ 随机 token + Origin 校验 |
| **tool panic 拖垮宿主** | 应用崩溃 | 每调用 `catch_unwind` + 超时上限 |
| **`rmcp` MSRV 零余量** | 未来升级被卡 | spike 锁版本 + CI 加 MSRV 检查 |
| **规范演进** | 需跟进 | 2026-07-28 已弃用 Dynamic Client Registration、SSE；跟随 AAIF 而非单一厂商 |
| **tool poisoning** | 供应链风险 | Alpha 是自家 server，风险主要是 agent 侧；工具描述写清楚边界 |

---

## 10. 需要与需求方对齐的一点

用户原始表述是「作为扩展，可选装」。取证后的结论是：

- ✅ **「可选开启」** 可以实现——默认关闭，用户在设置里打开
- ❌ **「扩展市场里的一个包」** 实现不了——扩展权限模型只管出站 HTTP，没有入站监听能力（`manifest_permissions.rs:28-82`）

建议按「**应用内置的可选功能**」来设计和排期。如果确实需要做成可分发的独立包，那就不是复用现有扩展系统，而是**新增一整套扩展能力**（入站服务权限 + 生命周期管理 + 二进制分发），那是另一个量级的工程。

---

## 11. 复核：豆包分析的对照（2026-10-16 追加）

用户提供了豆包对本课题的分析（`https://www.doubao.com/thread/xX0zedAirlZXo3jCN`）。逐条核对如下。

### 11.1 它说对且我要采纳的（3 条）

**① 「Windows 11 原生文件管理器也在做 MCP」——属实，且远比它说的更彻底。**

这条改变了战略判断，必须写进报告。已核实（Windows 11 Insider Build **26220.7344** / KB5070316，Dev + Beta 频道；Microsoft Learn《Model Context Protocol (MCP) on Windows》）：

- **Windows ODR**（On-device Agent Registry）——一个安全、可管控的接口，用于发现和使用**来自本地应用和远程服务器**的 MCP connector
- **内置 File Explorer MCP connector**，暴露 `read_text_file`、`create_text_file`、`edit_text_file`、`search_files`、`get_file_details`、`zip_folder`
- **内置 Settings connector**（Copilot+ 机型）
- **Agent Session / containment**——MCP server 在**独立的、专用的 agent 用户账户**下于隔离会话中执行
- **`odr.exe`** 命令行工具，用于 list / add / remove / test MCP server
- **`_meta` 段**——server manifest 里可放 `initialize` 与 `tools/list` 的 `static_responses`，让 host **不用启动 server 二进制**就能拿到工具定义
- 已支持的 host：VS / VS Code 的 GitHub Copilot agent mode、Microsoft Agent Framework

⚠️ 微软文档自己标注了「**这是预发布产品，商业发布前可能大幅变化**」，且当前只在 Dev/Beta 频道。**不能把 ODR 当成稳定依赖。**

**这条对我们的意义（双向）**

- 利好：品类被验证，不再需要论证「有没有人用」
- **更重要的利好**：微软内置的工具集是**基础档**——`read_text_file` / `search_files` / `zip_folder` 这种。真正好用的**语义自然语言搜索被锁在 Copilot+ 硬件后面**。而 Alpha 规划中的能力（tantivy 索引 + 拼写容错 + 9 层递归、批量重命名、目录大小、收藏体系、会话状态、`open_in_alpha`）**实质性地超过微软自己交付的档位**。§1 的差异化论证从「我方视角」升级为「与官方实现可对照」。

**② 「操作日志查看」应该进基线，不该放 Phase 3。**

它把操作日志列在「体验无缝化」的基线建议里，我原本放在 Phase 3 可选项。**它说得对，我采纳。** 理由：这是信任设施，不是增强功能。用户让 AI 碰自己的文件，「它到底改了什么」必须随时可查。调整见 §11.3。

**③ 重复文件检测是 Alpha 的真实空白。**

已核对 `src/localization/messages/ch.json`：所有 `duplicate` 命中都是「重复标签页」「重名」，**没有重复文件检测功能**。这确实是差异化能力，但它是**独立的新功能**（要对整棵树做哈希），**不属于 MCP 范畴**，不在本轮工作量内。登记备查。

### 11.2 它说错或明显偏弱的（5 条）

**① 致命遗漏：全文没有提传输层。**

豆包通篇假设「在文件管理器里实现 MCP 服务」这个形态存在，完全没提 MCP 的两种传输（`stdio` / `Streamable HTTP`）、没提 **SSE 传输已在 2026-07-28 移除**、更没提 **GUI 应用不能被 stdio client 当子进程拉起**这个结构性约束。

这不是遗漏细节，是**整个方案缺了最关键的决策环节**。§4 就是干这个的，而且 §4.1 用 DRAFT 的先例证明了这个约束是真实存在的。

**② 最严重的一处错误：把要做的工程量当成了协议自带能力。**

原文：

> MCP 协议本身定义了**完善的**能力协商、**权限边界**、**操作审计**机制……可以实现：**沙箱隔离**、权限区分、操作审计

**这是错的。** MCP 规范里没有「每次调用重查授权」，没有沙箱隔离，没有操作审计。

最有力的反证就是微软自己：为了拿到豆包描述的这套「隔离与审计」，Windows **专门构建了一整套子系统**——Agent Session（专用 agent 用户账户）、`mcp-containment` 策略、Intune 管控、系统日志审计。**如果这是协议自带的，微软不需要造。**

这条错误的代价是实打实的：它会让工作量评估少算一大块（权限模型 + 鉴权 + 审计日志 ≈ §5 + §6 + Phase 1 的一部分）。

**③ 「安全与合规价值：标准化的权限管控体系，比自建接口更规范安全」——循环论证。**

MCP 不提供目录白名单，白名单是你自己写的。把「我要自己写的代码」算作「价值」，是把成本记成了收益。而且方向也未必对：通用 filesystem server 恰恰是 tool poisoning 的重灾区，公共 server 超过 10,000 个质量差异极大。

**④ 场景清单有大量臆想成分，会严重误导工作量。**

「提取 MP4 第 5 秒画面作为封面」「Markdown 转带目录 PDF 加公司页眉」「识别文件类型自动分类归档」——这些需要 `ffmpeg` / `pandoc` / MIME 识别等外部依赖，**Alpha 一项都没有**。照着做清单会严重高估可行性。

另外它的「高风险操作」把**移动**也算进去、要逐个确认。这在实践上不可用——AI 整理文件的核心价值就是批量移动，逐条确认会让整个功能失去意义。我 §5 的四档（关闭 / 只读 / 可写 / 每次审批）更贴合实际。

**⑤ 「跳出同质化竞争」这个定位对 Alpha 不适用。**

它的前提是「Files、Total Commander 功能高度同质化」。Alpha 已经有收藏分类、批量重命名、全局搜索等差异化能力，也不是单纯的 Windows 模仿品。这个论证前提跟我们的实际情况对不上。

顺带：它**全文没有一个工作量数字**。

### 11.3 因此对报告做的三处修订

| 位置 | 原内容 | 修订后 | 理由 |
|---|---|---|---|
| §5 / §8 Phase 1 | 审计日志放 Phase 3 可选 | **移入 Phase 1 基线** | 采纳豆包意见 ②。这是信任设施 |
| §1.1 | 「通用 filesystem MCP 没有索引」 | **增加与微软 File Explorer connector 的逐项对照** | 差异化论证从主观变客观 |
| §9 / Phase 3 | 无 ODR 相关内容 | **新增 ODR 作为 Phase 4 可选机会**（并标注预发布风险） | 豆包信息 ① 的战略含义 |

工作量总区间**不变**（审计日志从 Phase 3 挪到 Phase 1 是重排不是增量，§1 的对照是文档工作）。

### 11.4 新增：Phase 4 可选机会 —— 接入 Windows ODR

**这是豆包那条消息带来的真正增量。** 如果 Alpha 把自己的 MCP server 注册进 Windows ODR，可以获得：

- Windows 原生的**发现能力**——用户不必手动编辑 `claude_desktop_config.json`
- Windows 原生的**容器隔离与审计**——省掉 §5 / §6 的相当一部分
- 进入 Copilot / VS Code agent mode 的**默认可见范围**

**但不改变主推荐。** 理由：

1. ODR 是**预发布**，只存在于 Dev/Beta 频道，微软自己声明商业发布前可能大幅变化
2. ODR 的模型是「由 ODR 启动被容器化的 server」，更接近进程拉起而非常驻 HTTP 服务，**与主流第三方 MCP client（Claude Desktop / Cursor / Zed）不互通**
3. 它是 **Windows-only**，而 Alpha 是跨平台应用

**定位：作为 §4 主方案（A：内置 Streamable HTTP）的补充渠道，在微软把 ODR 转正之后再评估。** 不进 Phase 0–3 的关键路径。

### 11.5 结论

豆包的方向判断（**该做、生态兼容是最大价值、默认只读 + 目录白名单**）与本报告一致，可以互相印证。但它的**技术论证层面不可用**——漏掉了决定性的传输层选型，并把权限模型误记为协议自带。

**本报告的结论不变，且因微软官方实现而加强。** 工作量区间不变。

---

## 附录：关键证据索引

### Alpha 仓库内

| 事实 | 位置 |
|---|---|
| 145 个已注册 command | `src-tauri/src/lib.rs:290-438` |
| axum / axum-server / tokio / rcgen / mdns 依赖 | `src-tauri/Cargo.toml:66-74` |
| rust-version 1.88.0 | `src-tauri/Cargo.toml:9` |
| 现成的 HTTP 服务实现（端口/TLS/关闭/mDNS） | `src-tauri/src/lan_share/server.rs:53-124` |
| ⚠️ 现有服务绑 `0.0.0.0`（MCP 不可照抄） | `src-tauri/src/lan_share/server.rs:68` |
| 扩展 http 权限 = 出站白名单 | `src-tauri/src/extensions/manifest_permissions.rs:28-82` |
| host 模式校验（scheme 必须 http/https） | `src-tauri/src/extensions/security.rs:145-147` |
| 扩展 = manifest + 本地二进制 + 子进程 | `src-tauri/src/extensions/types.rs:10, 26-30` |
| 全局搜索实现 | `src-tauri/src/global_search/query.rs`、`commands.rs` |
| 搜索忽略规则 | `src-tauri/src/global_search/ignore.rs` |

### 外部来源

| 事实 | 来源 |
|---|---|
| 规范版本 2026-07-28、stdio + Streamable HTTP、SSE 移除、stateless、Origin 校验、AAIF 治理 | MCP 官方规范（modelcontextprotocol） |
| `rmcp` 3.0.x、MSRV 1.88 | crates.io |
| Tauri 桌面应用做 MCP 的完整先例、stdio 不适用的论证、本地 socket 无主流客户端可连、AgentMode 权限模型 | `https://github.com/p4inz-code/Draft/blob/main/docs/mcp.md` |
| Claude Desktop / Claude Code 配置路径与形态、stdio vs HTTP 决策原则 | `https://www.claudemap.org/zh/guides/mcp-servers-configuration` |
| Embedded / Sidecar / Remote 权衡矩阵 | theneurbase.com MCP in IDP 指南 |
| Windows 11 原生 MCP：ODR、File Explorer connector、Agent Session、containment、`odr.exe`、`_meta` | Microsoft Learn《Model Context Protocol (MCP) on Windows》 |
| Windows 11 Build 26220.7344 (KB5070316) 引入 MCP，Dev/Beta 频道 | winaero.com 发布说明 |
| 微软 File Explorer connector 的工具集与 Copilot+ 语义搜索门槛 | 同上 Microsoft Learn 文档 |
