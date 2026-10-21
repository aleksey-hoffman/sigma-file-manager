# 交接文档：上游 B 类改动移植（2026-10-20）

## 0. 本轮范围

**来源**：上一轮把上游 `sigma-file-manager` 的 23 个领先提交分成 A（直接引入）/ B（需二次开发）/ C（无意义）/ D（需拍板）四类，本轮做 **B 类**。

B 类对应 5 组上游提交：

| 组 | 上游提交 | 内容 | 上游规模 | 本轮 |
|---|---|---|---|---|
| B4 | `9560da51` + `5f678f8b` | 窗口状态修复（全屏/最大化状态坏掉 + 双击顶栏不切换最大化） | 250 行 / 8 文件 | **已完成** |
| B2 | `588165e6` | Shift+方向键连选 | 363 行 / 7 文件 | **已完成** |
| B3 | `0ae258d6` | 回收站不可用时先确认再永久删除 | 631 行 / 8 文件 | **已完成** |
| B1 | `8908e214` + `1305d81d` + `979d6e2c` + `2b8bed43` | e2e 数据隔离（`SFM_E2E_DATA_DIR`） | 779 行 / 19 文件 | **已完成** |
| B5 | `3eca4c17` + `4a33b290` | 仪表盘改版（标签视图） | 4836 行 / 74 文件 | **未做，见 §5** |

**为什么 B5 没做**：它不是「移植」，是「重做」。上游把仪表盘整个换掉了（新增 `dashboard-top-bg.jpg`、hero 区、标签侧栏、类型筛选、标签视图、条目预览/尺寸等 74 个文件），而我们的 `dashboard.vue` 是 829 行、上游改后是 511 行、两者已有 68 个 hunk 的差异 —— **方向已经不同**。硬套上去会同时丢掉我们分叉上的东西并引入上游的设计决策，需要单独一轮的设计讨论（见 §5）。

---

## 1. B4：窗口状态修复

### 1.1 上游改了什么

上游把窗口状态的恢复拆成了**三段**（先框 → 塞进工作区 → 再恢复其余），并修了两处交互：

- 双击顶栏空白处不能切换最大化；
- 最大化按钮可能让窗口**既全屏又最大化**（`set_fullscreen(true)` 之后又 `maximize()`）。

### 1.2 我们的移植方案

新增 `src-tauri/src/main_window_state.rs`（上游原样 + 本仓适配）：

| 函数 | 作用 |
|---|---|
| `state_flags()` | 交给 `tauri-plugin-window-state` 的状态标志 |
| `restore_main_window_state()` | 分三段恢复：先套外框 → 夹进工作区 → 再恢复其余 |
| `fit_restored_frame_to_work_area()` | 把恢复出来的外框收进工作区 |
| `centered_offset()` | 居中时的偏移量 |
| `apply_startup_maximized()` | **本仓新增**（见下） |

`src-tauri/src/lib.rs` 的插件改为 `.with_state_flags(...).with_denylist(&["quick-view"]).skip_initial_state("main")`；`setup_handler` 改成先 `restore_main_window_state` → （非隐藏时）`apply_startup_maximized` → `show()`。

### 1.3 与上游的**刻意**差异：启动默认最大化

上游的语义是「恢复你上次离开时的状态」。**本仓 2026-10-11 明确做了「启动默认最大化」**，并写了注释说明原因（插件会在 setup 阶段恢复上次尺寸并覆盖 conf 初值，所以要显式 `maximize()`，且**必须在 `show()` 之前**，否则先闪小窗再放大）。

**决定：保留本仓的「一律最大化」**，不改成上游的「恢复上次状态」。做法是在恢复之后显式 `apply_startup_maximized()`，并且**先 `set_fullscreen(false)` 再 `maximize()`** —— 否则会落进「既全屏又最大化」的怪状态（正是上游这次要修的那个）。

### 1.4 另一处本仓特有的坑：顶栏空白处的 CSS 优先级

上游修「双击顶栏不切换最大化」的方式是让顶栏空白处成为**原生拖拽区**（原生拖拽区才认双击）。本仓的 `window-toolbar.vue` 里，`.window-toolbar-spacer` 与 `.window-toolbar-action-layer :deep(*)` 的**优先级相同 (0,2,0)**，后者在后 → spacer 实际一直是 no-drag。

改成 `.window-toolbar-action-layer > .window-toolbar-spacer` 后优先级变成 (0,4,0)，才真正成为原生拖拽区。

