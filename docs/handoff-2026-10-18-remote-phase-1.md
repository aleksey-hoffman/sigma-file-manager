# 接力文档：Alpha File Manager FTP/SFTP 远程空间 · 阶段 1

> 这份文档给**新开的会话**用。请先完整读完再动手，不要凭标题猜。
> 配套的一句 prompt 见本文末尾「接力 prompt」。

**仓库**：`F:\soft\00selfmade\filemanager\sigma-file-manager`
**当前分支**：`feat/remote-phase-1-connections-transport`
**文档日期**：2026-10-18

---

## 1. 必读文档（按顺序，全部是相对仓库根的完整路径）

| # | 路径 | 为什么必读 |
|---|---|---|
| 1 | `F:\soft\00selfmade\filemanager\AGENTS.md` | **仓库外层**硬约束，优先级最高。含真机验收的一堆坑（`tauri dev` 路由页空白、打包产物才对、ESLint 口径、PowerShell 陷阱、DPAPI/tao 红线等） |
| 2 | `sigma-file-manager\docs\superpowers\specs\2026-10-17-ftp-sftp-remote-space-design.md` | 整个功能的设计规格（13 章 + §8A 分支策略 + §12 变更记录）。阶段划分、破坏性操作安全设计、代理架构全在里面 |
| 3 | `sigma-file-manager\docs\superpowers\plans\2026-10-18-remote-phase-1-connections-transport.md` | **阶段 1 的执行计划**，8 个 Task，本文档的上游 |
| 4 | `sigma-file-manager\docs\superpowers\plans\2026-10-17-remote-phase-0-vfs-skeleton.md` | 阶段 0 计划 + 「实际结果」一节（记录了 5 处预测错误与 2 个被测试抓到的真 bug） |
| 5 | `sigma-file-manager\docs\ftp-sftp-oss-landscape-2026-10-17.md` | 803 行开源选型调研报告（`suppaftp` / `russh` / `fast-socks5` / `remotefs` / `rclone` 的许可证与能力核实） |

---

## 2. 项目目标（一句话）

给 Alpha File Manager 加 FTP / FTPS / SFTP 远程空间，路径形如 `sfm://remote/<连接id>/<远端路径>`，
**内嵌进主线**（不是扩展系统 —— 扩展 API 没有 VFS 挂载点，走扩展并不能避开核心改动）。
首版覆盖浏览、传输、远程写操作（新建目录/重命名/删除）、跨边界拖拽复制，并支持 SOCKS5 / HTTP CONNECT 代理。

---

## 3. 已完成的进度

### 阶段 0（VFS 骨架）—— **已完成并合入 main**

`main` 的 HEAD = `3810069e docs(plan): 阶段 0 门禁实测结果`，8 个 commit。

交付内容：
- `src-tauri/src/remote/path.rs` —— `sfm://remote/<id>/<path>` 路径族（Rust 侧）
- `src-tauri/src/remote/error.rs` —— `RemoteError` 七分类 + 序列化契约
- `src-tauri/src/remote/provider.rs` —— `RemoteProvider` 异步 trait（`#[async_trait]`）
- `src-tauri/src/remote/fake.rs` —— `FakeRemoteProvider`
- `src/utils/remote-paths.ts` —— 前端镜像，与 Rust 侧逐条对齐
- `src/utils/entry-action-policy.ts` —— 新增 `'remote'` 策略（**排在最前**，否则远程路径会落到 `normal` 策略而完全不受门禁约束）
- `src/utils/virtual-locations.ts` —— `getNavigableParentPath` 远程分支

门禁实测（当时）：`cargo test --lib` 409 · `vitest` 187 文件/1483 · `vue-tsc` 0 · `eslint src` **179** · changelog 0

### 阶段 1 —— **进行中**

计划：`docs/superpowers/plans/2026-10-18-remote-phase-1-connections-transport.md`，8 个 Task。

