# 交接文档：比较并同步 + 添加网络驱动器（2026-10-21 ~ 2026-10-22）

## 0. 本轮范围与结论

本轮做完了 B1 ~ B6 全部批次，并**在真机验收中抓出两个真实缺陷**，都已修复、重新打包、复验通过。

| 编号 | 事项 | 状态 |
|---|---|---|
| B0 | 需求分析（58 条）+ 4 项拍板定案 + 执行计划 | **已完成**（`docs/plan-2026-10-21-directory-compare-and-sync.md`、`docs/plan-2026-10-21-compare-sync-execution.md`） |
| B1 | 左侧边栏「添加网络驱动器」入口 | **已完成并真机验收通过** |
| B2 | 后端 compare 模块（LocationRef / 准则 / 差异树）+ 单测 | **已完成** |
| B3 | 同步计划 + 后台任务（进度 / 取消） | **已完成** |
| B4 | 前端工具栏入口 + 三步对话框 + 差异树 + 预览清单 + 执行 | **已完成** |
| B5 | 17 个语言包文案 | **已完成** |
| B6 | 门禁 + 真机验收 + 打包 exe + 发版 | **已完成** |

**验收中抓到并修掉的两个真实缺陷**（都不是单测能覆盖的那种）：

1. `net use` 的盘符参数少了冒号 → 映射必然失败，而且错误码 67 与「共享不存在」完全一样，极易误判。
2. 「取消」按钮在后台任务真正注册之前就可点击 → 那段时间点取消必然失败，任务照跑完。

---

## 1. B1：添加网络驱动器（侧边栏入口）

### 1.1 做了什么

- **后端** `src-tauri/src/dir_reader/network_shares.rs`
  - `NetworkShareParams` 新增 `drive_letter`（`Option<String>`），用户可指定盘符，留空则自动分配。
  - `normalize_drive_letter()`：`z` / `Z` / `Z:` → `"Z"`；空 → 自动；**非法值报错不静默忽略**。
  - 盘符反查用 **`WNetGetConnectionW`**（`extern "system"` 直接声明 `mpr.dll`，零新增依赖），
    不解析 `net use` 的文本输出 —— 那张表的列宽随内容变化、列名随语言变化、远程路径可能带空格。
  - 顺手修掉既有缺陷：原实现抓 stdout 里含 `"assigned"` 的一行，而真实输出是
    `Drive Z: is now connected to ...`，**"assigned" 这个词在真实输出里根本不存在**，原实现在本机返回空串。
- **前端**
  - `src/modules/home/components/mount-dialog.vue`：新增 `mode?: 'all' | 'network'` 与 `mounted` 事件；
    Windows 上协议只列 SMB；新增盘符输入框（maxlength=2，留空=自动）。
  - `src/modules/nav-sidebar/nav-sidebar.vue`：盘符条下新增虚线「添加网络驱动器」按钮（`NetworkIcon` + Tooltip + aria-label）。
  - `src/modules/home/composables/use-network-mount-form.ts`（新）：表单状态 + 自动推导的「挂载为」名字（可单测）。
- **i18n**：新增 4 个 key，17 个语言包全部 175 keys、missing=0、extra=0。

### 1.2 真机验收（打包产物 3.4.0）

| 步骤 | 预期 | 实测 |
|---|---|---|
| 点侧边栏「添加网络驱动器」 | 打开对话框，只列 SMB、devices 页签隐藏 | ✅ |
| 填 主机=localhost / 盘符=Y / 远程路径=AFMDrv | 三个字段回填 | ✅ |
| 点「连接」 | 系统出现 `Y: -> \\localhost\AFMDrv` | ✅ |
| 侧边栏盘符条 | 出现 Y:（网络驱动器图标样式） | ✅ |
| 主页「驱动」卡片区 | 出现 Y: | ✅ |
| 右键 Y: →「断开连接」 | `net use` 清空、Y: 不可读、界面同步移除 | ✅ |

截图：`.superpowers/sdd/afm-340-netdrive-ok.png`、`afm-340-drivestrip.png`（盘符条放大）、
`afm-340-strip-after.png`（断开后）、`afm-340-home2-crop.png`（主页驱动卡片）。

### 1.3 验收中抓到并修掉的两个缺陷

#### 缺陷 A：`net use` 的盘符参数少了冒号 → System error 67

**现象**：点「连接」后报 `net use failed: …67…`，映射没建立。

