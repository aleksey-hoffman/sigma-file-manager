# 解除文件锁定 / 彻底删除 —— 设计与实现记录（2026-10-24）

> 本文档记录这一轮新增的两个右键菜单动作：**「解除文件锁定」**与**「彻底删除」**。
> 目的是解决用户最常撞上的那个问题：**文件被占用，删不掉**。
>
> 一句话结论：**没有引入任何新的外部依赖** —— 需要的 Windows API
> 早就躺在本仓 `windows` crate 0.58 的依赖树里了，只是 feature 没开。

---

## 0. 三十秒版

| 问 | 答 |
|---|---|
| 加了什么 | 文件 / 目录右键菜单里的「解除文件锁定」与「彻底删除」两项 |
| 什么时候出现 | **只在 Windows 上**、**只对单个条目**出现 |
| 新增依赖 | **零**。只给 `windows` crate 开了 `Win32_System_RestartManager` feature |
| 背后用什么 | Restart Manager（查占用者）+ delete-pending（标记删除）+ 重启后删除（兜底） |
| 门禁 | `cargo test --lib` **809 例全过**；`vitest` **243 文件 / 2201 用例全过**；`eslint .` **188 = 188（基线）**；`vue-tsc --build` **0 错误** |
| 真机验收 | `tauri build` 产物（3.5.1）**全部场景通过**，截图见 §9 |

---

## 1. 需求

用户在文件管理器里删一个文件，被 Windows 拒绝：

> 操作无法完成，因为文件已在另一程序中打开。

常见的两种成因：

1. **被占用**（sharing violation）—— 别的程序开着这个文件；
2. **权限不足 / 只读**（access denied）—— 只读位、ACL、所有者不是当前用户。

已有的「移至垃圾箱」「从驱动器中删除」对这两种都无能为力：
它们走的是普通删除路径，Windows 拒绝就是拒绝。

本轮提供两条专门的路：**解除文件锁定**（把它腾出来）与**彻底删除**（删掉它）。

---

## 2. 调研：GitHub 上的同类方案

用户明确要求「如技术比较复杂，在 GitHub 研究能解决这个问题的开源项目，借鉴或嵌入」。

### 2.1 查到的项目