模板与上游完全一致：只有一个 `<Spacer class="window-toolbar-spacer" />`，位于 `.window-toolbar-action-layer` 内。

### 1.5 端口确认

`tauri-plugin-window-state` 本仓版本 `~2.4`（实为 2.4.1）**有** `skip_initial_state(label)`，语义是「只跳过启动时自动套用，**保存照旧**」；也有 `with_filename(...)` 与 `DEFAULT_FILENAME`（B1 用了后者）。已读 2.4.1 源码确认。

---

## 2. B2：Shift+方向键连选

### 2.1 三层结构

| 层 | 文件 | 改动 |
|---|---|---|
| 1. 快捷键匹配 | `src/stores/runtime/shortcuts.ts` | 整份取上游修好版本：`optionalShift` 标记 + `matchesShortcut` 的 `matchOptions` + handler 收到 event |
| 2. 键盘导航 | `use-file-browser-keyboard-navigation.ts` | 整份取上游修好版本（+ 加回本仓的 `'tree'` 布局） |
| 3. 选择状态 | `use-file-browser-selection.ts` | **手工定点改**（与上游差 20 hunks） |

`navigator.vue` 4 处（类型签名加 `extendSelection`、新增 `isExtendSelectionShortcutEvent`、新增 `callActivePaneNavigate`、4 个 `registerHandler` 改接 event）也是手工改的。

### 2.2 关键语义：锚点与光标是**两回事**

- `lastSelectedEntry` = **连选锚点**（上一次被点中的那一条）；
- `focusedEntry` = **键盘光标**所在的那一条。

这是连选能正确扩展的前提，也是**承重**的：`focusedEntry` 不更新的话，Shift+↓ 之后按普通 ↓ 会从锚点而不是当前光标位置继续跳，用户看到的是「跳回去了」。

### 2.3 不按 Shift 的方向键是「**替换选择**」

上游测试 `replaces an extended list selection when navigating without shift` 明确：连选之后按普通方向键 → 只选中新位置那一条。这条语义在写更新日志时差点写错，已按测试断言纠正。

### 2.4 上游测试**没有**覆盖第 3 层

上游新增的 `use-file-browser-keyboard-navigation.test.ts`（+195 行）用的是**自己实现的 `selectRange` 假身**（harness 里内联了一份），所以上游自己写的 `use-file-browser-selection.ts` 改动在上游是**零覆盖**的。

本仓**新增** `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-selection-focus.test.ts`（6 用例，真实实例化 `useFileBrowserSelection`），覆盖：

- 连选把区间内条目全部选中，键盘光标停在区间末尾；
- 连选不挪锚点，连按 Shift+方向键才能一直往后扩；
- 没有锚点时连选把起点记成锚点；
- 焦点落在已选中条目上时只挪光标、不清选择；
- 取消选中的正是光标所在条目时，光标退回锚点；
- 清空选择时锚点与光标一起清掉。

---

## 3. B3：回收站不可用时先确认再永久删除

### 3.1 上游改了什么

Windows 的回收站只在**本地卷**上存在。UNC 路径（`\\server\share`）与映射的网络驱动器（`GetDriveTypeW` 报 `DRIVE_REMOTE`）根本没有回收站。上游改法：

1. 后端新增 `recycle_bin_unavailable_paths` 命令，告诉前端「这批路径里哪些不能进回收站」；
2. 前端 `planDeleteJobs` 据此把删除拆成「能进回收站的」+「要永久删除的」两个作业，后者**先弹永久删除确认框**；
3. 后端删除路径改走 `delete_path_to_trash` —— 路径不能进回收站时**直接报错，绝不退回永久删除**。

第 3 条是安全底线：少了它，前端的确认框就成了唯一防线。

### 3.2 我们的移植方案

**后端**（`src-tauri/src/utils.rs` / `delete_job.rs` / `file_operations.rs` / `lib.rs`）：

- `is_unc_recycle_path` / `windows_drive_letter` / `path_can_use_recycle_bin` / `recycle_bin_unavailable_paths` / `delete_path_to_trash`；
- `delete_job.rs` 与 `file_operations.rs` 的 trash 分支改走 `delete_path_to_trash`；
- `lib.rs` 注册 `delete_job::recycle_bin_unavailable_paths`。

**`windows` crate 不需要新增依赖** —— 本仓 `Cargo.toml` 早已有 `windows = { version = "0.58", features = [..., "Win32_Storage_FileSystem", ...] }`，`GetDriveTypeW` 直接可用。`Cargo.lock` 依赖列表逐行未变。

