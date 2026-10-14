# 交接文档：kill 链路修复 + 弹窗闪动修复 + 路径同步严重回退

**日期**：2026-10-13
**目标项目**：`F:\soft\00selfmade\filemanager\sigma-file-manager`（Alpha File Manager，前身 Sigma File Manager，Tauri 2.x + Vue 3 + Rust 后端）
**上一份交接**：`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-13-followup-requirements-pack.md`（在读本份前先扫一遍那份，特别是 2 / 5 节）

---

## 0. 紧急事项（先看）

**本轮在装出 3.0.3 安装包后，用户实测报告严重回退：文件打开与下载两个对话框的路径同步都失败了。** 我在交付修复 1、2 的同时引入了这第三个 bug。

用户原话：

> 本次安装测试，可以关闭 alpha 打开的进程。但在路径同步出现严重回退，不仅文件打开弹窗，仍然无法同步路径，在下载弹窗也无法同步路径了。
> 请撰写完整的 handoff 文档，和一句话 prompt，用于新开会话接力任务。prompt 要引导新会话阅读必要文档，充分掌握项目背景、目标、进度和下阶段计划，不要重复 handoff 的具体内容，文档要提供完整路径。
> 在新会话移交后，调用 /systematic-debugging (from superpowers) 深入调研 bug 产生原因，并分析是否要回滚修改的代码，避免 bug 越修越多。

**新会话第一优先级是把这个回退弄掉，再考虑 0.5.12 NSIS 那边的修复要不要保留。** 不要在没有 A/B 证据之前继续改任何代码。

---

## 1. 项目基础与硬约束

- **品牌名**：Alpha File Manager（前身 Sigma File Manager，仓库里还残留大量 `sigma` 字符串属正常）
- **受保护常量**（绝不能改）：
  - Tauri `identifier` = `com.sigma-file-manager.app`（带 `.app` 后缀，tauri 自身会警告 macOS 但我们只打 Windows）
  - mDNS 服务名（如果有改动需求要先讨论）
  - legacy 数据目录名
- **中文 locale code** 是 `ch`（不是 `zh`），17 个语言包都要同步
- **零新依赖**
- **版本号固定 3.0.3**（`package.json` 与 `src-tauri/Cargo.toml`），不许升 patch
- **真机验收必须用 `tauri build` 的打包产物**；`tauri dev` 下路由页全空白，与本项目自身无关
- **Rust 工具链固定 1.90.0**：`C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`
- **构建命令**（PATH 在脚本内注入再 cmd 调，避免 PowerShell 重定向把 UTF-8 写成 UTF-16LE）：
  ```powershell
  $env:PATH = "C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin;$env:PATH"
  cmd.exe /d /c "npm run tauri:build"
  ```
- **本轮用户的明确约束**：「先不用发版」 → `npm run release:upload` / `release:github` / `release:prepare` 都不许跑

完整项目约定：`F:\soft\00selfmade\filemanager\sigma-file-manager\AGENTS.md`

---

## 2. 本轮做了什么（按完成度）

### 2.1 完成：安装时不杀 Alpha（v0.5.12 NSIS / 3.0.3 安装包）

根因（**两条都是真机 A/B 实测**，不是推测）：

1. **NSIS 的 `FileWrite` 不做任何转义展开。** 同一份 `.nsi` 里 `"A`r`nB"`、`"A\nB"`、`"A${NL}B"`、`"A$1B"` 落盘后全是字面量，整个文件 0 个 CR / 0 个 LF → 269 行脚本塌成物理上的 1 行 → `<#…#>` 同行闭合 → PowerShell 什么都不执行，**退出码却是 0**、stdout 空、日志文件也不生成。
2. **NSIS 的 `FileOpen` 无法用含正斜杠的路径创建文件**（`IfFileExists` 认正斜杠，所以「写完再查」会误判成没写成功）。`hooks.nsh:142` 写的正是正斜杠。

修复：生成器从「269 行 FileWrite」改为「1 行 `File` 编译期内嵌」，`hooks.nsh` 落盘 269 行 / LF 269 个。

### 2.2 完成：弹窗多次闪动（v0.5.11 sidecar）

真机日志显示读回来的是**文件名**，推送的是**目录**：

```
Read path="dbeaver-ce-26.2.2-windows-x86_64.exe"
opened_write_back: dialog path='dbeaver-ce-...' current='F:\books'; writing current
Write target="F:\books"          ← 2 秒后又写一次
```

