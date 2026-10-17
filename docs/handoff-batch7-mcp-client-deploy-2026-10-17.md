# 批次 7：MCP 客户端一键部署 + 3.2.1-beta 发版 —— 实施结果与交接

- 日期：2026-10-17
- 基线：`fe7fb5f7`（3.2.1-beta 版本号 + Phase 1 只读工具集）→ 本批起点同为该提交
- 上一份交接：`docs/handoff-batch6-mcp-phase0-implemented-2026-10-16.md`
- 调研报告：`docs/mcp-feasibility-report-2026-10-16.md`
- 自动发现调研：`docs/mcp-client-auto-discovery-answer.md`
- 真机验收手册：`docs/acceptance-mcp-3.2.1-beta.md`

---

## 0. 一句话结论

用户在设置页找不到「把 MCP 装进各家 AI 助手」的入口，本批补上了这条链路：
设置页现在**列出本机能识别到的 6 个助手、显示每个的配置文件实际路径、一键写入 / 一键移除**。
同时修掉了 MCP 设置项的排版缺陷（三轮，见 §4），并完成 3.2.1-beta 的全量发版。

---

## 1. 这一批交付了什么

### 1.1 内置 MCP 服务端（Phase 1，批次 6 已完成，本批未改动）

6 个只读工具：`list_directory` / `get_drives` / `get_mountable_devices` /
`search_files` / `get_directory_size` / `get_favorites`。
只绑 `127.0.0.1`，随机 token，Origin 非法返回 403，权限四档每次调用重查。
**写工具（Phase 2）仍未启动，代码里没有实现。**

### 1.2 AI 客户端一键部署（本批新增）

新增 `src-tauri/src/mcp/clients.rs`（约 23 KB，19 个单测）。

| 客户端 | `id()` | 配置路径 |
|---|---|---|
| Codex | `codex` | `~/.codex/config.toml`（读 `CODEX_HOME` 覆盖） |
| Cursor | `cursor` | `~/.cursor/mcp.json` |
| Claude Code | `claudeCode` | `~/.claude.json` |
| Claude Desktop | `claudeDesktop` | `%APPDATA%\Claude\claude_desktop_config.json`（macOS 退回 `~/Library/Application Support/Claude/`） |
| OpenClaw | `openclaw` | `~/.openclaw/config.json` |
| Minimax Code | `minimaxCode` | 按 `MINIMAX_DATA_DIR` → `MINIMAX_HOME` → `~/.minimax/.minimax/mcp.json` → `~/.minimax/mcp.json` 依次探测，取第一个**已存在**的 |

新增 3 个 Tauri command（`src-tauri/src/mcp/commands.rs`，已注册进 `lib.rs`）：

- `mcp_list_clients` —— 返回 6 个客户端的「是否检测到 / 配置路径」
- `mcp_install_client` —— 写入条目
- `mcp_uninstall_client` —— 移除条目

前端：`src/stores/runtime/mcp.ts` 加 `McpClientId` / `McpClientState` / `McpDeployOutcome`
类型与 `clients` / `deployingClient` 状态、`refreshClients` / `installClient` / `uninstallClient`；
`mcp-server.vue` 加部署区（6 行客户端、状态徽标、实际配置路径、部署 / 移除按钮、重新检测按钮）。

### 1.3 i18n

17 个语言包新增 `deploy*` 14 键 + `deployClients` 对象（6 项）+ 重启提示 5 键。
`ch` / `en` 完整正文，其余 15 语种落英文（沿用批次 5 惯例：缺条目比落英文更糟）。

---

## 2. 关键设计决策

### 2.1 写入守三条硬规矩

改的是**用户自己的配置文件**，所以 `clients.rs` 只允许做「增删一个条目」，不允许整个文件重写：

1. **只合并不重写。** JSON 走「解析 → 改一个键 → 序列化」；TOML 在**文本层面**摘出
   `[mcp_servers.<name>]` 表块再追加 —— 刻意不引入 TOML 解析器，因为解析器会把用户写在
   `config.toml` 里的**注释和排版洗掉**。19 个单测里有一条专门锁死「保留后一张表」。
2. **解析失败拒绝写。** 报错并保持原文件不动，而不是替换成一份看起来对、其实不是的内容。
3. **写前必备份。** 每次都存一份 `<原路径>.alpha-mcp.bak`。