**前端**：

- `src/utils/recycle-bin-delete.ts`（上游 121 行，原样取用）+ `src/utils/__tests__/recycle-bin-delete.test.ts`（上游 9 用例，原样取用）；
- `src/composables/use-dir-entry-actions.ts` 与 `use-file-browser-selection.ts` 各接入 `planDeleteJobs`。

### 3.3 与上游的差异：本仓多了一条**远程**删除通道

本仓 2026-10-20 引入的 SFTP/FTP 远程删除走的是完全另一条路（`deleteRemoteItems`，独立确认框，不走 `deleteJobsStore`）。上游没有这个概念，所以上游的改动清单里没有它。

本仓的 `deleteItems` 只处理本地路径与网络路径（`sfm://remote/...` 走 `remote-delete` 动作），**两条路互不干扰**。已在代码注释里写明这一点，避免后来人把「远程」理解成「UNC」。

### 3.4 上游测试同样**没有**覆盖接线层

上游的测试只测 `planDeleteJobs` 这个纯函数。本仓**新增** `src/utils/__tests__/recycle-bin-delete-contract.test.ts`（6 用例），守住四件事：

1. 前端 `invoke` 的命令名与 Rust 命令名一致；
2. 前端 `invoke` 传的键与 Rust 参数名**逐条**对得上（Tauri v2 按 Rust 参数名的 camelCase 形式匹配 JS 的键 —— 这个坑本仓踩过一次）；
3. 命令在 `invoke_handler` 里注册了；
4. 后端删除路径走的是 `delete_path_to_trash` 而不是裸 `trash::delete`，**且两个本地删除入口都接上了 `planDeleteJobs`**（漏一个就会静默退回旧行为，而旧行为的后果是「用户以为进了回收站，文件其实没了」）。

---

## 4. B1：e2e 数据隔离（`SFM_E2E_DATA_DIR`）

### 4.1 为什么值得做

本仓**有** e2e-webdriver 基建和 5 个 spec，`npm run test:e2e:webdriver` 是真脚本。改造前的 e2e 是**直接跑在真实用户数据目录**上的：

- 会读写真实的 `user-workspaces.json`（用户的标签页、目录历史）；
- 会撞上首次启动的更新日志弹窗（遮罩挡住点击）；
- 失败时日志落在真实目录里，CI 收不到；
- 单实例插件会把启动**交接给正在运行的已安装 SFM**。

### 4.2 机制

上游新增 `src-tauri/src/app_dirs.rs`（258 行）：**debug 构建**下，设置了 `SFM_E2E_DATA_DIR` 就把 app data / config / local data / cache / logs / 窗口状态 / 扩展 / 缩略图 / 全局搜索索引 / 图标探针目录 / WebView2 profile 全部搬到一个文件夹下；**release 构建把这个覆盖编译掉**，正式包的行为逐字不变。

配套：

- 新增 `get_app_dirs` 命令 + 前端 `src/utils/app-dirs.ts`（一次性 IPC，失败会重试）；
- 隔离模式下**整个不装**单实例插件（不能把启动交接给用真实数据跑着的已安装 SFM）；
- 隔离模式下跳过「默认文件管理器迁移」（那个注册表集成住在 app 目录之外，隔离目录管不到）；
- 隔离模式下跳过「开机自启同步」（会改掉用户真实的 OS 自启项）；
- e2e 的 wdio 配置每次跑建一个新的临时目录，跑完删掉（`SFM_E2E_KEEP_DATA=1` 保留），失败时把 app 日志拷进 artifacts。

### 4.3 我们的移植方案与**两处超出上游**的补充

Rust 侧新增 `src-tauri/src/app_dirs.rs`（上游原样），并把下列文件的 app 目录解析改走统一解析点：

`default_file_manager/registry.rs`、`extensions/paths.rs`、`extensions/registry_storage.rs`、`global_search/query.rs`、`global_search/scan.rs`、`image_thumbnails.rs`、`startup_storage_bootstrap.rs`、`system_icons.rs`、`lib.rs`。

**超出上游的第 1 处** —— 本仓多出的两个模块：

| 文件 | 问题 |
|---|---|
| `src-tauri/src/remote/commands.rs` | 远程凭据存档目录直接用 `app.path().app_data_dir()` → 隔离的 e2e 会读到**用户真实的远程凭据** |
| `src-tauri/src/mcp/commands.rs` | MCP 客户端配置目录同理 |