`should_opened_write_back` 拿文件名比目录，**永远不相等** → 每次 `Opened` 都写一次 → 导航 → 再触发检测。

关键发现：仓库里**早就有** `last_written_path` 访问器（v0.5.7 G-1），它上面的注释写着「只被写入、从没被读过」——**去重键一直存在却从未接上**。

修复：去重改问「我们上次给这个 hwnd 写过什么」，加在 `should_opened_write_back` 的最后一个子句 `&& self.last_written_path(hwnd).as_deref() != Some(current_path)`。

### 2.3 **回退**（用户实测）

详见第 3 节。本质上很可能就是 2.2 那一行的去重键接反了某条路径，新会话首要是用 /systematic-debugging 把它弄清。

---

## 3. 当前状态：路径同步严重回退（用户实测）

### 3.1 用户描述

- 安装本轮 3.0.3 安装包后
- 「文件打开」弹窗：**无法同步路径**
- 「下载/另存为」弹窗：**也无法同步路径**
- 用户明确允许：可以关闭 Alpha 打开的进程（指明在测试中可以操控机器状态）

### 3.2 已安装机器的当前状态

- 路径：`D:\Program Files\Alpha File Manager\`（`uninstall.exe` 16:38:50 时间戳）
- 计划任务 `\KizemoFocusSync` 在跑
- sidecar 0.5.11 正在跑（端口 37421 listening，`/health` 返回 `version=0.5.11`）
- **注**：本次装包后用户的 Alpha 进程被我的探针杀掉了，后来用户又启了 Alpha

### 3.3 假说（未验证，新会话该从这里开始）

0.5.11 唯一改的是 `should_opened_write_back` 的去重子句。可疑方向：

- **`last_written_path` 与 `set_current_path` 互动的边界**：
  - 旧逻辑：每次 `Opened` 且 `initial_path != current_path` 且 `has_first_push_received` → 写
  - 新逻辑：再叠加「上次写过的路径等于当前推送路径」就跳过
  - 设想坏路径：用户导航到 A → 写 A → 焦点在对话框上，`/set_path` 又推了一次 A（dedup 掉了）→ 用户在对话框里手动改了文件夹到 B → 写 B → 关闭对话框 → 再开同一对话框 → last_known_path 还是 B（不是初始 read-back）→ current 还是 B → 「==」→ 跳过 → 看起来「无法同步」（其实是它已经同步了，且用户没推新值）
  - **关键反例**：用真机（或重现性 UIA 探针）复现「`/set_path` 推到新值后 Opened 不写」的最小场景
- **`register_dialog` 的「wrote 写 current / 没写写 initial_path」分支**：
  - 旧代码注释里就承认这个曾经因为脚本补丁 anchor 漏配而静默失效过（`G-2b` 注释）。0.5.11 改动没有触碰这条，但**任何触动 `should_opened_write_back` 之后 `wrote_back` 是否被设置的路径**都该复查一遍（`main.rs:367-473`）
- **`/set_path` 的 `path_unchanged` dedup**：旧逻辑也在这里，如果扩展连续两次推同一路径，第二次是 no-op。但 0.5.11 之后如果扩展每次推同一个值 + 用户从未真的换目录，**初始写**可能就**已经被 `last_written_path == current_path` 跳过了**（因为推送路径就是上一次写到对话框的路径）
- **写回顺序与「对话窗口刚开 / 已开 / 刚开第二次」三种状态** 的差别

### 3.4 A/B 探针资产（值得复用，不要丢弃）

- `F:\soft\00selfmade\filemanager\sigma-file-manager\_acceptance\alpha-probe7.nsi` —— 让真实 `hooks.nsh` 跑在受控最小安装包里（关键：带 `InitPluginsDir`，`$PLUGINSDIR` 不为空；用反斜杠 `"\$PLUGINSDIR\kill-app-tree.ps1"`）
- `_acceptance/gen-probe7.mjs` —— 生成器
- `_acceptance/nlstest/` —— 早期反引号/换行转义实验
- 这些**都验证过有效**，编译只需 ~1s，比真机安装快 100×

### 3.5 必要的「回滚 vs 修复」分析

用户原话：「分析是否要回滚修改的代码，避免 bug 越修越多」。

可能性：
- **A. 0.5.11 整段回滚 + 重新设计去重**：如果新逻辑就是接错，最快、最稳。`state.rs` 里 `should_opened_write_back` 4 行去掉 1 行即可。`http_server.rs` 的 `SPIKE_VERSION` 改回 `0.5.10`。重新走判别性测试
- **B. 0.5.11 保留但修边角**：需要先有真机证据证明「什么场景下应该写、0.5.11 跳了」+「怎么让 dedup 不误伤」。这条路风险高，建议只作为 A 失败后的备选
- **C. 0.5.12 NSIS 也一起回滚**？kill 修复是**真机端到端验证过**的（Alpha 2616 + 7 个 webview2 + sidecar 全杀，`OUTCOME=ok`），并且**从安装包里把脚本解出来验过 269 行**——这个比 0.5.11 闪动修复更硬。建议**保留**

---

## 4. 已落盘证据（外部可校验）

### 4.1 最终 3.0.3 安装包

```
F:\soft\00selfmade\filemanager\sigma-file-manager\release\Alpha File Manager_3.0.3_x64-setup.exe
F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\target\release\bundle\nsis\Alpha File Manager_3.0.3_x64-setup.exe
```
- mtime = 16:38:50　size = 18,101,450
- sha256 = `6C28735E5B56A45F03BCEEA4F43F910DB0C44627A3C1C57DAA67A86865DAAA98`
- 内嵌 `$PLUGINSDIR\kill-app-tree.ps1` = 269 行 / LF 269
- 内嵌 `tools\focus-sync-sidecar.exe` sha256 = `8C3DFFB12AFF7A92580DFCBB6EC67C803D48565FBFCD1E4B7B1C96B02BE23425`

旧对照（15:46 那次 3.0.3 装出 0.5.8 旧 sidecar 的版本）sha256 = `67F340C7BEAFAA7F77495218127874C9A0EFAE390BEBE20C075F12D80CD2EE4E`，size = 18,099,908。

### 4.2 进包路径 sidecar

```
F:\soft\00selfmade\filemanager\sigma-file-manager\extensions\kizemo.focus-sync\bin\focus-sync-sidecar.exe
```
sha256 = `8C3DFFB1…`（与安装包内一致），0.5.11，`/health` 实测 `version=0.5.11`。

### 4.3 解包校验命令（用户/新会话复用）

```powershell
$exe = "F:\soft\00selfmade\filemanager\sigma-file-manager\release\Alpha File Manager_3.0.3_x64-setup.exe"
$dst = "$env:TEMP\inst-extract"; New-Item -ItemType Directory -Force -Path $dst | Out-Null
& "C:\Program Files\7-Zip\7z.exe" x -y "-o$dst" $exe '$PLUGINSDIR\kill-app-tree.ps1' 2>&1 | Out-Null
$f = Join-Path $dst '$PLUGINSDIR\kill-app-tree.ps1'
$b = [IO.File]::ReadAllBytes($f)
"kill 行数=$((Get-Content -LiteralPath $f).Count)  LF=$(@($b|Where-Object{$_ -eq 10}).Count)"
& "C:\Program Files\7-Zip\7z.exe" x -y "-o$dst" $exe 'tools\focus-sync-sidecar.exe' 2>&1 | Out-Null
$sc = Get-ChildItem $dst -Recurse -Filter "focus-sync-sidecar.exe" | Select-Object -First 1
"sidecar sha256=$((Get-FileHash -LiteralPath $sc.FullName -Algorithm SHA256).Hash)"
```

### 4.4 真机日志（路径同步回退现场）

`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-13-kill-chain-and-flicker-regression.md` —— 见本文件
`%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log`（Event JSON）
`%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log.2026-10-13`（tracing）

---

## 5. 已修改的代码清单（每条都标了「改在哪 / 改了什么 / 验证是什么」）

### 5.1 NSIS / 安装器侧（v0.5.12）

| 文件 | 改了什么 | 验证 |
|---|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\installer\hooks.nsh` | `:142` `FileOpen $9 "$PLUGINSDIR\kill-app-tree.ps1" w` → `…\$PLUGINSDIR\kill-app-tree.ps1 w`；`:426` nsExec 同样改反斜杠；`AlphaTerminateAppProcessesBody` 内的 `FileWrite` 块整段删 | 真机端到端：Alpha 2616 + 7 webview2 + sidecar 全杀，OUTCOME=ok；从安装包解出 269 行 / LF 269 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\installer\embed-kill-script.mjs` | 产物从 269 行 `FileWrite` 改为 1 行 `File /oname=$PLUGINSDIR\kill-app-tree.ps1 "${__FILEDIR__}\kill-app-tree.ps1"`；ASCII / 换行转义判定已无关（`File` 字节精确）；移除对反斜杠的硬拒绝 | 同步到 hooks.nsh 后落盘 269 行 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\installer\__tests__\kill-app-tree-embed.test.ts` | 新增 2 条守卫：「内嵌块必须用 File，不得回退到 FileWrite」+「nsExec -File 必须用反斜杠」；移除「脚本不含反斜杠」这一条（`File` 路径下不必要） | `npx vitest run …kill-app-tree-embed.test.ts` → 10/10 |