| Task | 状态 |
|---|---|
| 1 传输层 `transport.rs` | **已完成**（纯函数 + socket 测试，55 条全绿） |
| 2 连接模型 + 第 5 个 storage 文件 | **代码已完成，storage 侧已验证，Rust 侧待全量确认** |
| 3 DPAPI 凭据存储 | 未开始 |
| 4 Tauri command | 未开始 |
| 5 前端 store | 未开始 |
| 6 设置页「远程」分类 | 未开始 |
| 7 17 个语言包 | 未开始 |
| 8 全量门禁 + `tauri build` + 真机验收 | 未开始 |

已提交的阶段 1 commit：`ea487ceb feat(remote): 阶段 1 Task 1 —— 传输层（纯函数部分）`

**未提交的部分**（写这份文档时处于 staged 未 commit 状态）：
Task 1 的 socket 测试、Task 2 的 `connection.rs` 与 5 处 storage 注册。

---

## 4. 接手第一件事：确认门禁

**不要相信这份文档里的任何数字，自己跑一遍。**

```powershell
# 仓库根目录
$ErrorActionPreference = 'Continue'
npx vue-tsc --build          # 预期 0 error
npx eslint src               # 预期 179 errors（口径必须是 eslint src，不是 eslint . 的 186）
node scripts/verify-changelog.mjs   # 预期退出码 0

# Rust（用这个脚本注入 MSVC + Rust 环境）
cmd /c ".superpowers\sdd\cargo-lib.cmd test --offline --lib"
```

### ⚠️ 跑 cargo 长命令的两个坑（都真实踩过）

1. **绝对不要给后台 cargo 任务接 `| Select-String` 之类的管道过滤器。**
   管道会缓冲全部输出直到进程结束，看起来就像 cargo 卡死了。
   实际上 cargo 一直在正常编译。正确做法是**重定向到文件再读文件**：
   ```powershell
   Start-Process cmd -ArgumentList '/c','.superpowers\sdd\cargo-lib.cmd test --offline --lib > .superpowers\sdd\cargo-full.log 2>&1' -WorkingDirectory "<仓库根>" -WindowStyle Hidden
   # 等一会儿后
   Get-Content .superpowers\sdd\cargo-full.log | Select-String "test result:"
   ```
2. **`task_stop` 不会杀掉 cargo 子进程。** 中断任务后要用
   `Get-Process cargo,rustc | Stop-Process -Force` 清干净，否则残留进程持有构建锁。

`.superpowers/sdd/cargo-lib.cmd` 是本阶段新建的辅助脚本（git-ignored），**必须保持纯 ASCII** ——
cmd.exe 按 ANSI 读 `.cmd`，UTF-8 中文注释会变成一串「不是内部或外部命令」的假报错。

---

## 5. 阶段 1 已核实的外部事实（不要重新猜）

`fast-socks5` v1.0.0 的真实签名，已从 `~/.cargo/registry` 源码逐字核对：

| 符号 | 真实签名 |
|---|---|
| `fast_socks5::Socks5Command` | `enum { TCPConnect, TCPBind, UDPAssociate }` —— **在 crate 根**，不是 `fast_socks5::command::` |
| `fast_socks5::AuthenticationMethod` | `enum { None, Password { username: String, password: String } }` —— 变体名是 **`Password`** 不是 `UsernamePassword` |
| `fast_socks5::ReplyError` | RFC 1928 八码 + **两个未公开数值的扩展** `ConnectionTimeout` / `TtlExpired` |
| `fast_socks5::client::Config` | 字段私有；`Default` + `set_connect_timeout(&mut self, Duration)` + `set_skip_auth` |
| `Socks5Stream::<TcpStream>::connect_raw` | `(cmd: Socks5Command, socks_server: T, target_addr: String, target_port: u16, auth: Option<AuthenticationMethod>, config: Config)` —— **BIND 入口** |

许可证 **MIT**；crate 描述写明「maintained by anyip.io」，但 GitHub 仓库是 `dizda/fast-socks5`
（维护方与仓库 owner 不是一回事，别再搞混）。

**`fast-socks5` 的 server 模块不适合当测试夹具**：它的 `Socks5Server` 从 0.11.0 起已 `#[deprecated]`，
替代的 `Socks5ServerProtocol` typestate API 只暴露 `run_tcp_proxy`，**没有 BIND 的服务端路径** ——
而 BIND 恰恰是 FTP 被动模式最需要测的一环。所以 `transport.rs` 里的假 SOCKS5 服务端是自己写的
（仅测试代码，文件头有说明）。**这条是刻意偏离规格 §3.7 的决定，不是遗漏。**