这两个文件上游没有（上游既没有远程传输也没有 MCP），所以**不在**上游的改动清单里 —— 也是最容易漏的一处。本轮一并接上 `crate::app_dirs::app_data_dir`。

**超出上游的第 2 处** —— 4 个前端测试文件的 mock 目标变了：`appDataDir` 改从 `@/utils/app-dirs` 取之后，原先 mock `@tauri-apps/api/path` 的 4 处（`user-settings.test.ts`、`first-run-defaults.test.ts`、`use-info-panel-image-preview.test.ts`、`use-info-panel-video-preview.test.ts`）变成了陈旧 mock，改为 mock `@/utils/app-dirs`。

**e2e 配置**：取上游 `wdio.conf.js`（374 行）、`test/helpers/main-window.js`（新增「首次启动更新日志弹窗」的关闭逻辑）、`test/specs/navigator-folder-navigation.e2e.js`（跳过当前用户列不出来的 junction，比如 Windows 用户目录里的 "Application Data"）。

**必须改的一处品牌名**：上游的 wdio 配置里二进制名是 `sigma-file-manager.exe`，本仓是 `alpha-file-manager.exe`（品牌名锁定）。

### 4.4 契约门禁

新增 `src/utils/__tests__/app-dirs-contract.test.ts`（4 用例），守住「所有 app 数据路径都走统一解析点」这条**跨十几个文件的约定**：

1. Rust 侧除 `app_dirs.rs` 自己以外，**没有任何地方**直接调 `.app_data_dir()` 之类的解析器；
2. 前端需要 app 目录的地方从 `@/utils/app-dirs` 取，不再从 `@tauri-apps/api/path` 取；
3. `get_app_dirs` 命令名跨语言一致且已注册；
4. 隔离覆盖在 release 构建里**编译不进去**。

第 1 条是扫描整个 `src-tauri/src/**/*.rs` 做的 —— 漏一个文件不会报任何错，只会让 e2e 悄悄读到用户真实数据。

### 4.5 门禁基线：上游的 Rust 测试放在 `delete_job.rs` 里，本仓没跟

上游把两个 `delete_job.rs` 的 Rust 测试加在了 `delete_job.rs` 模块内。本仓**没有**跟这一步，理由是本仓的 `AGENTS.md` 记着一条硬红线：

> `cargo test --lib` 的测试二进制里有一条隐形红线：任何被测试链接到的代码都不能碰到 `tauri::AppHandle` 或 `tauri::async_runtime::*`…… 一旦你的代码被测试链接到并碰到 `tauri::async_runtime::spawn_blocking`，它的 `static RUNTIME: OnceLock<GlobalRuntime<Wry>>` 带默认类型参数 `Wry`，一处调用就单态化出 `<Wry as Runtime>`，把 tao 整条窗口链拖进来…… 测试二进制没有 application manifest 声明 comctl32 v6，`TaskDialogIndirect` 解析不到 → **加载阶段**就以 `STATUS_ENTRYPOINT_NOT_FOUND` (0xC0000139) 崩掉。

`delete_job.rs` 同一模块里有 `tauri::AppHandle` 签名。把测试放进那个模块，等于让测试二进制**主动引用**它。

本轮的做法：**上游那 5 个回收站判定测试全部放在 `utils.rs`**（纯模块、不依赖 tauri），并把上游 `delete_job.rs` 里那条 `trash_rejects_unc_path_without_deleting` 的等价断言也放进 `utils.rs`（上游本来就在 `utils.rs` 里有一条）。放弃的只有 `permanent_delete_removes_a_local_file`（测的是 `std::fs` 本身，价值低）与 `trash_of_a_missing_unc_path_leaves_nothing_deleted`（其断言已被 `utils.rs` 覆盖）。

**B1 的 `app_dirs.rs` 也带了 `#[tauri::command] get_app_dirs`**，本轮**实测确认**它没有把 Wry 拖进测试二进制：`cargo test --lib` 696 passed / 0 failed，测试二进制正常加载运行。

### 4.6 CI：一处**没有**跟

上游 B1 顺带改了 `.github/workflows/ci.yml`（删掉「Collect app logs」步骤、修一个 `Get-ChildItem` 空结果加 null 的 bug）。**本仓的 CI 没有 e2e job**（只有 `check` / `tauri-linux` / `tauri-windows` 三个），所以这两处改动**无处可落**，本轮没有跟。

