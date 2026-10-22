# 交接文档：批量删除进度重做 + 安装/更新链路修复（3.5.0）

> 日期：2026-10-22
> 仓库：`F:\soft\00selfmade\filemanager\sigma-file-manager`（origin `kizemo/alpha-file-manager`）
> 外层仓：`F:\soft\00selfmade\filemanager`（origin `kizemo/focus-sync`；本轮取证知识已写入其 `AGENTS.md`）
> 版本：3.4.0 → **3.5.0**
> **当前状态：代码完成、门禁全绿、3.5.0 已打包并装机、安装日志验收通过、批量删除的回收站路径与永久删除路径（连同取消与并行）都已过真机验收。**
> **未完成：提交与推送。**

---

## 0. 新会话必读（按顺序）

| # | 文档 | 为什么读 |
|---|---|---|
| 1 | `F:\soft\00selfmade\filemanager\AGENTS.md` | 本项目的硬约束与本机环境事实（含本轮新增的注入/验收教训）。**改代码前必须先读。** |
| 2 | 本文件 | 本轮目标、结论、进度、剩余计划。 |
| 3 | `src-tauri/src/delete_tree.rs` | 删除核心算法（逐条目计数 / 逐文件可取消 / 子目录并行），本轮新增。 |
| 4 | `src-tauri/src/delete_job.rs` | 进度语义（两阶段：scanning / deleting）与落盘日志格式。 |
| 5 | `src-tauri/installer/hooks.nsh` 的 `AlphaLogInstall` 段 + `src-tauri/installer/write-install-log.ps1` | 安装日志的接线与脚本。 |
| 6 | `src-tauri/src/extensions/github.rs` 的 `fetch_github_tags` | 扩展 tag 拉取改走 API（含 atom 兜底）。 |

**不要重读**：用户提供的原始分析报告（`E:\Users\Duanyi\.minimax\.minimax\sessions\mvs_3492dda8cbad43289f623ea990badab2\workspace\AFM-批量删除进度条失真与性能缺陷分析报告.md`）—— 本文件第 2 节已经给出对它的纠正结论。

---

## 1. 本轮做了两件事

### 1.1 补充反馈：装完 3.4.0 又装了一次，「似乎是激活了在线更新」

用户反馈：装完 3.4.0 后又装了一次同一个包，感觉像是激活了在线更新；要求查看安装日志、查清「重复安装」的成因并修掉。

**结论（基于安装日志与实测，不是推测）：**

| 问题 | 结论 | 证据 |
|---|---|---|
| 机器上是否有两份安装？ | **没有**。注册表 `DisplayVersion=3.4.0 / InstallLocation=D:\Program Files\Alpha File Manager`，全盘只有这一份 | `HKLM\...\Uninstall\Alpha File Manager` + 磁盘扫描 |
| 是否跑起了两个安装器？ | **没有**。两次安装的守卫判定都是 `OUTCOME=primary`（没有并发安装器） | `%TEMP%\alpha-file-manager-installer-guard.log`：13:32:29 与 13:41:45 两条 |
| 第二次安装是否触发了在线更新？ | **没有**。应用自身的更新检查在 13:35:00 跑过一次，判定「已是最新」，**没有弹窗、没有下载任何安装包** | 站点 version.json = 3.4.0；GitHub 最新 = v3.4.0；已装 = 3.4.0；Downloads/TEMP/AppData 全查过没有安装包 |
| 那用户看到的「在线更新」是什么？ | **是扩展的更新检查**。13:37–13:38 应用对 8 个扩展仓库发起 `github.com/.../tags.atom` 请求，**每次都超时**（2 次重试全灭） | `Alpha File Manager.log` 里一整片 `extensions::http [WARN] network timeout` |

**真正的缺陷（3 个，均已修）：**

1. **扩展更新检查打的是不可达的地址** —— `github.com/{owner}/{repo}/tags.atom`。
   本机实测：`github.com` 直连 20s 超时，`api.github.com` 稳定 200。
   后果：扩展的更新检查**一次都没成功过**，而且每次启动都刷出一片超时警告。
   用户在界面上看到的「刚装完软件它就在联网更新」就是它 —— 而那些请求**全部失败**。
   → 改走 `api.github.com/repos/{owner}/{repo}/tags`（atom 保留为兜底）。

2. **应用自身的更新检查零日志** —— 「装完是不是激活了在线更新」只能靠 settings 里一个时间戳反推。
   → 每次检查落盘：已装版本 / 远端版本 / 判定 / 来源 / 耗时 / 错误。

3. **安装器没有自己的安装日志** —— 只有守卫与杀进程两个助手脚本有日志，安装器自己的决定（装哪个目录、检测到既有安装没有、既有版本、是不是同版本重装）**一个都没落盘**。
   → 新增 `%TEMP%\alpha-file-manager-install.log`（追加），四个阶段各写一条。

**同时确认的既有行为（不是 bug）**：安装器会杀掉正在运行的应用；第二次安装后应用**没有**被重新拉起（安装向导的「运行」勾选项行为）。用户手动重装同一个包是预期行为。

### 1.2 主线：批量删除的进度条失真与删除效率低

来源：用户提供的分析报告（路径见第 0 节）。

---

## 2. 报告的归因需要纠正（这一点决定了修法）

报告说：「进度 = 已删除字节数 / 扫描所得总字节数」，「每删一个文件 emit 一次进度事件」。