### 5.1 `russh` 0.63 的三个陷阱（阶段 2 用 `russh-sftp` 时同样适用）

全部从 `~/.cargo/registry/src/.../russh-0.63.3/src/` 逐字核对，并已实测坐实：

| 事实 | 出处 | 后果 |
|---|---|---|
| 客户端侧 `read_ssh_id()` 走 `read_ssh_id_inner(**true**)`，允许最多 **20 行** RFC 4253 §4.2 前导行；只有先撞满上限才吐 `Error::Version` | `ssh_read.rs:143`、`ssh_read.rs:10-11`、`ssh_read.rs:199-205` | 真实 FTP 服务发的那一行 `220 …` 被当预导行丢掉，russh 就静静等着 —— **直到 15 秒超时**。曾据此把「SFTP 指到 FTP 端口」误判成 `unreachable` |
| `Error::Version` 的文案是 `"invalid SSH version string"`；`Kex` 是 `"Key exchange failed"` —— Display 里**没有** `identification`、`handshake` 这些词 | `lib_inner.rs:106-112` | `error.to_string().contains("kex"\|"identification"\|"handshake")` 这种写法恒为 false，是**死代码**。要按 `russh::Error` 变体匹配 |
| `mod ssh_read;` 在 `lib_inner.rs` 里是**私有**的，`SshRead` 不导出 | `lib_inner.rs:33` | 没法「用 russh 自己的结构体预读再交回给它」，回放只能自己写（`connection_test.rs` 的 `ReplayStream`） |

`connection_test.rs` 现在的做法：**先自己读一眼**（5 秒上限；字节上限与前导行上限都**对齐 russh 的
`SSH_ID_MAX_LINE_LEN=255` / `SSH_ID_MAX_PRE_BANNER_LINES=20`**），读到的字节由 `ReplayStream` 原样喂回
russh，对真实 SSH 服务完全透明。实测：修前 15.07s 报 `unreachable`，修后 5.08s 报 `wrong_protocol`。
**阶段 2 若要自己判协议，务必复用 `classify_ssh_banner`，不要重写一遍。**

另注：`connect_stream` 是**先写客户端标识串、再读服务端标识串**。所以「预读」发生在发标识串之前，
对「等服务端先开口」的服务（HTTP 之类）会读不到东西 —— 这正是 `read_ssh_banner` 把「一个字节都没收到」
原样放行给 russh 的原因，不要改成「读不到就判协议不符」。

---

## 6. 已核实的仓库现状（不要重新调查）

- **全仓没有 DPAPI 先例。** `mcp-access.json` 是**明文**落盘 + `icacls` 收权限，
  落在 `app_data_dir` 根（`%APPDATA%/com.sigma-file-manager.app/`），**不在** `user-data/` 下。
- 既有敏感数据写入方式：**Rust command 直写文件**，不经 `tauri-plugin-store`。
- 新增 storage 文件要改 **6 处**（不是 5 处，第 6 处是 `src/data/user-paths.ts` 里的
  `CustomPaths` 类型，`vue-tsc` 会报出来）：
  `src-shared/user-storage-files.json`、`src-tauri/src/user_storage_files_config.rs`、
  `src-tauri/src/startup_storage_bootstrap.rs`（3 个点位）、`src/stores/storage/utils/startup-storage-bootstrap.ts`、
  `src/stores/storage/user-paths.ts`、`src/data/user-paths.ts`
  —— **不要动 `legacy_file_names`**，那会触发历史文件 rename
- 设置页分类注册表在 `src/stores/runtime/settings.ts` 的 `settingsTabs` 数组 + 动态 import。
  **`nav.vue` 不用改**，它只 v-for 渲染。
- i18n：17 个 `src/localization/messages/<2字母locale>.json`（中文是 `ch`），
  `npm run sync-i18n`（**必须在仓库根跑**，脚本用相对路径）。**没有完整性校验测试。**
  键名约定：项标题 `settings.<分类>.<项>.title`，页签 `settingsTabs.<name>`。

---

## 7. 下一步（Task 3 起）