连带后果：上游 CI 里那个「e2e 跑完检查临时目录有没有残留」的检查，本仓也没有。等本仓真的加 e2e CI job 时，需要把那三处一起带过去（上游的 `2b8bed43` 就是修那个 null 的）。

---

## 5. B5：仪表盘改版（本轮未做）

### 5.1 性质

上游 `3eca4c17` + `4a33b290` 合计 **4836 行 / 74 文件**，是一整套仪表盘视觉改版：新增 `dashboard-top-bg.jpg`、hero 区、标签侧栏、类型筛选、标签视图、条目预览与尺寸展示等。

### 5.2 为什么不能直接套

| | 本仓 | 上游改后 |
|---|---|---|
| `dashboard.vue` 行数 | 829 | 511 |
| 与上游改前的差异 | — | 68 hunks |
| `user-stats.ts` | 735 | 563（20 hunks） |
| `tag-selector.vue` | 541 | 575（20 hunks） |

**方向已经不同**。本仓的仪表盘是上游改版**之前**那套（分类卡片 + 统计），上游则换成了标签视图 + hero。两边不是「同一份代码的两个版本」，而是两种设计。

硬套上游的后果有两个：丢掉本仓分叉上的东西（本仓的仪表盘有远程相关与分类收藏的改动），以及把上游的视觉决策当成我们的决策 —— 而那些决策（hero 背景图、标签侧栏的信息密度）本仓的用户群未必适用。

### 5.3 建议

单独排一轮，**先做设计决策再动代码**：

1. 先定「仪表盘是给人看统计，还是给人管标签」—— 上游改版把它变成了后者；
2. 决定 hero / 背景图这类视觉元素要不要（会带进一张图片资源）；
3. 再决定是**取上游的标签视图**还是**保留本仓的分类视图**。

工作量的量级是「几天 + 一轮视觉验收」，不是「一个提交」。

---

## 6. 门禁

| 门禁 | 基线（`f3f1145a`） | 本轮 |
|---|---|---|
| `cargo test --lib` | 686 passed / 0 failed | **696 passed / 0 failed**（+3 B4 的 Rust 测试，+5 B3 的回收站测试，+2 B1 的 app_dirs 测试） |
| `npx vitest run` | 218 文件 / 1946 用例 | **225 文件 / 1986 用例**（+7 文件 / +40 用例） |
| `npx eslint src` | 170 errors / 0 warnings | **170 errors / 0 warnings**（逐字一致；170 条全在未碰过的存量文件） |
| `npx vue-tsc --build` | 0 | **0** |
| `node scripts/verify-changelog.mjs` | OK | **OK** |
| `Cargo.lock` 依赖列表 | — | **逐行未变**（未引入新第三方依赖） |

新增的 7 个测试文件：

```
src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-selection-focus.test.ts   (6)
src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-extend-selection-chain.test.ts (3)
src/utils/__tests__/recycle-bin-delete.test.ts        (9，上游原样)
src/utils/__tests__/recycle-bin-delete-contract.test.ts (6)
src/utils/__tests__/app-dirs.test.ts                  (3，上游原样)
src/utils/__tests__/app-dirs-contract.test.ts         (4)
src/utils/__tests__/window-fullscreen.test.ts         (3，上游原样，B4)
```

> `use-file-browser-extend-selection-chain.test.ts` 是本轮**真机排查的产物**：
> 上游的 keyboard-nav 测试用的是**自己实现的 `selectRange` 假身**，
> 所以「锚点 → 区间」这一段在上游是零覆盖的。这个文件把
> `useFileBrowserSelection`（真的 `selectRange` / `focusedEntry` / `lastSelectedEntry`）
> 与 `useFileBrowserKeyboardNavigation`（真的 `navigateDown(true)`）**串起来**跑，
> 并额外用**真实 DOM 行**跑一遍「连选 → 焦点事件」这条链（jsdom 里没有 `element.focus()`，
> 只做纯函数调用时这条链根本不会出现）。

### 6.1 注入验证（11 条，全部按预期转红）

每条注入都让被测断言**失效**（恒真 / 改回旧行为 / 破坏跨语言契约），负例必须转红：