### 2.2 Codex 用 `http_headers` 而不是 `bearer_token_env_var`

MCP 规范的 Codex 配置允许 `bearer_token_env_var = "..."`，但它要求**环境里存在**对应变量，
而本应用没法给用户的 shell 设环境变量。因此改用
`http_headers = { Authorization = "Bearer ..." }`。
**已加单测锁死**，防止后续被「改回更规范的形式」。

### 2.3 `is_detected` 收紧为「目录在且里面至少有一个文件」

原判据只看目录是否存在，导致 Claude Desktop 卸载后残留的空目录 `%APPDATA%\Claude\`
被误报成「已安装」。

### 2.4 客户端显示名键用 `deployClients` 而不是 `clients`

`settings.experimental.mcp.clients` 早已被「已连接客户端」这个**标签**占用（17 个文件里
都是字符串）。同一个键不能既是字符串又是对象，故另起 `deployClients`。既有文案一字未动。

---

## 3. 门禁（与基线逐字对照）

| 项 | 结果 |
|---|---|
| `cargo test --lib` | **386 passed / 0 failed**（基线 367，+19） |
| `npx vue-tsc --build` | **0 error** |
| `npx eslint src` | **179 errors / 59 warnings**（逐字相同） |
| `npx vitest run` | **183 文件 / 1434 用例**（基线 1427，+7） |
| `node scripts/verify-changelog.mjs` | 退出码 0 |

> 13 个非中英文语言包的 changelog 停在 3.1.3 —— `use-changelog.ts` 会回退英文条目，
> 属既有状态，非本批引入。

---

## 4. 设置页排版：三轮才找对层

用户连续三次反馈「宽屏时标题还是顶在左边」。**前两轮都改错了地方**，记录下来避免重蹈。

`SettingsItem`（`src/modules/settings/ui/item.vue`）结构：

```
.settings-view-item__main      flex-flow: row nowrap; align-items: center; justify-content: space-between
├── __header                   图标 + 标题 + 描述
└── __content                  slot
```

1. **第一轮**：把 description 从 prop 挪到 content 顶部 + `:deep()` 给 `__content` 加 `flex: 1`
   → 用户反馈仍挤在左侧。
2. **第二轮**：改 `:deep(.settings-view-item__header) { align-items: flex-start }`
   → **无效**。改错了层：真正决定垂直对齐的是 `__main` 的 `align-items`，不是 `__header`。
   改对 `__main` 后窄屏正常、宽屏仍错。
3. **第三轮（根因）**：`item.vue` 里有

   ```css
   @container (max-width: 500px) {
     .settings-view-item__main { flex-direction: column; align-items: stretch; }
   }
   ```

   **竖排只是窄屏降级方案，不是默认行为** —— 窗口一宽就失效。之前两轮都在跟这个
   容器查询较劲。最终显式钉死：

   ```css
   .mcp-server :deep(.settings-view-item__main) {
     flex-direction: column;
     align-items: stretch;
     gap: 0.75rem;
   }
   .mcp-server :deep(.settings-view-item__content) { flex: 1; min-width: 0; }
   ```

**必须限定作用域**：`item.vue` 被另外 45 个设置项共用。已核实全仓只有 `item.vue` 自己和
MCP 这一处覆盖 `__main`；「设为默认文件管理器」等设置项仍保持标题在左、开关在右。

---

## 5. 本批踩的坑

### 5.1 i18n 键名冲突：字符串占位 vs 对象

子任务脚本准备写 `settings.experimental.mcp.clients.<id>.name` 时才发现 `clients`
已被占用。**这类冲突不会报错** —— 写进去会把「已连接客户端」标签变成对象，
运行时才炸。改键前先 `grep` 该键在 17 个文件里的**实际类型**。

### 5.2 「重启助手才生效」用 3 秒 toast 提示 = 用户看不到

第一版部署成功后弹 3 秒 toast，实测用户反馈「配了但没反应」。配置写完需要**重启目标
助手**才生效，这条提示必须**常驻**，因此改成横幅：可手动关闭，且列出**改了哪个文件**与
**备份在哪**。

### 5.3 打包交付了 5 次才定稿

前 4 次分别是：初版 → 与 `fe7fb5f7` 对齐 → 含一键部署 → 含横幅与空目录检测。
第 5 次（SHA256 `45A743B4…`）是用户验收通过的那一份。
**每换一个功能点就要重打一次包**，因为验收必须用 `tauri build` 产物（`tauri dev`
的路由页内容区是空白，结论一律作废）。

---

## 6. 发版：3.2.1-beta 已上线

**产物**

| 项 | 值 |
|---|---|
| 安装包 | `Alpha_File_Manager_3.2.1-beta_x64-setup.exe` |
| 大小 | `19158990` 字节 |
| SHA-256 | `45A743B46A882F9FBFB9093E632CE47A7D1EBD867544E227C26FED383182F142` |
| 站点 | https://www.aiec.fun/alpha-file-manager |
| GitHub | https://github.com/kizemo/alpha-file-manager/releases/tag/v3.2.1-beta |

**流水线四步全部执行完毕**

| 命令 | 结果 |
|---|---|
| `prepare --bump none --skip-build --notes-file _notes.md` | 站点 3.1.3 已归档进 `history[]`（7 → 8 条）；`version.json` 同步为 3.2.1-beta；安装包复制到站点源目录且 sha256 一致 |
| `prepare --write-notes _notes.md` | 生成 `E:\办公文件\L1网站\alpha-file-manager\_release-notes-v3.2.1-beta.md`（正文 + 构建信息段） |
| `upload` | SFTP 上传 15 个文件 / 190.83 MB；**回读 15 个文件 md5+size 逐项一致** |
| `github` | 创建 `v3.2.1-beta` release，正文 1641 字符含构建信息 |
| `verify` | 版本号 / 大小 / sha256 三项一致；边缘节点 `CF-Cache-Status=HIT Age=251s`，确认已生效 |

### 6.1 发版时发现并修掉的一个真问题：beta 没被标成预发布

`gh release create` 默认 `isPrerelease = false`。版本号明明是 `3.2.1-beta`，
GitHub 却把它当成**正式版**放在所有人的下载入口顶部 —— 点进去的人拿到的是测试版，
真正的正式版反而被压在下面。

已做两件事：

1. 本次 release 用 `gh release edit --prerelease` 补标，复查 `isPrerelease = true`。
2. **修进脚本**：`github` 子命令现在按 `/^\d+\.\d+\.\d+-/` 判断版本号是否带预发布后缀，
   创建时加 `--prerelease`，更新时加 `--prerelease=true --latest=false`。
   正式版路径**行为不变**（不引入新行为，只修预发布这一条）。

已跑一次 else 分支实测（release 已存在的更新路径）：重跑后 `isPrerelease` 仍为 true、
正文仍 1641 字符、资产 digest 未变 —— **幂等**。

> `latestInstaller()` 是**按 mtime 降序**在 `release/` 里取最新的 `.exe`。
> 所以每次发版**必须先把新包复制进 `release/`**，否则 `prepare` 会拿旧包去发。
> `release/` 是 git-ignored，装配包不进仓库。

---

## 7. 未完成 / 未验证

| 项 | 状态 |
|---|---|
| **Codex 配置格式未真机验证** | 本机没装 Codex CLI。`[mcp_servers.alpha-file-manager]` + `http_headers` 的写法是按多份资料交叉确认的，**没有真实客户端读过**。装有 Codex 的机器上首次部署后请核对一次。 |
| **Claude Desktop 本体未安装** | `%APPDATA%\Claude\` 只是残留目录。用户 2026-10-17 决定不补装第二个客户端，记为已知缺口。 |
| **OpenClaw 本机未安装** | 代码路径就绪，未在真实客户端上验证过。 |
| **README.zh-CN.md 仍缺 3.1.1 / 3.1.2 / 3.1.3 三节** | 中文 README 最新章节此前停在 3.1.0，属既有欠账。本批只补了当前版本。 |
| **13 个非中英文语言包的 changelog 停在 3.1.3** | `use-changelog.ts` 回退英文，既有状态。 |
| **Phase 2 写工具** | 未启动。权限档位里的「可写」是预留值，选了也不会有写操作发生。 |
| **`clients` / `tools` 不是薄封装** | 批次 6 结转的技术债，见批次 6 handoff §2.2。 |

---

## 8. 下阶段计划（建议顺序）

1. **补 README.zh-CN.md 的 3.1.1 / 3.1.2 / 3.1.3 三节**，让中英文版本脉络对齐。
2. **在装有 Codex / Cursor 的机器上验证一键部署产物**，把 §7 第一项转成已验证。
3. **补 13 个非中英文语言包的 changelog**（或明确接受回退英文的现状）。
4. **Phase 2 决策**：是否开始写工具。开始前先想清楚「每次审批」档位的确认框
   要长什么样 —— 那是安全模型的一部分，不是 UI。
5. 3.2.1 正式版：beta 转正前建议先跑满一个使用周期。

---

## 9. 关键路径

```
仓库根      F:\soft\00selfmade\filemanager\sigma-file-manager
外层 AGENTS.md  F:\soft\00selfmade\filemanager\AGENTS.md   ← 不在本仓库内