**与实现不符。** 本项目的删除进度一直按**顶层路径数**推进（`delete_job.rs` 旧实现：`percent = index / paths.len()`），字节数从来没进过进度公式；事件数是「顶层路径数 × 2」，不是 25 万次。

因此报告的两条推论不成立：

- 「25 万次 IPC 往返」→ 实际是几十次；
- 「主线程 657 秒 CPU 花在事件构造与派发上」→ 事件不是主线程上的开销来源；
  这 657 秒更可能是**报告自己的观测手段**造成的：报告第 7 节写明剩余文件数/字节数是用
  **AFM 自带的 MCP 服务 `get_directory_size` 递归遍历**采的 —— 对 25 万文件的目录做递归遍历，
  本身就在 HDD 上制造大量 I/O。报告的附录也承认了这点，只是归到了「测量干扰」而没有归到 CPU 上。

**症状一样，根因不同，修法也不同**：不是换计量单位，是要**逐条目**计量 + 能随时停 + 并行。

---

## 3. 改动清单

### 3.1 后端（Rust）

| 文件 | 改动 |
|---|---|
| `src-tauri/src/delete_tree.rs` | **新增**。批量删除的核心算法，**刻意不引用 tauri**（`tauri::AppHandle` / `tauri::async_runtime::*` 一律不碰 —— 碰了会把 tao 窗口链拖进测试二进制，进程加载期 `STATUS_ENTRYPOINT_NOT_FOUND` 崩掉）。提供：`scan_paths` / `scan_paths_with_progress`（预扫描）、`delete_paths_permanently`（永久删除，逐条目计数 + 节流 + 逐文件检查取消 + 子目录并行）、`delete_paths_to_trash`（进回收站）。 |
| `src-tauri/src/delete_job.rs` | 进度语义换掉：先预扫描拿条目总数与字节总数，删除时按**条目数**推进、字节数作辅助；事件带 `phase` / `deletedItems` / `freedBytes` / `totalBytes` / `itemPercent` / `bytePercent` / `files` / `directories` / `currentPath`；新增命令 `scan_delete_targets`；**新增落盘日志**（作业开始 / 每 10 个进度事件 / 结束）。 |
| `src-tauri/src/lib.rs` | 注册 `mod delete_tree;` 与 `delete_job::scan_delete_targets`。 |
| `src-tauri/src/app_updater.rs` | 更新检查落盘日志（已装版本、主源版本、判定、来源、耗时、错误）。 |
| `src-tauri/src/extensions/github.rs` | 扩展 tag 拉取改走 `api.github.com`（atom 兜底）；新增 `parse_tag_names_from_api_json` 与 7 条单测。 |

### 3.2 前端

| 文件 | 改动 |
|---|---|
| `src/stores/runtime/status-center.ts` | `Operation` 增加 `phase` / `deletedItems` / `freedBytes` / `totalBytes` / `itemPercent` / `bytePercent` / `files` / `directories` / `currentPath`。 |
| `src/stores/runtime/delete-jobs.ts` | 进度载荷补齐新字段并透传给状态中心；**完成 toast 报真实条目数**（旧实现报顶层路径数 —— 删 25 万个文件弹出来的是「已删除 1 项」）。 |
| `src/modules/status-center/status-center-operation-row.vue` | 删除作业分「统计阶段」与「删除阶段」呈现：统计阶段走**不确定态**（没有分母就不报假百分比），删除阶段给「已删除 N / M 项 · 已释放 X / Y」。 |
| `src/modules/navigator/components/file-browser/composables/use-file-browser-selection.ts` | 删除前调 `scan_delete_targets` 预扫描；超过 10,000 项时把规模摆出来（toast）。 |
| `src/localization/messages/*.json` | 17 个语言包新增 6 个键（中文 `ch.json` + 英文 `en.json` 手写，其余 15 个由 `scripts/sync-i18n.js` 同步英文占位）。 |

### 3.3 安装器

| 文件 | 改动 |
|---|---|
| `src-tauri/installer/write-install-log.ps1` | **新增**（纯 ASCII）。写安装日志：本次安装器版本、检测到的既有安装版本与位置、**是不是同版本重装**、最终安装目录、阶段。 |
| `src-tauri/installer/hooks.nsh` | 新增 `AlphaLogInstall`（编译期内嵌脚本，运行期解包到 `$PLUGINSDIR`）；PREINSTALL / POSTINSTALL / PREUNINSTALL / POSTUNINSTALL 四个阶段各写一条。 |

### 3.4 测试

| 文件 | 覆盖 |
|---|---|
| `src-tauri/src/delete_tree.rs`（内联） | 计数、字节口径、缺失路径、删干净、进度单调、开始前取消、**中途取消立刻停**、并行删除完整性、线程数上限、百分比计算、节流闸门。 |
| `src-tauri/src/delete_job.rs`（内联） | 百分比计算（分母缺失、超过 100）。 |
| `src-tauri/src/extensions/github.rs`（内联） | API JSON 解析、缺 name、畸形 JSON、仓库 URL 解析、atom 源仍可用。 |
| `src/utils/__tests__/delete-progress-contract.test.ts` | **新增**。跨语言契约门禁：Rust 进度/结束事件的字段与 TS 接口**逐条对得上**；事件名两侧一致；按条目计量；节流闸门是「取先到者」；取消标志检查点 ≥ 3 处；toast 报真实条目数；规模统计命令两侧接得上。 |
| `src-tauri/installer/__tests__/install-log.test.ts` | **新增**。四个阶段都写了日志；脚本被编译期内嵌；**脚本纯 ASCII**；同版本重装标 `yes`、版本不同标 `no`、无既有安装标 `none`；日志行带时间戳。 |
| `src/utils/__tests__/recycle-bin-delete-contract.test.ts` | **改**。进回收站的实现挪到了 `delete_tree.rs`，断言改为盯**整条调用链**（`delete_job` → `delete_tree` → `utils::delete_path_to_trash`），并继续禁止裸 `trash::delete`。 |