| 编号 | 注入内容 | 转红的门禁 | 转红数 |
|---|---|---|---|
| B2-a | `selectRange` 不再更新键盘光标 | `use-file-browser-selection-focus.test.ts` | 4 |
| B2-b | `matchesShortcut` 去掉 `optionalShift` 放行 | `shortcuts.test.ts` | 1 |
| B2-c | `applyNavigationTarget` 忽略 `extendSelection` | `use-file-browser-keyboard-navigation.test.ts` | 4 |
| B3-a | `delete_path_to_trash` 去掉 UNC 守卫 | Rust `recycle_bin_tests` | 1 |
| B3-b | 前端 `invoke` 的键 `paths` → `path` | `recycle-bin-delete-contract.test.ts` | 1 |
| B3-c | 恢复 `use-file-browser-selection.ts` 的旧删除路径 | `recycle-bin-delete-contract.test.ts` | 1 |
| B3-d | 后端改回裸 `trash::delete` | `recycle-bin-delete-contract.test.ts` | 1 |
| B1-a | Rust 改回 `app_handle.path().app_data_dir()` | `app-dirs-contract.test.ts` | 1 |
| B1-b | 前端改回从 `@tauri-apps/api/path` 取 | `app-dirs-contract.test.ts` | 1 |
| B1-c | `isolated_root` 接受相对路径 | Rust `app_dirs` 测试 | 1 |
| B1-d | 前端 `invoke` 的命令名改掉 | `app-dirs-contract.test.ts` | 1 |

所有注入都用 `inject.cjs` 跑（备份 → 注入 → 跑命令 → **无条件还原并逐字节校验**），还原后 `git diff` 确认无残留。

---

## 7. 真机验收

### 7.1 验收环境

- 产物：`release\Alpha File Manager_3.2.14-beta_x64-setup.exe`（3.2.14-beta，`npm run tauri:build` 打的包，**不是** `tauri dev`）
- 装机：`D:\Program Files\Alpha File Manager\alpha-file-manager.exe`
- 屏幕 2560×1440 物理 @150% 缩放
- 夹具（**全部自造**，不拿用户资产当靶子）：
  - `C:\Users\Duanyi\afm-select-fixture`：a-alpha.txt ~ e-epsilon.txt 五个 16 B 的文件
  - `C:\Users\Duanyi\afm-unc-fixture` + SMB 共享 `AFMTest` + 映射盘 `Z:` → `\\localhost\AFMTest`（`GetDriveTypeW(Z:\) = 4` = DRIVE_REMOTE）

### 7.2 B4：窗口状态 —— 通过

| 项 | 读数 |
|---|---|
| 重启后 | `IsZoomed=True`，窗口 2582×1390 @(-11,-11)，可见边框 2560×1368 = 工作区大小 |
| 双击顶栏空白区 | 还原为 1310×1013，`fits in work area: True`、`bottom inside work area: True` |
| 再双击 | 重新最大化 |

### 7.3 B2：Shift+方向键连选 —— 通过

在 `afm-select-fixture`（列表视图，名称升序）里：

| 动作 | 读数（行高亮 = 选中，焦点环 = 键盘光标） | 判定 |
|---|---|---|
| **对照** Ctrl+A | a~e 五行全高亮 | 修饰键确实到达应用 ✓ |
| 点 a-alpha.txt | {a}，焦点 a | ✓ |
| **Shift+↓ ×1** | **{a, b}**，焦点 b | 连选生效 ✓ |
| **Shift+↓ ×2** | **{a, b, c}**，焦点 c | 连选继续扩展 ✓ |
| **Shift+↑ ×1** | **{a, b}**，焦点 b | 区间随光标收缩 ✓ |
| 普通 ↓ | **{b}** | 不按 Shift 是「替换选择」✓（与上游测试 `replaces an extended list selection...` 一致） |

> **这一项上一轮报的是「功能未生效」，那是假阴性。**
> 根因在验收脚本，不在产品代码 —— 详见 §8.6。
> 用正确的方式重测后，**B2 的四层（快捷键匹配 / 事件透传 / 键盘导航 / 选择区间）全部按上游语义工作**。

### 7.4 B3：网络路径删除前确认 —— 通过

| 路径 | 动作 | 读数 |
|---|---|---|
| `\\localhost\AFMTest\afm-recycle-probe.txt` | 选中 → Delete | 弹确认框：**「从驱动器中删除」/「//localhost/AFMTest/afm-recycle-probe.txt 将被永久删除。如果您不了解此操作无法撤销，请确认。」**（取消 / 删除） |
| 同上 | 点「取消」 | 文件仍在列表里，**没有被删** ✓ |
| `Z:\afm-recycle-probe.txt`（映射盘，DRIVE_REMOTE） | 选中 → Delete | 同样弹确认框：**「z:/afm-recycle-probe.txt 将被永久删除。」** ✓ |