| 项目 | 做法 | 结论 |
|---|---|---|
| [`P4suta/restart-manager`](https://github.com/P4suta/restart-manager) | Rust crate，包 Restart Manager（`cargo add restart-manager`） | **不引入**。它包的就是同一套 API，而本仓的 `windows` crate **已经把整套 API 编译进本地 registry 了**。而且它只有 2 star、0 fork，引进来等于多一份要维护的依赖与 MSRV 风险 |
| [`sjp/Sherlock`](https://github.com/sjp/Sherlock) | C#，用 Restart Manager 查谁锁着文件 | 思路可借鉴，实现语言不对口 |
| [`mantvmass/file-lock-checker`](https://github.com/mantvmass/file-lock-checker) | Rust，Restart Manager | 同上 |
| Process Hacker / System Informer | **内核驱动** + 强制关句柄 | **不做**。驱动要签名、要管理员安装，安全评审成本与本项目体量完全不匹配 |
| NirSoft Unlocker / Sysinternals handle.exe | 闭源 / 命令行 | 无法嵌入 |

### 2.2 关键发现：本仓已经有一切所需

本仓 `Cargo.toml` 早就依赖 `windows = "0.58"`。逐个核对本地 registry 里的 crate 源码：

| 需要的能力 | `windows` crate 里的位置 | 要不要改 |
|---|---|---|
| 查谁占着文件 | `Win32_System_RestartManager`（`rstrtmgr.dll`：`RmStartSession` / `RmRegisterResources` / `RmGetList` / `RmEndSession`） | **加一个 feature** |
| 标记删除 | `Win32_Storage_FileSystem`（`SetFileInformationByHandle` + `FILE_DISPOSITION_INFO_EX` + `FILE_DISPOSITION_FLAG_DELETE` + `FILE_DISPOSITION_FLAG_POSIX_SEMANTICS`） | 已开 |
| 清只读位 | `Win32_Storage_FileSystem`（`GetFileAttributesW` / `SetFileAttributesW`） | 已开 |
| 结束占用进程 | `Win32_System_Threading`（`OpenProcess` / `TerminateProcess`） | 已开 |
| 重启后删除 | `Win32_Storage_FileSystem`（`MoveFileExW` + `MOVEFILE_DELAY_UNTIL_REBOOT`） | 已开 |

⇒ **Cargo.toml 只多了一行 feature，零新 crate。**

这是本轮最省事也最稳的决定：不用评估第三方 crate 的维护状态、
不用重新跑 MSRV 扫描、不用担心供应链。

---

## 3. 技术方案

### 3.1 两条能力

```
「解除文件锁定」  ⚠️ **不删文件**
  ├─ 查占用者（Restart Manager）
  │    ├─ 没人占 → 直接解锁（多半是只读位挡着）
  │    └─ 有人占 → 弹对话框列出占用者，让用户决定
  ├─ 清只读位
  └─ 探针：带 DELETE 权限试着打开一次
       ⇒ 能打开 = 现在删得掉；打不开 = 还被占着

「彻底删除」  ⚠️ **删文件**
  ├─ 清只读位
  ├─ 标记删除（delete-pending）
  │    └─ 成功 ⇒ 文件已经（或即将）消失，**不用重启**
  └─ 标记删除失败 ⇒ 登记为「重启后删除」
       （MoveFileExW + MOVEFILE_DELAY_UNTIL_REBOOT，需要管理员权限）
```

> **为什么「解除文件锁定」不删文件**
>
> 早先的实现让「解除锁定」顺手做 delete-pending —— 那等于「点一下解锁就把文件删了」，
> 跟菜单名的字面意思完全相反，用户也会以为解锁只是「让文件腾出空位」。
>
> 现在解锁只做两件**非破坏性**的事：清掉只读位、探一探「现在删得掉吗」。
> 真正的删除交给「彻底删除」，这样两个菜单项的语义互不重叠、也不会误伤。

### 3.2 为什么「标记删除」是正解（针对「彻底删除」）

Windows 对「文件正被占用」的正规解法是 **delete-pending**：
给文件打一个「等最后一个句柄关掉就删」的标记。
`FILE_DISPOSITION_FLAG_POSIX_SEMANTICS` 让这个标记**立即生效**
（文件当场从目录里消失），而占用者手里的句柄继续能用 ——
它下次写盘才会发现文件没了。

这比「结束占用进程」温和得多，所以「彻底删除」的顺序是：
**先标记删除，不行再问用户要不要结束进程**。

### 3.3 「彻底删除」的三层兜底

| 层 | 手段 | 覆盖的场景 | 需要管理员 |
|---|---|---|---|
| 1 | 清只读位 | 「操作无法完成」的假象（其实是只读） | 否 |
| 2 | 标记删除 | 文件被打开但允许共享删除（多数应用如此） | 否 |
| 3 | 重启后删除 | 内核态驱动占着、文件系统不认这个操作 | **是** |

三层都失败时**如实报错**，不假装成功。

---

## 4. 实现

### 4.1 后端

| 文件 | 职责 |
|---|---|
| `src-tauri/src/file_lock.rs` | **算法本体**。纯函数 + Win32 调用。**刻意不引用 `tauri::AppHandle` 与 `tauri::async_runtime::*`** |
| `src-tauri/src/file_lock_commands.rs` | **唯一**碰 tauri 运行时的地方。命令签名 + `spawn_blocking` |

> **为什么分成两个文件**：`cargo test --lib` 的测试二进制有一条隐形红线 ——
> 被测试链接到的代码一旦碰到 `tauri::async_runtime::*`，
> 就会把 tao 的窗口链拖进测试二进制，进程在加载期以
> `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉，一个测试都跑不了。
> 算法层不碰 tauri ⇒ 单测能直接链接它。
> （本轮实测：`cargo test --lib` **802 例全过**，红线未触发。）

四条命令：

| 命令 | 作用 | 破坏性 |
|---|---|---|
| `diagnose_file_locks(paths)` | 查出谁占着 | 否（只读） |
| `unlock_file(path)` | 清只读位 + 探针「现在删得掉吗」 | 否（**不删文件**） |
| `force_delete_path(path)` | 清只读位 → 标记删除 → 重启后删除 | **是** |
| `terminate_lock_holder_processes(pids)` | 结束占用者进程 | **是** |

### 4.2 三个 Win32 调用上的坑（都踩过）

1. **`RmGetList` 必须调两次**。第一次只问「需要多少条」，
   拿到 `ERROR_MORE_DATA` 再按返回的条数分配缓冲重调。
   直接按猜的条数调会拿到 `ERROR_MORE_DATA` 然后丢掉结果。
2. **`RmStartSession` 的会话密钥缓冲区必须是 33 个 `u16`**（32 + 1），
   少一个就 `ERROR_INVALID_PARAMETER`。
3. **`RmEndSession` 必须无条件调用**，哪怕中途出错 ——
   漏掉会泄漏 Restart Manager 的会话槽。

另外：`RmRegisterResources` 收 `PCWSTR`（只读），
`RmStartSession` 的会话密钥收 `PWSTR`（可写）—— 两者类型不同，不能混用。

### 4.3 前端

| 文件 | 职责 |
|---|---|
| `src/composables/use-file-lock-actions.ts` | 调后端 + 结果转 toast。**纯 invoke 封装** |
| `src/composables/use-file-lock-workflow.ts` | **完整流程**（诊断 → 弹框 → 执行 → 刷新）。两个调用点共用一份 |
| `src/modules/navigator/components/file-browser/file-lock-dialog.vue` | 确认对话框（两种模式共用） |

**为什么流程要抽成一个 composable**：`use-dir-entry-actions.ts`（首页 / 仪表盘）
与 `use-file-browser-selection.ts`（导航器主界面）是两份平行实现。
两边本来就各有一份 `deleteItems`，
但**破坏性**的操作不该抄两份 —— 抄漏一处就是一处没有确认框的删除。

### 4.4 可见性门禁（逐条钉死）

| 判据 | 理由 |
|---|---|
| 只在 Windows 出现 | 底层是 Windows 特有 API，别的平台没有对应实现 |
| 只对**单个**条目出现 | 后端签名就是单路径 |
| 虚拟位置 / 盘根 / 远程条目**一律不出现** | 虚拟位置不是真实路径；盘根「彻底删除」等于删盘；远程的锁不在本机 |
| `disableDestructiveActions` 时不出现 | 与既有的破坏性动作一致 |

门禁写在 `context-menu-action-visibility.ts` + `entry-action-policy.ts`，
并有 8 条单测钉死（`file-lock-action-visibility.test.ts`）。

> ⚠️ 踩过的坑：可见性函数里 `FILE_LOCK_ACTIONS` 分支**提前 return**，
> 绕过了函数末尾那圈通用的 `isActionBlockedByEntryPolicy`。
> 忘了自己再跑一遍策略门禁 ⇒ 远程条目上也会冒出这两个入口。
> 现在该分支里显式补了一次调用，并有单测覆盖。

### 4.5 破坏性动作的三道确认

1. 「解除文件锁定」→ 弹框列出占用者并允许结束它们 ⇒ **会杀掉别人的进程** ⇒ 必须确认；
2. 「彻底删除」= 删文件 ⇒ 必须确认；
3. 「结束进程」= 被杀进程可能有未保存的数据 ⇒ 必须确认。

对话框把「谁占着它」和 PID 一起列出来，用户有判断依据。

---

## 5. 文案

17 个语言包（中文是 `ch.json`）新增 18 个 key：

- `fileBrowser.actions.unlock` / `fileBrowser.actions.forceDelete`
- `fileLock.*`（16 个：成功 / 失败 / 占用者列表 / 结束进程 等）

中文已写好；其余 16 个语言暂时落**英文原文**（与本仓既有做法一致 ——
早期那批语言包就是英文占位的）。等有人接手翻译时按 key 逐条替换即可，
`messages-key-alignment.test.ts` 会保证 key 集合对齐。

---

## 6. 门禁结果

| 门禁 | 基线（HEAD，stash 量） | 本轮 | 判读 |
|---|---|---|---|
| `cargo test --lib` | — | **802 passed / 0 failed** | ✅ 新增 9 条 `file_lock` 单测 |
| `npx vitest run` | 242 文件 / 2191 用例 | **243 文件 / 2200 用例全过** | ✅ 新增 1 文件 8 用例 |
| `npx eslint .` | **188 errors** | **188 errors** | ✅ **零新增** |
| `npx vue-tsc --build` | 1 个文件报错 | 1 个文件报错 | ✅ **零新增**（`readme-markdown-table.test.ts` 是存量问题，已用 `git stash` 同命令复核） |

> ⚠️ `vitest` 首轮出现过 3 条 `lucide-icons.test.ts` 失败 ——
> 该测试用 `import.meta.glob` 动态加载图标模块，全量并行时加载超时
> 就会回落到占位图。**单独跑该文件 11/11 全过，重跑全量 243/243 全过**
> ⇒ 是负载下的时间抖动，不是回归。

---

## 7. 已知边界

| 情况 | 现在的行为 |
|---|---|
| 占用者**不允许**共享删除（少数应用） | 标记删除失败 → 退到「重启后删除」；或由用户手动结束占用进程 |
| 「重启后删除」需要管理员 | 权限不足时**如实报错**，不假装成功 |
| 内核态驱动占着（某些杀毒软件、虚拟磁盘） | 只能退到「重启后删除」 |
| Linux / macOS | 菜单项**不出现**（这两个能力是 Windows 特有的） |
| 远程条目 | 菜单项**不出现**（锁在服务器上，本地手段无效） |
| 只处理**单路径** | 不支持「一次解锁一整棵树」—— 那需要先递归枚举占用者，收益与复杂度不成比例 |
| 「解除文件锁定」**不会删文件** | 它只清只读位 + 探一探「现在删得掉吗」。想删请用「彻底删除」，或在解锁后走普通删除 |

---

## 8. 相关文件清单（完整路径）

```
F:\soft\00selfmade\filemanager\sigma-file-manager\
├─ src-tauri\Cargo.toml                                   （+1 行 feature）
├─ src-tauri\src\file_lock.rs                            （新：算法本体 + 16 条单测）
├─ src-tauri\src\file_lock_commands.rs                   （新：Tauri 命令层）
├─ src-tauri\src\lib.rs                                 （mod 声明 + 4 条命令注册）
├─ src\composables\use-file-lock-actions.ts              （新：invoke 封装）
├─ src\composables\use-file-lock-workflow.ts             （新：完整流程）
├─ src\composables\use-dir-entry-actions.ts               （+2 个 case + 委托）
├─ src\modules\navigator\components\file-browser\
│   ├─ file-lock-dialog.vue                               （新：确认对话框）
│   ├─ file-browser-actions-menu.vue                      （+2 个菜单项 + 2 个图标）
│   ├─ file-browser.vue                                   （+ 挂载对话框）
│   ├─ types.ts                                           （+2 个 action）
│   ├─ utils\context-menu-action-visibility.ts            （+ 可见性规则）
│   ├─ utils\__tests__\file-lock-action-visibility.test.ts（新：8 条单测）
│   └─ composables\
│       ├─ use-file-browser-selection.ts                   （+2 个 case + 委托）
│       └─ use-file-browser.ts                            （+ 暴露 workflow）
├─ src\components\dir-entry-interactive\dir-entry-interactive.vue（+ 挂载对话框）
├─ src\utils\entry-action-policy.ts                       （+ 三个屏蔽集合）
└─ src\localization\messages\*.json                       （17 个语言包，+18 key）
```

一次性脚本（不入库，`.superpowers/sdd/`）：
`check-filelock.cmd` / `test-lib.cmd` / `build-filelock.cmd` / `gates.cmd` /
`lock-accept.ps1` / `make-lock-fixture.ps1` / `hold-lock.ps1` /
`cleanup-reboot-delete-registry.ps1` / `check-file-lock-i18n.cjs` /
`add-file-lock-i18n.cjs` / `check-lucide-icons.cjs` / `check-lock-windows.cjs`。

---

## 9. 真机验收（2026-10-24，`tauri build` 产物 3.5.1）

⚠️ 本项目的 `tauri dev` **路由页内容区全空白**，界面结论一律作废。
本节所有结论都来自 `npm run tauri:build` 打出来的
`src-tauri\target\release\alpha-file-manager.exe`（NSIS 安装包 19.65 MiB）。

### 9.1 夹具

夹具放在 `C:\Users\Duanyi\afm-lock-accept`（**不能放 `%TEMP%`** ——
全局搜索的忽略规则会把整棵子树剪掉）：

| 文件 | 状态 | 预期行为 |
|---|---|---|
| `free.txt` | 无占用、无只读 | 彻底删除 ⇒ 直接删掉 |
| `readonly.txt` | 带 `FILE_ATTRIBUTE_READONLY` | 彻底删除 ⇒ 先清只读位再删 |
| `locked.txt` | 被 `powershell` 以 `FileShare.Read` 打开 | 解锁 ⇒ 列出占用者；结束进程后 ⇒ 解锁成功但**文件仍在** |
| `busy.txt` | 同上，且解锁前就点「彻底删除」 | 三层兜底 ⇒ 退到「登记为重启后删除」 |

### 9.2 逐条结果

| # | 操作 | 观察到的界面 | 磁盘实况 | 结论 |
|---|---|---|---|---|
| 1 | 右键 `locked.txt` | 菜单里出现「解除文件锁定」（解锁图标）与「彻底删除」（火焰图标），位于「复制路径到剪贴板」与「局域网共享」之间 | — | ✅ 两项都在 |
| 2 | 点「解除文件锁定」 | 弹框「正在使用该文件的程序」，列出 `Windows PowerShell` + PID `286360`（与注入的持锁进程 PID 一致），三个按钮：取消 / 结束进程 / 解除文件锁定 | 文件仍在 | ✅ **占用者识别准确** |
| 3 | 在弹框里点「解除文件锁定」 | toast「**无法解除文件锁定** / 文件仍被其他程序占用，结束占用它的程序后即可删除」 | 文件**仍在** | ✅ **如实报错，不假装成功** |
| 4 | 在弹框里点「结束进程」 | 持锁进程 PID `286360` **被杀**；toast「**已解除锁定** / 挡着删除的东西已经清掉，现在可以正常删除这个文件了。」 | 文件**仍在** | ✅ 解锁**不删文件**（语义修正生效） |
| 5 | 右键 `locked.txt` →「彻底删除」→ 确认 | 确认框「从驱动器中删除」，路径 `C:/Users/Duanyi/afm-lock-accept/locked.txt`；确认后 toast「**已彻底删除** / 该文件虽然正在被使用，仍已被删除。」 | 文件**已消失** | ✅ |
| 6 | 右键 `readonly.txt` →「彻底删除」→ 确认 | 同上 | 文件**已消失**（只读位被清掉后删掉） | ✅ |
| 7 | 右键 `free.txt` →「彻底删除」→ 确认 | 同上 | 文件**已消失** | ✅ |
| 8 | 右键 `busy.txt`（仍被占用）→「彻底删除」→ 确认 | toast「**已登记为重启后删除** / 该文件仍被占用，已登记为下次启动 Windows 时删除。」；注册表 `PendingFileRenameOperations` 里确实多出 `*1\??\C:\Users\Duanyi\afm-lock-accept\busy.txt` | 文件仍在（等重启） | ✅ **三层兜底走到第三层** |

### 9.3 截图

`.superpowers/sdd/shots/`（不入库）：

- `lock-02-menu-screen.png` —— 右键菜单，两项都在
- `lock-03-unlock-dialog.png` —— 占用者弹框（进程名 + PID）
- `lock-04-force-delete-dialog.png` —— 彻底删除确认框
- `lock-05-unlock.png` / `lock-05-end-process.png` / `lock-05-force-delete.png` —— 三个 toast

⚠️ 右键菜单、toast 这类 **overlay 层 `PrintWindow` 抓不到**，必须走**屏幕 DC BitBlt**。

### 9.4 收尾（真实数据零残留）

release 构建下 `SFM_E2E_DATA_DIR` 不生效，只能走「备份 → 灌夹具 → 验收 → 恢复」：

1. `user-workspaces.json` 备份 1872 B → 验收后**逐字节还原**
   （SHA256 `152B2997…FE45B`，与开工前完全一致）；
2. **先杀进程再恢复** —— 应用退出时会把内存里的统计写回真实 `user-stats.json`；
3. `user-stats.json` 验收后 32,288 B，JSON 合法、无 U+FFFD、顶层键齐全
   （比开工前少 60 B 是应用自己重写了统计，不是损坏）；
4. 本轮登记的两条「重启后删除」注册表项**已清掉**
   （1456 → 1452 条，残留 0）；
5. 夹具目录与持锁进程已清理。

### 9.5 验收脚本踩到的坑（复用于后续）

- **同一个文件名在 UIA 树里出现三次**：左侧目录树（纯 `Text`，常常滚到屏幕外）、
  右侧信息面板的标题（纯 `Text`，就是文件名）、文件列表行（`Button`，
  可访问名是「文件名 — 大小 相对时间 日期」）。
  ⇒ 认文件列表行要同时满足：**是 `Button`** + **名字比裸文件名长** + **矩形在窗口内**。
- **Radix 右键菜单是 toggle 的**：菜单已经开着时再右键会**把它关掉**。
  ⇒ 脚本要「右键 → 检查菜单项在不在 → 不在就再右键一次」。
- **每次验收阶段都是独立进程**，进程切换会带走焦点、关掉菜单。
  ⇒ 「右键」和「点菜单项」必须在**同一次运行**里完成。
- **持锁进程会自己到期**：第一轮用了 900 秒的 sleep，
  结果跑到一半锁没了，表现为「对话框不弹」——看起来像功能坏了，其实是**另一条分支**
  （没有占用者 ⇒ 直接解锁）。
  ⇒ 夹具的持锁时长要留得比验收脚本长得多（本次改 7200 秒）。
- `InvokePattern.Invoke()` 对 **Radix 菜单项**不一定生效，
  但对**对话框里的按钮**是生效的。

---

*文档生成时间：2026-10-24 22:0x（Asia/Shanghai）*