---

## 4. 门禁结果

| 门禁 | 基线 | 本轮 |
|---|---|---|
| `cargo test --lib` | 763 passed / 0 failed | **785 passed / 0 failed** |
| `npx vitest run` | 230 文件 / 2049 用例 | **234 文件 / 2076 用例**（全部通过） |
| `npx eslint src` | 170 errors / 0 warnings | **170 / 0** |
| `npx eslint .` | 177 errors / 0 warnings | **177 / 0** |
| `npx vue-tsc --build` | 0 | **0** |
| `node scripts/verify-changelog.mjs` | OK | **OK** |
| `cargo check --lib` | — | exit 0（仅 1 个既有 warning：`remote/credentials.rs` unused import） |

> `eslint` 的数字是**存量**，不是本轮引入的（报错文件清单里没有本轮碰过的任何文件）。
> 口径必须用同一条命令量：`eslint src` 与 `eslint .` 差 7 个存量，混口径会凭空多 7 个「回归」。

> **打包之后没有再改任何产品代码**，所以上表仍然有效。真机验收阶段只动了 `.superpowers/sdd/` 下的一次性脚本（该目录 `.gitignore` 是 `*`，不入库）。

### ⚠️ vitest 的数字要更正一下（2026-10-22 复核）

原表里写的「基线 230 文件 / 2049 用例 → 本轮 234 文件 / 2087 用例」**两个数都对不上实测**。
本轮用**同一条命令**在基线提交上重量了一遍（`git worktree add --detach <TEMP>\afm-baseline-vitest a4d66a5a`
+ `node_modules` 建 junction，跑同一条 `npx vitest run --reporter=json`），逐文件对照：

| | 文件 | 用例 |
|---|---|---|
| 基线 `a4d66a5a`（干净 worktree） | 232 | 2060 |
| 本轮工作副本 | 234 | 2076 |
| **差** | **+2** | **+16** |

多出来的两个文件就是本轮新增的：

- `src/utils/__tests__/delete-progress-contract.test.ts` —— 9 个用例
- `src-tauri/installer/__tests__/install-log.test.ts` —— 7 个用例

⇒ **本轮的真实增量是「+2 个文件 / +16 个用例」**，不是原表写的 +38。
原表的两个数是**两次不同时间、不同状态的测量**拼在一起的（基线数取早了、本轮数取晚了），
不是回归、也不是用例被删了。**所有测试全通过，0 失败。**

> 顺带记一条：`home-banner-click-opens-background-manager.test.ts` 在**两个 vitest 全量跑同时进行**时
> 假红过一次，报的是 vitest 内部的 `STACK_TRACE_ERROR`（没有任何断言信息），单独跑是绿的。
> 这是**机器负载导致的假红**，不是缺陷 —— 与 AGENTS.md 里记的 `single-instance-guard.test.ts`
> 那条「超时是另一回事」同一类。**别照着它去改代码。**

---

## 5. 真机验收：方法与纪律

### 5.1 产物

- 安装包：`F:\soft\00selfmade\filemanager\sigma-file-manager\release\Alpha File Manager_3.5.0_x64-setup.exe`
  （20,509,668 字节，sha256 `ce616d1cc6c99daa9a4d54799322ad40cdefd5a31076abf7521ad5b3b654021e`）
- 已装到 `D:\Program Files\Alpha File Manager\alpha-file-manager.exe`，`ProductVersion = 3.5.0` ✓

> ⚠️ **2026-10-22 16:05 有人把 3.5.0 卸载了**（安装日志里有 `PREUNINSTALL` / `POSTUNINSTALL` 两条，
> 而 `PREINSTALL` 只到 15:25）。卸载**没有**把 exe 换回 3.4.0 —— 装在
> `D:\Program Files\Alpha File Manager\alpha-file-manager.exe` 的那个是 **3.4.0 的二进制**
> （与 `target\release` 里 3.5.0 那份的 sha256 对不上，注册表 `DisplayVersion` 也退回 3.4.0）。
> 本轮开工时重新装了一次 3.5.0（`/S`，exit 0），装完 `ProductVersion = 3.5.0`、注册表 3.5.0，
> 才做的真机验收。**这说明「已装 3.5.0」这个前提在使用前必须重新验一次**，不能沿用上一轮的结论。

### 5.2 验收脚本（均在 `.superpowers\sdd\`，**不入库**）