两条网络路径都「先问后做」，取消不删。

### 7.5 B1：release 构建忽略 `SFM_E2E_DATA_DIR` —— 通过

```
设 SFM_E2E_DATA_DIR=C:\Users\Duanyi\afm-e2e-override-probe
启动已装的 release 包（3.2.14-beta）
```

| 检查 | 读数 |
|---|---|
| 覆盖目录 | **保持空**（一个文件都没写进去）✓ |
| 真实用户数据目录 | 被写入 5 个文件：`user-extensions.json` / `user-remote-connections.json` / `user-settings.json` / `user-stats.json` / `user-workspaces.json` ✓ |

**=> release 构建里覆盖被编译掉，应用仍然用真实目录**（正式包行为逐字不变）。

### 7.6 结论

| 项 | 状态 |
|---|---|
| B4 窗口状态 | **通过** |
| B2 Shift+方向键连选 | **通过**（上一轮的「未生效」是验收脚本缺陷，见 §8.6） |
| B3 回收站删除前确认 | **通过** |
| B1 e2e 数据隔离 | **通过** |

---

## 8. 踩坑

### 8.1 上游的 Rust 测试不能随便放进带 `tauri::AppHandle` 的模块

见 §4.5。这条本仓 `AGENTS.md` 早就记着，本轮是第一次真的撞上「上游把测试放在那个模块里」的情况 —— **移植上游测试时要先看那个模块有没有踩红线**，不能照抄。

### 8.2 `git apply` 在换行符不一致时会整片失败

上游的 patch 上下文用 LF，我们的文件在 Windows 上检出是 CRLF，`git apply` 报的是「while searching for: ...?」—— 那些 `?` 就是 `\r`。

**对策**：对「与上游改前**逐字相同**」的文件，直接 `git checkout <upstream-commit> -- <file>` 取上游改后版本，比 patch 可靠得多。本轮 5 个 Rust 文件 + 3 个 e2e 文件都是这么取的。

### 8.3 写更新日志时，「不按 Shift」的方向键语义差点写错

上游测试名是 `replaces an extended list selection when navigating without shift` —— **替换**选择，不是「保留区间、只挪光标」。写更新日志前必须读测试断言，不能凭直觉。

### 8.4 e2e 的品牌名

上游 `wdio.conf.js` 里写死了 `sigma-file-manager.exe`。本仓的二进制是 `alpha-file-manager.exe`。取上游文件后**必须**逐个检查这类写死的名字。

### 8.5 PowerShell 的 `Get-Content` 把 UTF-8 无 BOM 读成乱码

`vitest.config.ts` 里的中文注释用 `Get-Content` 读出来是乱码 —— **文件本身没问题**，是读法的问题（`AGENTS.md` 记过这个坑）。用 `read` 工具或 `node fs.readFileSync(..., 'utf8')`。

### 8.6 **注入的修饰键是「瞬时按下」** —— 整轮假阴性的来源

**这是本轮最贵的一条**，它让「B2 连选不生效」看起来像产品缺陷，排查了整整一轮。

用 `SendInput` 注入「Shift + ↓」时，浏览器实际收到的事件序列是：

```
keydown key=Shift      shift=true      <- 泛型 VK_SHIFT(0x10) 的按下
keyup   key=Shift      shift=false     <- 它被【立刻松开】了
keydown key=ArrowDown  shift=FALSE     <- 方向键到达时，Shift 已经不在了
```

**=> 应用收到的是一枚普通的 ↓**，于是它执行了「替换选择」，看起来就是「连选没生效」。

**判别方法（下次照着走）**：不要在应用里猜，**用一个不依赖产品的探针页**（Edge 打开本地页 + `window.addEventListener('keydown')` 打印 `shiftKey`）把投递层单独验掉。应用在这条链路上是最后一环，先验最后一环就会一直绕圈。

**能用的注入方式**：`WScript.Shell.SendKeys`（`'+{DOWN}'`）—— 它把整个组合当成**一次手势**合成，修饰键在主键到达时仍然按着：

```
keydown key=Shift      shift=true
keydown key=ArrowDown  shift=TRUE   <- 正确
```

本仓的 `.superpowers/sdd/app-sendkeys.ps1` 就是这个通道（带前台校验）。