按计划文档的 Task 3–8 顺序执行。三个最容易踩的点：

1. **Task 3 DPAPI**：`windows` crate 要加 `Win32_Security_Cryptography` feature。
   `CRYPTPROTECT_UI_FORBIDDEN` 不可省（少了它任何进程都可能弹 UI 索要凭据）。
   密文**不进 storage 文件链**，走独立文件。非 Windows 平台必须返回错误而不是 panic。
   本文件被 `cargo test --lib` 链接，**不得碰 tauri**。
2. **Task 4 Tauri command**：这是阶段 1 首次引入 command，**也是最可能踩 `cargo test --lib`
   红线的地方**。必须走 `remote::*_blocking` 同步内核，`spawn_blocking` 放在 `commands.rs` 里。
3. **Task 8** 需要 `tauri build` 打**安装包 exe** 并让用户实机验收（设置页是用户可见功能）。
   **不能用 `tauri dev`** —— dev 构建路由页内容区空白，界面结论一律作废。

---

## 8. 环境约束速查

- 输出语言：**简体中文**（对话、文档、17 个语言包；中文 locale code 是 `ch` 不是 `zh`）
- 受保护常量不得改：mDNS 服务名、legacy 数据目录名、Tauri `identifier`
- 许可证：AFM 是 **GPL-3.0-or-later**，SSPL / 非商业 / 字段级限制的库不能作为可链接依赖
- PowerShell：调 `npm`/`npx` 前后显式 `$ErrorActionPreference='Continue'`；
  `vitest --reporter=basic` 不存在；绝不用 `Get-Content -Raw`/`Set-Content` 改含中文的源文件
- **`node -e "..."` 的参数里只要可能出现 `"`、`` ` ``、`$`，就改用 write 工具落盘再执行** ——
  PowerShell 会先于 node 解析引号，已导致提交信息错配过一次
- 提交信息文件用 write 工具写到 `.superpowers/sdd/commit-msg.txt`，再 `git commit -F`（该目录 git-ignored）
- ESLint：2 空格缩进；**对象属性各自一行**（`@stylistic/object-property-newline`）
- 验收夹具**不要放 `%TEMP%`**（`global_search/ignore.rs` 的 `builtin_ignored_paths()` 含 `/AppData/Local/Temp`）
- **PowerShell 里不要把辅助函数命名为 `CP`** —— 它是内置别名 `Copy-Item`，调用会变成复制文件
- **导轨按钮的无障碍 Name 全是空串，且运行时顺序 ≠ DOM 顺序**：远程按钮在代码里位于
  pages 循环与 extension 循环之间（`nav-sidebar.vue:280-308`），真机 hover 实测它却排在**最后**
  （6 个按钮里的第 6 个）。**按序号 hover 会 hover 到「拓展功能」**。正确做法：逐个 hover，
  按面板内容认人
- **开关型元素先读状态再决定要不要点**：`TogglePattern.Toggle()` 之前读 `ToggleState`，
  盲点会得到与本意相反的测量结果
- **被测控件可能整块不渲染**：连接表单的「删除已保存的密码」勾选框是 `v-if="hasSavedPassword"`，
  没有存档密码的连接根本看不到它 —— 在那种连接上量 clearPassword 等于什么都没量。
  需要这种连接时，用 `.superpowers/sdd/fixture-remote.cjs` 的 `snapshot` / `add` / `add-proto` /
  `restore` 四条显式子命令夹具，收尾校验两份 JSON 的 sha256 与快照一致

---

## 9. 接力 prompt（新开会话时直接粘这一句）

> 请先完整阅读 `F:\soft\00selfmade\filemanager\AGENTS.md`，以及 `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-18-remote-phase-1.md`（接力文档，含项目背景、已核实事实、门禁基线与环境坑），再读它引用的设计规格 `docs/superpowers/specs/2026-10-17-ftp-sftp-remote-space-design.md` 与阶段 1 计划 `docs/superpowers/plans/2026-10-18-remote-phase-1-connections-transport.md`，然后从计划的 Task 3 开始执行，并严格遵守 AGENTS.md 的「真机验收必须用 tauri build 打包产物、不用 tauri dev」。