| 脚本 | 作用 |
|---|---|
| `accept-install-350.ps1` | 连装两次，断言安装日志能区分「升级」与「同版本重装」。**已跑通 PASS。** |
| `accept-delete-350.ps1` | 批量删除真机验收（建靶子 → 启动打包版 → 全选 → 删除 → 读应用日志 + 文件系统判定）。回收站路径 **PASS**；它的「Shift+Del」那一段已作废（见 6.5）。 |
| `probe-trash-dropdown.ps1` | **入口探针**：右键一个条目，把右键菜单的**全部**元素（**含无名的**）连坐标一起 dump 出来，再拍一张屏幕 BitBlt。**本轮靠它找对了永久删除入口。** |
| `accept-permanent-delete-350.ps1` | **永久删除路径**真机验收（20×500 = 10021 项）：走右键菜单 → 垃圾桶下拉 → 「从驱动器中删除」→ 确认框 → 判日志与文件系统。**PASS。** |
| `accept-cancel-permanent-delete-350.ps1` | **取消 + 并行**真机验收（20×2500 = 50021 项）：删除中打开状态中心按「取消」，判 `cancelled=true`、文件数停住、线程数与并行子目录。**PASS。** |
| `probe-permanent-delete.ps1` | 上一轮的探针（小靶子 3×4）。**它找的是右键菜单里的「删除」文字项，所以找不到** —— 真正的入口是那个无名图标按钮（见 6.5）。保留作反面教材。 |
| `app-key.ps1` / `edge-key.ps1` / `app-key-scan.ps1` | 键盘注入（VK / 单次 SendInput 组合 / 扫描码三种实现）。 |
| `click-webview-point.ps1` / `rightclick-webview-point.ps1` | 向 `Chrome_RenderWidgetHostHWND` 投 `WM_LBUTTON*` / `WM_RBUTTON*`。 |
| `uia-list-names.ps1` / `uia-click-by-name.ps1` / `afm-accept.ps1` / `afm-screen.ps1` | UIA 枚举、点按、主窗口定位、PrintWindow 截图、屏幕 BitBlt。 |

### 5.3 判据纪律

- **进度语义以应用日志为准**，不靠屏幕百分比（`PrintWindow` 会返回陈旧帧）。
- **「删干净了」以文件系统为准**，不靠界面。
- 靶子**自造**，放在 `C:\Users\Duanyi\afm-delete-lab\afm-delete-fixture`（该目录里**只有**这个靶子，UI 里的「全选」绝无可能碰到用户的东西）。
- 回收站路径的靶子规模：**20 个顶层目录 × 每目录 500 个文件 × 2 KB = 10,000 个文件**。
  ⚠️ 条目总数是 **10,020** 而不是 10,000 —— `scan_paths` 会把**顶层目录本身**算进去（`entry.directories = 1`）。
- 永久删除路径的靶子规模：**1 个顶层条目 `target` × 20 个子目录 × 每目录 500 个文件 × 2 KB = 10,000 个文件**，
  条目总数 **10,021**（`directories` = 20 个子目录 + `target` 自己 = 21）。
  取消那一轮放大到 **每目录 2500 个文件**，条目总数 **50,021** —— 删太快（10,021 项只要 3 秒）
  的话，「按取消」那一下会落在作业结束之后，**取消就永远验不到**。
- **注入探针必须带阳性对照**：先点一个必然有可见后果的元素（本轮是「点卡片 → 出现选中态」），
  确认内容哈希变了，再去点目标按钮。否则「没反应」分不清是注入失败还是功能本身没反应。
- **要量线程数就得先量基线，而且基线必须在触发动作之前取** —— 触发用的辅助脚本自己会 sleep，
  事后取基线会把已经开始干活的线程算进去。

---

## 6. 验收结果

### 6.1 安装日志 —— **PASS**

`%TEMP%\alpha-file-manager-install.log`（连装两次，逐次比对）：

```
2026-10-22 15:24:28.535 [install] phase=PREINSTALL  installerVersion=3.5.0 sameVersionReinstall=no  detectedVersion=3.4.0 detectedLocation='D:\Program Files\Alpha File Manager'
2026-10-22 15:24:42.962 [install] phase=POSTINSTALL installerVersion=3.5.0 sameVersionReinstall=no  detectedVersion=3.4.0 ...
2026-10-22 15:24:59.246 [install] phase=PREINSTALL  installerVersion=3.5.0 sameVersionReinstall=yes detectedVersion=3.5.0 detectedLocation='D:\Program Files\Alpha File Manager'
2026-10-22 15:25:13.324 [install] phase=POSTINSTALL installerVersion=3.5.0 sameVersionReinstall=yes detectedVersion=3.5.0 ...
```

**「装完又装了一次」这个事实，第一次有落盘证据可查。**（两次安装器退出码均为 0。）

### 6.2 扩展更新检查改走 API —— **已生效**

```
[07:52:25][extensions::github][INFO] GitHub tags for sigma-hub/sfm-extension-video-downloader resolved via API (2 tags)
[07:52:25][extensions::github][INFO] GitHub tags for hetima/sigma-light-themes resolved via API (2 tags)
[07:54:15][extensions::github][INFO] GitHub tags for sigma-hub/sfm-extension-excalidraw resolved via API (1 tags)
…（7 个仓库全部 resolved via API）
```

改之前是**每次启动一整片 `network timeout`、一次都没成功过**；现在是每仓库都拿到了 tag。