**推广**：凡是要验「组合键」的功能，**注入方式必须先用探针页验过**，再拿去验产品。**「Ctrl 能用、Shift 不能用」这种不对称现象是注入层的典型指纹**（`Ctrl+Shift+C` 之所以能成功，是因为 `Ctrl` 的状态被系统正确跟踪了）。

### 8.7 验收脚本无条件释放 WIN 键 → 弹开始菜单抢焦点

`.superpowers/sdd/app-key.ps1` 原来在每次注入结束时对 `ALT / WIN / CTRL / SHIFT` **各发一次 KEYUP**。Windows 对「没按下的键发 KEYUP」会合成**一次按下 + 抬起** —— 于是**每次注入都会弹出 Windows 开始菜单**，把焦点从应用抢走，后面的按键全进了开始菜单。

截图里那个蓝色开始菜单就是它。**修法**：只释放**这次真的按下过**的修饰键。

### 8.8 键名表缺项 → 键根本没发出去

`app-key.ps1` 的 `$named` 表里没有 `DELETE`（VK 0x2E）。`DELETE` 这个 token 落进「单字符」分支，而它有 6 个字符 → 脚本只打印一句 `UNKNOWN TOKEN` 就结束 —— **键一次都没发**，而验收脚本的输出里「按了 Delete」看起来一切正常。

**判别方法**：注入脚本必须**回显每个 token 的 VK 与 SendInput 返回值**；只看脚本自己打印的「按了 X」不算证据。

---

## 9. 提交

### 9.1 内容

| 提交 | 说明 |
|---|---|
| `9e880451` | `feat(navigator): 上游 B 类改动移植 —— 连选、回收站确认、窗口状态、e2e 隔离`（58 文件，+3678 / -286） |

**尚未 push**：本轮只提交到本地 `main`，推送与否由用户决定。

### 9.2 这次提交里有什么

- **B4**：`src-tauri/src/main_window_state.rs`（新）、`lib.rs` 的插件接线与启动顺序、`src/utils/window-fullscreen.ts`、`src/stores/runtime/app-window.ts`、顶栏与侧栏的全屏处理
- **B2**：`src/stores/runtime/shortcuts.ts`（整份取上游修好版本）、`use-file-browser-selection.ts`、`use-file-browser-keyboard-navigation.ts`、`use-file-browser.ts`、`navigator.vue`，外加 2 个新测试文件
- **B3**：`src-tauri/src/utils.rs`（UNC / DRIVE_REMOTE 判定 + `recycle_bin_tests`）、`delete_job.rs`、`file_operations.rs`、`src/utils/recycle-bin-delete.ts`（上游原样）+ 契约门禁
- **B1**：`src-tauri/src/app_dirs.rs`（新）、`registry.rs` / `extensions/paths.rs` / `extensions/registry_storage.rs` / `global_search/scan.rs`（取上游改后版）、`global_search/query.rs` / `image_thumbnails.rs` / `startup_storage_bootstrap.rs`（手工定点改）、`remote/commands.rs` / `mcp/commands.rs`（**超出上游**）、`src/utils/app-dirs.ts`（新）+ 契约门禁、e2e 三个文件
- 版本：`package.json` 与 3 个 `Cargo.toml` → **3.2.14-beta**；`CHANGELOG.md` + `public/changelog/ch/changelog.md` 新增 3.2.14-beta 条目
- 文档：本文件

### 9.3 留在工作区外的状态（本轮在机器上留下的东西）

| 东西 | 位置 | 怎么清 |
|---|---|---|
| SMB 共享 `AFMTest` | `C:\Users\Duanyi\afm-unc-fixture` | `Remove-SmbShare -Name AFMTest` |
| 映射盘 `Z:` | → `\\localhost\AFMTest` | `Remove-PSDrive -Name Z -Force`（或 `net use Z: /delete`） |
| 夹具目录 | `C:\Users\Duanyi\afm-select-fixture`、`C:\Users\Duanyi\afm-unc-fixture` | 直接删目录 |
| e2e 覆盖探测目录 | `C:\Users\Duanyi\afm-e2e-override-probe`（空目录） | 直接删目录 |

验收用的脚本都在 `.superpowers/sdd/`（git-ignored），关键几个：
`app-sendkeys.ps1`（**能正确送组合键的那条通道**）、`app-key.ps1`、
`accept-b2-sendkeys.ps1`、`accept-b3-unc.ps1`、`accept-b3-mapped.ps1`、
`accept-b1-e2e-isolation.ps1`、`probe-shift-in-edge.ps1`（投递层探针）。