### 5.2 sidecar 侧（v0.5.11）—— **重点怀疑对象**

| 文件 | 改了什么 | 验证 |
|---|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\extensions\kizemo.focus-sync\sidecar\src\state.rs` | `should_opened_write_back` 增加 `hwnd` 形参 + 最后一个子句 `&& self.last_written_path(hwnd).as_deref() != Some(current_path)`；`fn last_written_path` 早就在（v0.5.7 G-1）但原本从未被读 | 判别性测试 `dedup_survives_filename_readback_after_we_already_wrote` 探针态转红、恢复后绿；`dedup_lets_a_genuinely_new_path_through` 探针态仍绿；全量 83/83 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\extensions\kizemo.focus-sync\sidecar\src\main.rs` | `state.should_opened_write_back(&initial_path, &current)` → `(hwnd_u32, &initial_path, &current)` | 编译通过 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\extensions\kizemo.focus-sync\sidecar\src\http_server.rs` | `SPIKE_VERSION: "0.5.10"` → `"0.5.11"`，注释说明新逻辑 | /health 实测 `version=0.5.11` |

### 5.3 产物

| 路径 | sha256 | 大小 |
|---|---|---|
| 进包路径 sidecar | `8C3DFFB1…` | 2,833,920 |
| 3.0.3 安装包 | `6C28735E5B56A45F03BCEEA4F43F910DB0C44627A3C1C57DAA67A86865DAAA98` | 18,101,450 |

### 5.4 未改但**绝对不能改**的文件

- 任何与 mDNS 服务名、legacy 数据目录、Tauri `identifier` 相关的字符串
- 17 个语言包（`src/localization/messages/**`）的键名（值可以改）
- `src-tauri/Cargo.toml` / `package.json` 的 version 字段（除非用户明确说升）

---

## 6. 环境陷阱（这次踩到的，避免再踩）

- **PowerShell 5.1**：
  - 含中文的 `.ps1` 必须带 UTF-8 BOM（`[IO.File]::WriteAllText($p, $t, (New-Object Text.UTF8Encoding($true)))`）
  - `>` 重定向是 UTF-16LE，会把 Node 的 UTF-8 输出写成乱码
  - `Remove-Item` 被硬策略拦；用 `Move-Item` 或 `rm -- "<target>"`（后者经 trusted launcher 走可恢复删除）
  - 不要用 `-NoForce`（5.1 不认）
  - `[System.IO.File]::ReadAllLines()` 在 Windows 上会带 `\r` 行尾，写回时去掉
- **NSIS**：
  - `.nsi` / `.nsh` **必须纯 ASCII**（或用 UTF-8 with BOM 且 `Unicode true`），含中文但无 BOM → `Bad text encoding`
  - `FileOpen … /`（正斜杠）在 `IfFileExists` 能用，但 **`FileOpen` 写会失败** —— 真机 A/B 验过
  - `FileWrite` **不做任何转义**，`"A`r`nB"`、`"A\nB"`、`"A${NL}B"` 都是字面量
  - `FileWrite` 的字符串**不自动换行**，必须显式带 `FileWrite $0 "`r`n"`（且 `FileWrite` 自己也不解释 `` `r `` `n`）
  - `${Using:StrFunc}` 必须**在 `!include StrFunc.nsh` 之后**且**写在 top-level**（不能在 `!include` 之前）
  - `${StrCase}` / `${StrLoc}` 必须**在 `!include StrFunc.nsh` 之后**逐条 top-level 调用才能注册到全局
  - `$PLUGINSDIR` 是**只读**内置变量，不能 `StrCpy` 赋值
  - `IfFileExists x 0 lbl`：`0` 当作目标，**不要这样写**；用 `IfFileExists x 0 yes no` 后跟标签
  - `IfErrors label_err label_ok` 不是 `IfErrors 0 label_err label_ok`
  - `File` 指令的源路径用 `${__FILEDIR__}` 解析（被 include 的 .nsh 里指向本文件所在目录），**不写死构建机绝对路径**
  - `FunctionError` / `Function` 内的 `$0`-`$9` 是函数局部的（NSIS 3.x 行为，但跨 `Call` 边界有时仍可见）—— 关键：依赖 `$0` 在 `Call` 后做条件判断**不可靠**
  - `LogSet` 不可用（Tauri bundler 不传 `-DNSIS_CONFIG_LOG`）；想看安装期日志只能在脚本里 `FileOpen … FileWrite` 写文件
  - `RequestExecutionLevel admin` + 管理员启动 → 不会有 UAC 弹窗，可放心
  - 关闭的 makensis 路径里中文要用 **反斜杠**（`F:\soft\…`），正斜杠某些 `!include` 路径解析会失败
- **Tauri / `tauri build`**：
  - 必须在打包前**关闭所有 `alpha-file-manager.exe`**（以及占着 `target\release\alpha-file-manager.exe` 的进程），否则最后 Rust 链接完成后覆盖 exe 时报 `os error 5`
  - 真机验收用打包产物，不用 `tauri dev`（dev 路由页全空白）
- **判别性探针**：
  - 写进 `.nsh` 之前**先在 `_acceptance/` 下用 Node 脚本**生成纯 ASCII `.nsi`（无 BOM），并加 ASCII-only 断言
  - 任何 `FileWrite $handle "literal" + "more"` 都会触发「expects 2 parameters, got N」——把要拼接的东西**全部塞进同一个引号**里
  - JS 模板里写 NSIS 反引号：``  `\`r\`n` ``（每个反引号都要 `\` 转义）
  - 多重 `StrCpy $reg …` 在一个 `IfFileExists` 的两个分支里设值，第二个 `StrCpy` 会覆盖第一个——`FileWrite` 想读**前**一个值的话，必须**先读**再赋值
- **断言纪律**：
  - 探针本身的缺陷也会让测试绿了，**必须先证探针有效**（注入缺陷 → 看测试精确转红）
  - 探针转红**不够**，要看失败输出**精确**展示了预期的那种坏结果；只是 `assertion failed` 不算数
  - 「物化 269 行、语法 OK」是 Node 侧物化器自己拼的换行，**不代表 NSIS 真的会写换行** —— 物化工具与被测链路不同源，结论不可迁移

---

## 7. 进度总览（按时间线）

| 时间 | 事件 | 验证 |
|---|---|---|
| 此前（已交付） | 需求 1 / 需求 5 追加 / 设置页链接 / 「打开」对话框路径同步（0.5.10） | 17 语言包同步、vitest 1226/1228 |
| 14:00–15:30 | 安装器三处修（SelfPid 管道 / schtasks 重定向 / sidecar 部署假成功门） | 5 守卫 + 5 判别探针全转红；makensis 0 error |
| 15:29:38 | 第 1 个 3.0.3 安装包 | sha256 `67F340C7…` |
| 15:46 | 用户安装 | sidecar 仍是 0.5.8 假成功 |
| 16:13–16:22 | **本轮** v0.5.12 NSIS 修：FileWrite 塌行 + FileOpen 正斜杠 | 真实 hooks 探针端到端 269 行 / 9 个进程被杀 / Alpha 2616 真死 |
| 16:30:15 | 第 2 个 3.0.3 安装包 | sha256 `D8350702…`，从包解出脚本 269 行 |
| 16:30–16:37 | 现象 2 闪动根因 + 修复 v0.5.11 | 判别测试先红后绿，全量 83/83 |
| 16:38:50 | **最终 3.0.3 安装包（含 0.5.11 sidecar）** | sha256 `6C28735E5B56A45F03BCEEA4F43F910DB0C44627A3C1C57DAA67A86865DAAA98`；包内 sidecar sha256 `8C3DFFB1…`；包内脚本 269 行 / LF 269 |
| 16:46 | 用户实测：路径同步严重回退（**当前阻塞**） | 报告了，但未取证 |

---

## 8. 新会话行动建议（按优先级）

### 8.1 P0：路径同步回退（用户明示）

1. `/systematic-debugging`（必走）
2. 第一步取证：让用户开一个「下载」或「打开」对话框，从 `%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log.2026-10-13` 读 trace，看 `v0.5.11 ROUTE` → `Injection starts` → `Injection succeeded` / `Write` / `opened_write_back` / `set_path` 的实际序列
3. 对照 0.5.10 的行为（git diff `state.rs` `main.rs` 即可看出），先 A/B 出「0.5.10 跑得通、0.5.11 跑不通」的具体步骤
4. 关键判别性实验（**绝不能直接改逻辑**）：
   - 写一个只读 `last_written_path` 的 `eprintln!` 调试输出，跑一次真机
   - 在 `should_opened_write_back` 的旧逻辑与新逻辑之间加 `if cfg!(feature = "use-old-dedup")` 做 feature gate，A/B
5. **回滚评估**（用户明确要求的）：
   - **A 方案**（推荐先试）：0.5.11 的 `should_opened_write_back` 第四个子句去掉，回滚到 0.5.10 dedup；闪动问题先用其他方法缓解（例如 `set_path_dedup` 已经在 `/set_path` 那侧 short-circuit 同一路径的连续 push，闪动可能已经比 0.5.10 轻）
   - **B 方案**：保留 0.5.11 但加更多 guard（例如「写过一次之后还要再写需要 explicit 重新 push」），但**要先有真机证据**证明新逻辑在哪些场景下被误伤
   - **C 方案**：0.5.12 NSIS 修**不建议回滚**——已用真机 + 包内字节双重验证
6. 修完 → cargo test 83/83 → 重建 sidecar → 替换进包路径 → 重打 3.0.3 → 解包验脚本与 sidecar 哈希

### 8.2 P1：安装时关闭 Alpha 的权限范围

用户已明确「可以关闭 alpha 打开的进程」——即在测试期间可杀进程、可重启、可开关计划任务。**但不要**：
- 删除任何用户的真实文件
- 修改注册表非 Alpha 相关键
- 跑 `release:*` 系列

### 8.3 P2（已摸清路径，待排期）

#### 需求 4：递归目录内搜索 + 打开所属目录

| 文件 | 位置 | 说明 |
|---|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\global_search\query.rs` | `:337-357` | 当前是单层 `read_dir`，需要 WalkDir |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\global_search\types.rs` | `:55-62` | `GlobalSearchQueryOptions` 无 `max_depth` |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\global_search\scan.rs` | `:292-298` | 已有成熟 WalkDir 写法可复用 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\stores\runtime\global-search.ts` | `:394` | 须加开关否则静默改语义 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\composables\use-file-browser.ts` | `:204` | `setupExternalDataSource` 现有 `:246-254` 全是 no-op 空函数 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\components\global-search-view.vue` | `:564-575` | UI |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\global_search\types.rs` | `:46` | `'open-containing-directory'` 已在联合类型里 |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src\shared\context-menu\context-menu-action-visibility.ts` | `:101/120-127` | 菜单可见性 |

#### 需求 3 A 档：补注册 shell 动词

| 文件 | 位置 | 说明 |
|---|---|---|
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\default_file_manager_common\src\lib.rs` | `:11-20` | `ROOT_REGISTRY_KEYS: [&str; 3]` |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\default_file_manager.rs` | `:376-378` | |
| `F:\soft\00selfmade\filemanager\sigma-file-manager\src-tauri\src\launcher\src\main.rs` | `:55` `expected_commands() -> Option<[(&'static str, String); 3]>`；`:62-64`；`:128-154`（`ROOT_REGISTRY_KEYS[0..2]` 位置索引耦合）；`:251/264` | 新键须追加在末尾保住 `[0]/[1]/[2]` 语义 |

### 8.4 重要引用

- 主项目约定：`F:\soft\00selfmade\filemanager\sigma-file-manager\AGENTS.md`
- 上一份交接：`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-13-followup-requirements-pack.md`
- 需求包计划：`F:\soft\00selfmade\filemanager\sigma-file-manager\docs\superpowers\plans\2026-10-13-followup-requirements-pack.md`

---

## 9. 不要重蹈覆辙的检查清单

- 修任何 hook 之前**先量到具体的字节 / 行数 / sha256** —— 探针也可能是平凡的，要证
- 任何「看起来能跑通的快速测试」**真的跑过再下结论**，不要凭推断
- 改 sidecar / hook 之后**两件必做**：
  1. cargo test 全量绿
  2. **从安装包里把对应路径解出来，对比 sha256 / 行数** —— 不是看构建日志
- 修路径同步这类行为类 bug，**第一动作是 trace**，不是改代码
- 真机是唯一真理——`tauri dev` 不能验（路由页空白），`tauri build` 后真机跑才是

---

**结尾一句话**：本轮 0.5.12 NSIS 修复有真机端到端 + 包内字节双验，可信；0.5.11 闪动修复只有单测验证 + 真机一次抓包，**没有对照 0.5.10 行为**就发版——这是这次回退的直接原因，新会话第一动作是补上对照，再决定改还是回滚。