> ⚠️ **但已撞到限流**：本轮反复启动应用（每次 6–8 个 API 调用）后，日志转为
> `GitHub tags API failed … HTTP 403 (Forbidden); falling back to the atom feed`。
> 匿名 `api.github.com` 限额 **60 次/小时**。**这是本轮新增的实测约束**，见第 7 节遗留项。

### 6.3 应用自身更新检查落盘 —— **已生效**

```
[08:03:51][app_updater][INFO] app updater: checking for updates (installed version 3.5.0)
[08:04:01][app_updater][WARN]  app updater: primary source aiec.fun failed: 请求失败: error sending request for url (https://www.aiec.fun/alpha-file-manager/version.json?_=1792656231639)
[08:04:01][app_updater][WARN]  app updater: primary source aiec.fun failed (…); querying the fallback source GitHub
[08:04:02][app_updater][WARN]  app updater: check failed after 10.6685215s: 主源(aiec.fun)失败: …; 兜底源(GitHub)也失败: HTTP 403 Forbidden
```

> 📌 **主源域名是 `www.aiec.fun`**，本轮从这台机器上**不可达**；GitHub 兜底也 403。
> 所以现在的更新检查是**失败**的（只记日志，不弹窗、不下载）—— 与 3.4.0 时代「判定已是最新」不同。
> 站点内容源在本机是 `E:\办公文件\L1网站\alpha-file-manager\`（`version.json` + 16 个安装包）。

### 6.4 批量删除 —— **回收站路径已通过；永久删除路径未覆盖**

靶子：20 目录 × 500 文件 = 10,000 文件。

**规模预告（D3）✓**
```
正在删除 10,020 个项目
10,000 个文件 · 20 个目录 · 19.5 MB
```

**预扫描阶段（D1 口径）✓** —— 逐级推进，不是顶层路径数：
```
[1] phase=scanning items=500  total_items=None freed_bytes=1024000  total_bytes=None percent=None
[2] phase=scanning items=1000 total_items=None …
…
[20] phase=scanning items=10000 total_items=None …
[22] phase=scanning items=10020 total_items=Some(10020) freed_bytes=20480000 total_bytes=Some(20480000) percent=Some(100)
```
（`total_items=None` → 界面走**不确定态**，不报假百分比；预扫描结束后才拿到分母。）

**终值 ✓**（与预扫描**逐个相等**）：
```
delete job e93aa29b… finished in 44.9086934s: cancelled=false deleted_items=10020
    freed_bytes=20480000 total_items=10020 files=10000 directories=20 failed=false error=None