MCP 模块     src-tauri/src/mcp/
             ├─ mod.rs  permission.rs  auth.rs  audit.rs
             ├─ tools.rs  server.rs  commands.rs  spike.rs
             └─ clients.rs   ← 本批新增
前端         src/stores/runtime/mcp.ts
             src/modules/settings/ui/categories/experimental/mcp-server.vue
i18n         src/localization/messages/*.json   （17 个）

发版脚本     scripts/release-publish.mjs   （prepare / upload / github / verify / status）
             scripts/verify-changelog.mjs
站点源       E:\办公文件\L1网站\alpha-file-manager\      （非 git 仓库）
站点地址     https://www.aiec.fun/alpha-file-manager
SFTP python  E:\办公文件\L1网站\.venv-sftp\Scripts\python.exe

运行时       token 与档位  %APPDATA%\com.sigma-file-manager.app\mcp-access.json
             审计日志      %APPDATA%\com.sigma-file-manager.app\mcp-audit.jsonl
             本机端点      http://127.0.0.1:55100/mcp

打包         .superpowers/sdd/build-fb4.cmd
Rust 工具链  C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin
MSVC         C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvars64.bat
```

---

## 10. 一次性脚本目录（git-ignored）

`.superpowers/sdd/` 下本批新增：

| 脚本 | 作用 |
|---|---|
| `add-mcp-deploy-i18n.cjs` | 写 17 语种部署文案（`CLIENTS_MODE` 开关已切到 `'rename'`） |
| `add-mcp-restart-i18n.cjs` | 写重启提示文案 |
| `bump-321-beta.cjs` | 版本号四处同步（幂等） |
| `msrv-scan.cjs` | MSRV 扫描。**必须** `cargo metadata` 输出到**文件**再喂给它 —— PowerShell 管道会塞 BOM 导致解析失败 |
| `mcp-e2e.cjs` / `mcp-probe2.cjs` / `mcp-probe3.cjs` | MCP 端到端探针 |
| `append-agents-md.cjs` | 外层 AGENTS.md 追加 Wry / rmcp 两条硬约束 |

---

## 11. 必须记住的硬约束（外层 AGENTS.md 已有，此处再强调）

1. **`src-tauri/src/mcp/` 内被测试链接的代码不得出现 `tauri::AppHandle` 或
   `tauri::async_runtime::*`。** 碰了会让 `<Wry as Runtime>` 单态化，把 tao 拖进来，
   tao 里的 `comctl32.dll!TaskDialogIndirect` 属于 comctl32 v6，只有带 application
   manifest 的二进制才解析得到 → **测试二进制在加载期就以 `0xC0000139` 崩掉**，
   一个测试都跑不了，且报错里完全看不出跟你的模块有关。
   绕法：给业务模块加 `*_blocking` 同步内核入口（见 `dir_reader.rs` / `global_search.rs`），
   由调用方选执行器。
2. **`#[tool_router]` 必须配 `impl ServerHandler` 上的 `#[tool_handler]`。**
   只写 `#[tool_router] impl X {…}` 加自写的 `impl ServerHandler for X { fn get_info }`，
   编译通过、单测通过，但**只有 `tools/list` 返回 `{"tools":[]}`**，一个工具都调不到。
   rustc 对 `tool_router` 字段报的 `never read` 警告在这里**不是误报**，是线索。
3. **真机验收只能用 `tauri build` 产物**，不能用 `tauri dev`。
4. **绝不用 PowerShell 的 `Get-Content -Raw` / `Set-Content` 改含中文的文件**，
   批量改文件一律 node `fs` + `'utf8'`。提交信息文件也用 node 写 ——
   `Out-File -Encoding utf8` 会塞 BOM，表现为 `git log` 里提交信息前多一个不可见字符。