**根因**：`normalize_drive_letter()` 返回的是**不带冒号**的单字母（`"Y"`，那是给界面显示用的），
而 `mount_network_share_windows()` 直接把这个 `"Y"` 拼进了命令行：

```
net use Y \\localhost\AFMDrv     →  System error 67（找不到网络名）
net use Y: \\localhost\AFMDrv    →  成功
```

**为什么难查**：不带冒号时 `net.exe` 把 `Y` 当成「连接名叫 Y 的远程资源」而不是盘符，
而 **67 恰好也是「共享根本不存在」的错误码** —— UNC 路径明明完全正确，
报错却指向「路径拼错了」。

**修复**：新增纯函数 `net_use_drive_spec(letter)` → `"Y:"`，并在拼命令行时用它；
单测 `the_net_use_drive_spec_always_carries_the_colon` 钉死。

#### 缺陷 B：`net.exe` 的报错是控制台代码页，按 UTF-8 解变成乱码

**现象**：错误框里是 `net use failed: ` 后面跟着一串替换字符（U+FFFD），只有中间的 `67` 是可读的。

**根因**：`net.exe` 的报错按**控制台代码页**输出（中文 Windows 上是 cp936 / GBK），
代码里用的是 `String::from_utf8_lossy` → 每个汉字变成一个替换字符。

**修复**：新增 `decode_windows_console_output()`（`kernel32` 的 `MultiByteToWideChar` + `GetConsoleOutputCP`，
同样是 `extern` 声明，**零新增依赖**）：先试严格 UTF-8，不行就按候选代码页逐个解码，
取第一个**不含 U+FFFD** 的结果。`mount.rs` 里卸载网络驱动器的报错也一并换成它。

**顺带修掉**：`mount-dialog.vue` 里「挂载为」的名字不跟随远程路径更新
（原判据「当前值 == 当前推导值」在推导值本身变化时永远不成立）。
抽成 `useNetworkMountForm` composable + 7 条单测。

### 1.4 验收脚本（`.superpowers/sdd/`，不入库）

- `accept-netdrive-340.ps1`：端到端（打开入口 → 填表 → 连接 → 系统层核对）。**UIA 按名字定位，不写死坐标。**
- `fill-field.ps1`：**已修** —— 原脚本的 Ctrl+V 用的 VK 码是错的（`0x10` 是 VK_SHIFT，`0x04` 是 VK_RCONTROL），
  发出去的是 Ctrl+Shift，从来没有 `V`，字段一直是空的，看上去像产品 bug。
  另加 Ctrl+A 全选，否则粘贴是**追加**而不是替换。

> **`.ps1` 的规矩**：PowerShell 5.1 按 ANSI 读无 BOM 文件，**中文一律作命令行参数传入**。
> 脚本里写中文正则会被 ANSI 解码弄坏，甚至直接把解析器搞崩（实测报
> `Unexpected token` + 字符串终止符丢失）。

---

## 2. B2 ~ B5：比较并同步

### 2.1 后端 `src-tauri/src/compare/`