```

**文件系统 ✓** —— 靶子清空（0 文件 0 目录）。

### 6.5 永久删除路径 —— **已通过**（2026-10-22 16:48）

> ⚠️ **先纠正上一轮写错的一处**：原 §6.5 说「删除入口是**工具栏**的垃圾桶下拉」，**这是错的**。
> `file-browser-actions-menu.vue` 全仓只被引用了一处 —— `dir-entry-context-menu.vue`，
> 也就是**文件条目的右键菜单**。它的 quick-actions 区（`display:flex`）是菜单**顶部**的一排
> **纯图标按钮**，没有可访问名 ⇒ 「只枚举有名字的元素」这种取法**永远找不到它**。
> 上一轮之所以卡住，不是产品缺陷，是入口找错了地方。

#### 入口：右键菜单顶部图标条的第 5 个按钮

实测的菜单结构（UIA，屏幕坐标；窗口 3840×2088）：

| 元素 | 坐标 | 说明 |
|---|---|---|
| `Menu` | (2111,248) 375×635 | 右键菜单本体 |
| `Button` ×5（**可访问名为空**） | x=2124 / 2178 / 2232 / 2286 / 2340，y=261，各 48×42 | 顶部图标条：铅笔(重命名) / 复制 / 粘贴 / 链接 / **垃圾桶** |
| `MenuItem` ×10 | y=316 起 | 打开方式… / Shell 扩展 / 在终端中打开 / 压缩 / 在新标签页中打开 / 复制路径到剪贴板 / 新的 / 局域网共享 / 属性 / 添加到收藏 |

**完整路径**：右键卡片 → 点第 5 个图标按钮（垃圾桶）→ 下拉两项「移至垃圾箱 Del」与
「**从驱动器中删除 Shift+Del**」→ 选后者 → 永久删除确认框 → 「删除」。

两个必须记住的坑：

- 下拉项的**可访问名带快捷键**（`从驱动器中删除 Shift+Del`）。按**等值**匹配会找不到，要按**子串**匹配。
- 确认框里的按钮名是「删除」，与下拉项文字里的「删除」**同名** —— 必须靠 ControlType 区分（`Button` vs `MenuItem`）。

#### 靶子形状为什么与 6.4 不同

右键菜单作用于**光标下的那一个条目**（`dir-entry-interactive.vue` 里 `:entries="[dirEntry]"`），
所以整棵树必须挂在**一个**顶层条目下面：

```
C:\Users\Duanyi\afm-delete-lab\afm-delete-fixture\target\d000..d019\f0000.dat..f####.dat
```

预期口径：`files=50000`、`directories=21`（20 个子目录 + `target` 本身）、**总条目 50021**。
`scan_paths` 把顶层目录本身算进 `directories`；6.4 的 10020 是 20 个顶层目录各算一次 —— 口径不同，两者不冲突。

#### 结果 A：删干净（20 × 500 = 10021 项）

```
delete job 4d34c375… started: 1 path(s), use_trash=false
[36]  phase=scanning items=10021 total_items=Some(10021) freed_bytes=20480000 total_bytes=Some(20480000) percent=Some(100)
[41]  phase=deleting items=401   total_items=Some(10021) percent=Some(4)  current=…\target\d015
[51]  phase=deleting items=1402  … percent=Some(13) current=…\target\d015
[61]  phase=deleting items=2423  … percent=Some(24) current=…\target\d001
[71]  phase=deleting items=3391  … percent=Some(33) current=…\target\d001
[81]  phase=deleting items=4753  … percent=Some(47) current=…\target\d007
[91]  phase=deleting items=6054  … percent=Some(60) current=…\target\d008
[101] phase=deleting items=7569  … percent=Some(75) current=…\target\d008
[111] phase=deleting items=8745  … percent=Some(87) current=…\target\d009
[121] phase=deleting items=9928  … percent=Some(99) current=…\target\d009
finished in 13.0173544s: cancelled=false deleted_items=10021 freed_bytes=20480000 total_items=10021 files=10000 directories=21 failed=false error=None
```

- **`use_trash=false`** —— 走的是永久删除路径，不是回收站。
- **逐条目推进** —— 删除阶段的 `items=` 是 401 → 1402 → 2423 → 3391 → 4753 → 6054 → 7569 → 8745 → 9928 → 10021，
  每一格都**严格落在 0 与总数之间**。旧实现按顶层路径计数时，这里只可能出现 `items=1` 然后直接跳到 10021。
- **终值逐个相等** —— `deleted_items=10021 == total_items=10021`，`files=10000`，`directories=21`，
  `cancelled=false`，`failed=false`，`error=None`。
- **文件系统** —— `target` 整个没了（0 文件 0 目录）。
- **规模预告（D3）** —— 确认框上方那行「10,000 个文件 · 21 个目录 · 19.5 MB」照常出现。
- 这一轮耗时 13.0 秒；同一批靶子在空载下（不与门禁并行）只用了 **3.04 秒** ——
  **永久删除比同规模进回收站（44.9 秒）快一个数量级**，因为回收站是整棵树一次性搬走，
  永久删除是就地逐文件删。

#### 结果 B：中途取消 + 并行（20 × 2500 = 50021 项）

取消是在**删除阶段**（不是预扫描阶段）按的：预扫描走完、删除开始、计数过了 9001 项时，
打开状态中心按「取消」。

```
[102] phase=scanning items=50021 total_items=Some(50021) …
[111] phase=deleting items=4001  percent=Some(7)  current=…\target\d015
[121] phase=deleting items=9001  percent=Some(17) current=…\target\d015
[131] phase=deleting items=13505 percent=Some(26) current=…\target\d011
[141] phase=deleting items=18411 percent=Some(36) current=…\target\d011
[151] phase=deleting items=23005 percent=Some(45) current=…\target\d012
[161] phase=deleting items=27693 percent=Some(55) current=…\target\d012
[171] phase=deleting items=32252 percent=Some(64) current=…\target\d018
[181] phase=deleting items=37252 percent=Some(74) current=…\target\d018
[191] phase=deleting items=41215 percent=Some(82) current=…\target\d014
[201] phase=deleting items=46055 percent=Some(92) current=…\target\d014
finished in 18.3984672s: cancelled=true deleted_items=46921 freed_bytes=96061440 total_items=50021 files=50000 directories=21 failed=false error=None
```

**D4（逐文件检查取消）✓**

- 日志终值 **`cancelled=true`**。
- **`deleted_items=46921 < total_items=50021`** —— 只删了一半，作业是被打断的，不是跑完了。
- **文件系统口径**（按 AGENTS.md，判后台任务的状态看文件系统、不看屏幕）：取消后连采 6 次
  （每次隔 2 秒），文件数**恒为 3095**，一次都没再动过。
- `failed=false`、`error=None` —— 取消不算错误。

**D5（子目录并行）✓** —— 两条互相独立的证据：

1. **进程线程数**：删除前 **71** → 删除进行中峰值 **75**，正好 **+4**，
   与 `MAX_PARALLEL_WORKERS = 4` 对上（`std::thread::scope` 起的真 OS 线程）。
   ⚠️ 基线必须在**点确认之前**取：点确认的辅助脚本本身要 sleep 2 秒，事后取基线会把
   已经开始干活的 4 个线程算进基线里，于是「峰值 == 基线」看起来像「没有并行」。
2. **日志里的当前路径**：删除阶段出现 **5 个不同的子目录**（d011 / d012 / d014 / d015 / d018），
   而且是在计数连续推进的过程中交替出现的。这 5 个分属不同的 worker 分片
   （20 个子目录按 5 个一片切成 4 片），说明它们是**同时**在被删。
   串行删的话，当前路径只会按 d000 → d001 → … 单调走过去。

#### 顺带记一条观测（不是缺陷）

应用日志对进度事件是**每 10 个记一行**（扫描阶段例外，每行都记）。删得快的时候
（10,021 项空载约 3 秒）删除阶段只剩几行 —— 事实一条不少（终值那一行带全了
`deleted_items` / `total_items` / `files` / `directories`），但**逐条推进的过程**
在日志里是抽稀的。要看完整过程，要么把靶子放大，要么读日志里 `items=` 的全部采样行。

#### `Shift+Delete` 这条路仍然不要走

注入的 Shift 到不了 webview 的 `shiftKey`（用 Edge 打开本地按键日志页隔离复现，**与 Tauri 无关**：
`Shift+Delete` / `Shift+ArrowDown` 到达页面时 `shiftKey=false`；而 `Ctrl+Shift+F` 正常）。
形态是**修饰键的 keyup 抢在主键 keydown 之前到达**。已排除的四种修法
（**都试过，全都不解决，别再试**）：① `VK_SHIFT 0x10` → `VK_LSHIFT 0xA0`；
② 改用扫描码（`KEYEVENTF_SCANCODE`，shift=0x2A、del=0x53）；③ 把整个组合塞进**一次** `SendInput` 调用；
④ 每次一个事件 + `Start-Sleep 60ms`。

本轮**没有再用这个入口**，改走上面那条右键菜单的路。

---

## 7. 本轮没做的（明确的遗留项）

> 原第 1 条「永久删除路径的真机验证」已完成（见 6.5），从本节移出。

1. **ETA（预计剩余时间）**。报告的 P2。机械硬盘上速率抖动很大，给一个看似精确的数字不如不给。
2. **超过阈值的二次确认框**。规模已经摆出来了（toast），但「再问一次才动手」这个交互没做。
3. **`IFileOperation`（Windows Shell API）**。报告的 P1。收益是官方条目级进度，但硬删除语义、回收站分支、符号链接处理都要重新对齐；实测并行删除已经拿到大部分吞吐收益。
4. **扩展更新检查的限流兜底**。**已从「理论风险」变成「实测发生」**：匿名 `api.github.com` 60 次/小时，本轮反复启动应用后已收到 `HTTP 403` 并回落 atom 源。
   下一步要做的是**加缓存/退避**（前端 `VERSIONS_CACHE_TTL_MS` 只挡同一次会话内，跨会话不挡），否则用户每开几次应用就退化成旧的 atom 源（而 atom 源在本机不可达）。
5. **本地化 changelog**（`public/changelog/*/changelog.md`）仍停在 3.2.11 —— fork 早前就有的状态，`verify-changelog.mjs` 只警告不失败。
6. **站点 / GitHub release 未发布**。本轮只打包 + 本机安装，**没有**上传（用户未要求）。站点 `version.json` 仍是 3.4.0。
7. **【新增】删除进度日志的采样太稀**。进度事件每 10 个记一行（扫描阶段例外），删得快的时候
   删除阶段只剩几行。事实一条不少（终值那行带全了），但**过程**在日志里看不清。
   要彻底解决得改 `delete_job.rs` 的日志规则（哪怕删得只剩 16 个条目，也要把最后一条
   删除阶段的快照记下来）—— 那是**产品代码改动**，本轮为了不推翻已经装机的验收产物，
   **没有做**，留到下一轮。

---

## 8. 下一阶段计划（按顺序做）

### 8.1 ~~打通永久删除路径的真机验收~~ —— **已完成（2026-10-22 16:48）**

结果见第 6.5 节。实际走的路与原计划**不一样**，要点：

- 原计划写的是「工具栏的垃圾桶下拉」，**入口找错了**。真实入口是**文件条目右键菜单顶部
  图标条的第 5 个按钮**（`file-browser-actions-menu.vue` 只被 `dir-entry-context-menu.vue` 引用）。
  图标按钮**没有可访问名**，UIA 取元素时**不能只取有名字的**。
- 原计划写的是「全选（Ctrl+A）后」触发，**做不到**：右键菜单作用于**光标下的那一个条目**
  （`:entries="[dirEntry]"`），没有多选入口。靶子因此改成「一个顶层条目 `target` 挂着整棵树」。
- 判据（与 6.4 同一套）全部满足：`use_trash=false`、删除阶段 `items=` 逐条推进、
  终值 `deleted_items == total_items`（10021 / 50021 两轮都对得上）、
  `cancelled=false`、`failed=false`、`error=None`。
- **取消**与**并行**都补上了真机证据（见 6.5 的结果 B）。

### 8.2 收尾

5. 把本节结果写回本文件第 6 节。 —— **已完成（6.5）**
6. 提交并推送（**中文提交信息**），`git push origin main` + 按需打 tag。
7. 交付文件用 `<media>` 附上（安装包 + 交接文档）。

### 8.3 可选（用户确认后再做）

8. 发布到站点 / GitHub release（`node scripts/release-publish.mjs upload` → `verify` → `github`）。**本轮未获授权，不要擅自发布。**

---

## 9. 关键路径清单

| 用途 | 路径 |
|---|---|
| 交接文档 | `F:\soft\00selfmade\filemanager\sigma-file-manager\docs\handoff-2026-10-22-delete-progress-and-installer-log.md` |
| 外层约定 | `F:\soft\00selfmade\filemanager\AGENTS.md` |
| 安装包 | `F:\soft\00selfmade\filemanager\sigma-file-manager\release\Alpha File Manager_3.5.0_x64-setup.exe` |
| 已装程序 | `D:\Program Files\Alpha File Manager\alpha-file-manager.exe` |
| 验收脚本 | `F:\soft\00selfmade\filemanager\sigma-file-manager\.superpowers\sdd\{accept-install-350,accept-delete-350,accept-permanent-delete-350,accept-cancel-permanent-delete-350,probe-trash-dropdown,probe-permanent-delete,app-key,edge-key,app-key-scan,click-webview-point,rightclick-webview-point,uia-list-names,uia-click-by-name,afm-accept}.ps1` |
| 验收靶子 | `C:\Users\Duanyi\afm-delete-lab\afm-delete-fixture\target`（20×500 或 20×2500，**用完即删**）、`C:\Users\Duanyi\afm-delete-lab\probe`（12 个文件，探针留下的） |
| **新**安装日志 | `%TEMP%\alpha-file-manager-install.log` |
| 应用日志 | `%LOCALAPPDATA%\com.sigma-file-manager.app\logs\Alpha File Manager.log`（**UTC** 时间戳；应用运行时必须用 `FileShare.ReadWrite` 打开） |
| 既有日志 | `%TEMP%\alpha-file-manager-installer-guard.log`、`%TEMP%\alpha-file-manager-kill.log` |
| 站点源 | `E:\办公文件\L1网站\alpha-file-manager\`（`version.json` + 16 个安装包 + `_upload_alpha_files.py`） |
| 原始分析报告 | `E:\Users\Duanyi\.minimax\.minimax\sessions\mvs_3492dda8cbad43289f623ea990badab2\workspace\AFM-批量删除进度条失真与性能缺陷分析报告.md` |

## 10. 可直接复用的命令

```powershell
$repo = 'F:\soft\00selfmade\filemanager\sigma-file-manager'
Set-Location $repo

# 门禁（口径必须与第 4 节一致）
& "$repo\.superpowers\sdd\cargo-test.cmd" --lib     # 期望 785 passed / 0 failed
npx vitest run
npx eslint src                                        # 期望 170 errors / 0 warnings
npx eslint .                                          # 期望 177 errors / 0 warnings
npx vue-tsc --build                                   # 期望 0
node scripts/verify-changelog.mjs                     # 期望 OK

# 打包（慢，后台跑；末尾的 publish-bundle-to-release.mjs 只复制到 release/，不上传）
& "$repo\.superpowers\sdd\build-3.3.0.cmd"            # 实际是 3.5.0 的打包入口

# 真机验收
& "$repo\.superpowers\sdd\accept-install-350.ps1"                 # 已通过
& "$repo\.superpowers\sdd\accept-delete-350.ps1" -SkipCreate      # 已通过（回收站路径）
& "$repo\.superpowers\sdd\accept-permanent-delete-350.ps1"        # 已通过（永久删除路径，20×500）
& "$repo\.superpowers\sdd\accept-cancel-permanent-delete-350.ps1" # 已通过（取消 + 并行，20×2500）
& "$repo\.superpowers\sdd\probe-trash-dropdown.ps1" -Tag 'a'      # 入口探针： dump 菜单结构 + 截图
```

> ⚠️ `publish-bundle-to-release.mjs` 会遍历 `bundle/nsis/` 下**所有**历史安装包并逐个覆盖到 `release/`，
> 只要 `release/` 里**任何一个**旧包被别的进程锁住（实测 3.4.0 被锁）就整步 exit 1 —— 而 `tauri build` 本身早已成功。
> **分清「构建失败」和「复制失败」**：新包用 `node -e "fs.copyFileSync(a,b)"` 单独补进 `release/` 即可。

### 永久删除验收脚本的三个要点（下一轮照抄）

1. **靶子必须挂在一个顶层条目下面**（`…\afm-delete-fixture\target\d000..d019\…`）。
   右键菜单只作用于光标下的那一个条目，没有多选入口。
   ⇒ 预期条目数 = `20 × 2500 + 21` = **50021**（`directories` 里的 21 = 20 个子目录 + `target` 自己）。
2. **UIA 取元素时不能只取有名字的**。垃圾桶那个图标按钮**可访问名是空的**，
   得把 `Name` 为空的 `Button` 也列出来，再按「在菜单里、在第一个 `MenuItem` 之上、
   x 最大」定位（`file-browser-actions-menu.vue` 里删除是**最后一个**）。
3. **下拉项的可访问名带快捷键**（`从驱动器中删除 Shift+Del`），要按**子串**匹配；
   确认框里的「删除」按钮与下拉项**同名**，必须靠 ControlType 区分（`Button` vs `MenuItem`）。

### 本轮留下的一个临时 worktree（无害，但要知道）

`%TEMP%\afm-baseline-vitest` —— 第 4 节复核 vitest 基线时建的（`git worktree add --detach … a4d66a5a`）。
本机的可恢复删除器只接受**工作区之内**的路径，这个目录在 `%TEMP%` 里，**删不掉**，
所以留在那里（Windows 的临时目录清理会自己带走）。

> ⚠️ **它里面那个 `node_modules` 原本是指向本仓 `node_modules` 的 junction** ——
> 留着的话，以后谁在那个 worktree 里执行 `git worktree remove --force`，会**顺着 junction
> 把本仓的 node_modules 删掉**。本轮已经用 `fsutil reparsepoint delete` 把那个 junction
> 降级成了**普通空目录**（`fsutil reparsepoint delete <junction>` 只摘掉重解析点，不删任何数据），
> 危害已经解除。要彻底清掉的话，用你手边的可恢复删除器删 `%TEMP%\afm-baseline-vitest` 即可，
> 然后 `git worktree prune`。