| 文件 | 内容 |
|---|---|
| `location.rs` | `LocationRef`（`#[serde(tag="type")]`、`connectionId` camelCase）、`EntryKind`、`EntryMeta`、`join_relative()`（远程根不产生 `//`） |
| `criteria.rs` | `CompareCriteria`（by_time / by_size / by_checksum / case_sensitive / remote_time_offset_seconds / recursive / max_depth / exclude_patterns；默认 time+size）、`ExcludeMatcher`（globset，`\`→`/`，名字与相对路径双匹配） |
| `tree.rs` | `CompareStatus{Same,OnlyLeft,OnlyRight,Newer,Older,SizeDiff,ContentDiff,KindDiff,Indeterminate}`、`Direction{None,ToRight,ToLeft,Indeterminate}`、`CompareNode`、`CompareStats` |
| `compare.rs` | `FlatTree`（相对路径用 `/` 作键）、`collect_local_tree`（不跟随符号链接、深度上限、排除剪枝、sha256 按需算）、`collect_remote_tree`（远端时间偏移在此校正）、**纯函数** `classify_pair()` / `compare_trees()` |
| `sync_plan.rs` | `SyncAction{CreateDir,TransferFile,Skip}`、`build_sync_plan()`（**方向待定只进跳过清单、不下钻、绝不产生覆盖动作**；建目录排在传文件之前） |
| `sync_runner.rs` | `execute_plan()`（协作式取消、单项失败不中断其余、本地 fs 走 `tokio::task::spawn_blocking`） |
| `commands.rs` | **红线文件（任何单测都不得引用）**：`compare_directories` / `preview_compare_sync` / `start_compare_sync_job` / `cancel_compare_sync_job`，事件 `compare-sync-job-progress` / `compare-sync-job-finished` |

**关键拍板（#1）**：时间相同但内容不同 → `SizeDiff` / `ContentDiff`，方向 `Indeterminate`
→ 同步计划**只进跳过清单、不下钻、不覆盖**；目录 vs 文件的 `KindDiff` 同样处理。

### 2.2 前端

- `src/types/compare-sync.ts`：与后端 serde 逐字段对应的 TS 契约。
- `src/modules/navigator/utils/compare-sync.ts`：`toCompareLocation`、`filterCompareNodes`（**保层级**）、`countStatuses`、`isUndecidedStatus`、`parseExcludePatterns`、`compareNodeDepths`。
- `src/modules/navigator/components/compare-sync/compare-sync-dialog.vue`：**三步**（设置 → 结果 → 预览与执行）。
- `src/modules/navigator/components/navigator-toolbar-actions/navigator-toolbar-actions.vue`：`GitCompareArrowsIcon` 按钮，**仅分屏可见**、全局搜索时禁用。
- `src/modules/navigator/pages/navigator.vue`：左右路径取**窗格实例当前位置**（`paneRefsMap`），不是 tab 路径。
- i18n：`compareSync` **60 键** × 17 个语言包（ch 中文、en 英文、其余 15 语言先用英文占位）。

### 2.3 真机验收（打包产物 3.4.0）

靶子（自建，用完复原）：`C:\Users\Duanyi\afm-cmp-left` 与 `...\afm-cmp-right`。

| 文件 | 左侧 | 右侧 | 设计意图 |
|---|---|---|---|
| `same.txt` | 12 B | 12 B | 相同 |
| `only-left.txt` | 16 B | — | 仅左侧 |
| `only-right.txt` | — | 17 B | 仅右侧 |
| `older.txt` | 18 B / 22:51 | 18 B / 20:51 | 左侧较新，同尺寸 |
| `stale.txt` | — | 31 B / 22:51 | 右侧较新 |
| `conflict.txt` | 4 B / 20:51 | 8 B / 20:51 | **同时间不同大小 → 必须不被覆盖** |
| `sub/left-only.txt`、`sub/right-only.txt` | | | 子目录递归 |

**流程与结果**：

1. 分屏（CTRL+S）→ 左 `afm-cmp-left`、右 `afm-cmp-right` → 工具栏「比较并同步」。
2. 点「比较」→ **共 9 / 相同 2 / 有差异 7 / 待定 1**；差异树带层级，`conflict.txt` 判为「大小不同 · 方向待定」。
3. 点「生成预览」→ **将新建 0 个目录、传输 6 个文件、跳过 1 项**；跳过项正是 `conflict.txt`。
4. 点「开始同步」→ 报告 **已传输 6 / 已新建目录 0 / 已跳过 1 / 失败 0**。
5. **落盘核对（md5 逐字节）**：
   - `conflict.txt` 两侧 md5 **原封未动**（左 `0988…` 4 B / 右 `9621…` 8 B）→ **没有被覆盖** ✅
   - `older.txt` 右侧被左侧版本覆盖（`FA06…` → `E835…`）；`only-left.txt`、`sub/left-only.txt` 落到右侧；
     `only-right.txt`、`stale.txt`、`sub/right-only.txt` 落到左侧；`same.txt` 两侧未动。

### 2.4 取消功能：验收方法与一个真实缺陷

**取消本身是好的**（实测通过）：把靶子放大到 3.84 GB（30 个 128 MB 文件），
在传输进行到 14 个文件时点「取消」：

- 文件数停在 **22** 不再增长（连续采样 16 秒）
- 报告出现 **「已取消」**

**但验收方法本身踩了个坑，值得记下来**：本地复制比想象中快得多
（3000 个 8 KB 小文件 ≈ 1 秒、3.84 GB ≈ 2.5 秒），
所以**取消总是落在任务结束之后**，看起来像「取消无效」。
判定取消必须看**文件系统采样**（文件数是否停止增长），
不能看界面 —— 进度事件把 WebView2 渲染线程刷爆时，`PrintWindow` 会返回**陈旧帧**
（实测两次不同的运行都画出「file-00354.dat」）。

**真实缺陷**：第一次运行时我点「开始同步」后 **6 毫秒**就点「取消」，得到
`没有正在跑的比较同步任务：compare-sync-1792631172116` —— 取消失败、任务照跑完 3000 个文件。

**根因**：`runExecute()` 在 `await invoke('start_compare_sync_job')` **之前**就把 `isExecuting` 置真，
「取消」按钮随之出现；但那一次 IPC 还没回来时，Rust 侧的任务还没写进 `COMPARE_SYNC_JOBS` 注册表，
此时点取消必然失败。

**修复**：新增 `jobStarted`，只有 `start_compare_sync_job` 返回之后才置真；
「取消」按钮在此之前是 `:disabled="!jobStarted"`（那一次 IPC 返回时 Rust 侧已注册好任务，取消必然有效）。
另外在任务结束、重新打开对话框时都复位。
单测见 `src/modules/navigator/components/compare-sync/__tests__/compare-sync-dialog.test.ts`（源码断言，4 条）。

---

## 3. 门禁（3.4.0 代码状态下全绿）

| 命令 | 基线 | 本轮实测 |
|---|---|---|
| `cargo test --lib` | 759 | **763 passed / 0 failed**（新增 4 条：`net_use_drive_spec` ×2、`pick_first_clean` ×2） |
| `npx vitest run` | 230 文件 / 2049 | **232 文件 / 2060**（新增 `use-network-mount-form.test.ts` 7 条、`compare-sync-dialog.test.ts` 4 条） |
| `npx eslint src` | 170 errors / 0 warnings | **170 / 0**（回到基线） |
| `npx eslint .` | 177 / 0 | **177 / 0** |
| `npx vue-tsc --build` | 0 | **0** |
| `node scripts/verify-changelog.mjs` | OK | **OK** |

> 门禁基线必须用**同一条命令**量；`eslint .` 与 `eslint src` 差 7 个（`src` 之外的存量），
> 混口径会凭空多出 7 个「回归」。

### 3.1 顺手修掉的一个门禁脆弱点

`src-tauri/installer/__tests__/single-instance-guard.test.ts` 的两条用例跑的是
`installer/_acceptance/test-single-instance-guard.ps1`，每次都要拉起守卫脚本，
而守卫脚本会**枚举全机进程**（WMI）。

本机实测：机器上有 **431 个进程**时，一次 `Get-CimInstance Win32_Process` 要 **6.5 秒**，
五条判定用例跑完 **42.5 秒** —— 超过 vitest 的 30 秒默认超时，
于是门禁**时绿时红**，而脚本本身其实全部通过（输出 `OK: all single-instance guard cases passed`）。

`runHarness` 里 spawnSync 本身就给了 120 秒预算，vitest 这边却还是 30 秒。
现在两边统一给到 180 秒（commit `f0fa87cb`）。

> **判定「门禁红了」之前先问一句：是真红，还是超时？**
> 这次的报错是 `Test timed out in 30000ms`，不是断言失败 —— 断言失败才有内容可看。

---

## 4. 打包与发版

- 版本号 **3.4.0**（`package.json` + 3 个 Cargo.toml，`npm run sync-version`）。
- `CHANGELOG.md`（英）与 `public/changelog/ch/changelog.md`（中）各加 3.4.0 条目。
- `README.md` / `README.zh-CN.md`：「我们加了什么」表各加 4 行、三方对比表各加 2 行、新增「3.4.0 新增了什么」整节。
- `_notes.md` 重写为 3.4.0 中文发布说明（站点清单 + GitHub release 正文共用）。

### 4.1 安装包

```
release\Alpha File Manager_3.4.0_x64-setup.exe
20,455,261 字节
sha256  f85d160ab207cb01ffe9efa1c225d9ef1f3c61b914f146da8ad78afc4dcc534c
```

> 本轮因真机验收修缺陷**重打过两次**（20,449,816 → 20,451,441 → 20,455,261 字节），
> 上面的 sha256 是**最终**那次。站点与 GitHub 上的资产都是这个版本。

### 4.2 装机核对

```
D:\Program Files\Alpha File Manager\alpha-file-manager.exe
55,681,536 字节
FileVersion / ProductVersion = 3.4.0
主窗口 6 秒就绪
```

### 4.3 提交

| commit | 内容 |
|---|---|
| `f0fa87cb` | `fix(gate): 单实例守卫验收用例给足 vitest 超时` |
| `d9ec5c69` | `fix(compare-sync): 修掉真机验收暴露的三个缺陷` |
| `eb9da742` | `release: 3.4.0 —— 比较并同步 + 添加网络驱动器` |

### 4.4 发布

- **站点**：版本 3.4.0 已上传，源站与边缘（Cloudflare）**版本号 / 大小 / sha256 三项一致**，
  `version.json` 已生效（`pub_date` 2026-10-22T01:46:52Z，history 13 条）。
  清单与安装包：`E:\办公文件\L1网站\alpha-file-manager\`。
- **GitHub**：<https://github.com/kizemo/alpha-file-manager/releases/tag/v3.4.0>
  —— 正式版（非 draft / 非 pre-release），正文 2380 字符（含构建信息），
  资产 `Alpha_File_Manager_3.4.0_x64-setup.exe` 20,455,261 字节，
  GitHub 侧摘要 `sha256:f85d160a…534c` 与本地一致。
- **标签**：`v3.4.0`（附注标签，指向 `eb9da742`，与 v3.3.0 的写法一致）。
- `origin/main` 已推送到 `eb9da742`。

---

## 5. 遗留与下一步

1. **网络驱动器的显示名取的是服务器卷标**：把 `\\localhost\AFMDrv` 这种共享挂成 Y: 后，
   主页驱动卡片显示的是 **「Win (Y:)」**（「Win」是共享所在卷 C: 的卷标），
   侧边栏盘符条显示的是「Y:」。这是 `drives_platform.rs::append_windows_network_drives` 的**既有行为**，
   本轮没有改。要显示共享名更直观，需要单独一轮。
2. **阶段 A 不含删除**：比较结果只报不删，镜像模式留到阶段 B。
3. **校验和开关在界面上是禁用的**（只有本地↔本地算得出来），阶段 A 不暴露。
4. **其余 15 个语言包的新文案先用英文占位**（`sync-i18n` 只校验 key 对齐），需要母语校对。
5. **验收靶子已复原**（本轮自建的全部删除）：
   - `AFMDrv` SMB 共享 —— 已删除；
   - `afm-netdrive-fixture` —— 已移入回收站；
   - `afm-cmp-left` / `afm-cmp-right` —— 已移入回收站；
   - `afm-cancel-left` / `afm-cancel-right`（含 3.84 GB 大文件）—— 已移入回收站；
   - 盘符映射 Y: —— 已断开（`net use` 为空）。
   - 机器上还有 `afm-acceptance` / `afm-acceptance-fixtures` / `afm-e2e-override-probe` /
     `afm-mcp-spike` / `afm-rust-search-fixtures` —— **是更早几轮留下的，本轮没动**。

### 5.1 验收脚本（`.superpowers/sdd/`，不入库）

| 脚本 | 作用 |
|---|---|
| `accept-netdrive-340.ps1` | 网络驱动器端到端：开入口 → 填表 → 连接 → 系统层核对 |
| `accept-cancel-sample.ps1` | 启动同步 → 延迟取消 → **按文件系统采样**判定是否真的停了 |
| `accept-cancel.ps1` | 同上但不采样（只点取消） |
| `uia-invoke.ps1` | 直接 Invoke 一个 UIA 元素并打印 `IsEnabled` 与异常 |
| `fill-field.ps1` | 点字段 + 剪贴板 + Ctrl+A + Ctrl+V（VK 码与全选都已修） |
| `uia-find.ps1` / `uia-click.ps1` / `uia-list-names.ps1` | UIA 定位与点击 |
| `capture.ps1` / `capture-desktop.ps1` / `crop.ps1` | 截图与裁剪放大 |
| `install-and-launch-3.4.0.ps1` | 静默安装 + 校验版本 + 等主窗口 |

> **验收脚本的三个坑**（都写进注释了）：
> 1. `.ps1` 里**不能有中文** —— PowerShell 5.1 按 ANSI 读无 BOM 文件，
>    中文正则能把解析器搞崩（报 `Unexpected token` + 字符串终止符丢失）。中文一律走命令行参数。
> 2. `PrintWindow` 在进度事件刷爆 WebView2 渲染线程时会返回**陈旧帧** ——
>    实测两次不同的运行都画出「file-00354.dat」。判运行状态要看**文件系统**，不要看屏幕。
> 3. UIA 的 `InvokePattern` 对**禁用**的按钮是静默空操作 ——
>    「点了没反应」先查 `IsEnabled`（`uia-invoke.ps1` 会打印它），别急着当产品 bug。
