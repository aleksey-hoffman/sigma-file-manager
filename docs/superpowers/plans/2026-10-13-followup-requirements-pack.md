# 2026-10-13 后续需求包：开发计划

> 状态：**待执行**（用户已确认范围，等排期）
> 分支：`docs/navigator-behavior-parity-spec`
> 基线 commit：`087aecd9 feat(settings): 换用用户指定的软件简介文案`
> 版本号：**固定 3.0.3**，不得升到 3.0.4

---

## 0. 用户已确认的范围决策

| 需求 | 决策 |
|---|---|
| 1 磁盘卡片「空余空间 / 总空间」 | 直接改 |
| 2 「打开」对话框路径焦点同步 | 先归因实验，再定改法 |
| 3 默认文件管理器被绕过 | **只做 A 档**：补注册 shell 动词 |
| 4 搜索结果右键菜单「打开所属目录」 | **目录内搜索改为递归过滤**，全局搜索与目录内搜索**两者都显示**该菜单项 |
| 5 设置页简介文案 | 已完成一轮；本轮追加 3 处调整 |

---

## 1. 需求 5 追加（追加 3 处，约 30 分钟）

### 5.1 开发者名：英文版显示为 `kizemo`

- 16 个非中文语言包 `app.developer`：`"Developed by Duan Yi"` → `"Developed by kizemo"`
- `ch.json` 保持 `"开发：段燚"`

依据：`git remote origin` = `https://github.com/kizemo/alpha-file-manager`，
近期提交者身份为 `kizemo <kizemo@users.noreply.github.com>`。
中文用户界面沿用中文名，英文界面用拉丁字母 handle。

### 5.2 分隔符：「——」改为两个空格

`src/modules/settings/ui/header.vue:37`。

> **实现坑（必读）**：HTML 会把连续空白折叠成一个空格。两个半角空格在模板里写出来
> 渲染后只剩一个。要真正显示两个空格必须用 `&nbsp;&nbsp;`（不换行空格），
> 不要试图靠模板缩进或 `white-space` —— 后者会把模板自身的换行和缩进也显示出来。

### 5.3 增加 GitHub 链接

新增 i18n 键 `app.repository`，17 个语言包值相同（URL 不需要翻译）：
`https://github.com/kizemo/alpha-file-manager`

模板照现有 `aiec.fun` 的写法再加一个 `<a target="_blank" rel="noopener noreferrer">`。

### 目标渲染

中文：

```
Alpha File Manager 基于 Sigma File Manager 二次开发，新增目录树、快速切换（文件对话框路径焦点同步）、批量重命名等实用能力，对很多细节进行了优化，打造体验更完善的文件管理器。
鸣谢原作者 Aleksey Hoffman。 开发：段燚  https://www.aiec.fun  https://github.com/kizemo/alpha-file-manager
```

英文：

```
Alpha File Manager is developed on top of Sigma File Manager, adding practical features such as a directory tree, quick switching (path focus sync for file dialogs) and batch rename. Many details have been refined to deliver a more complete file manager experience.
Credits to the original author Aleksey Hoffman. Developed by kizemo  https://www.aiec.fun  https://github.com/kizemo/alpha-file-manager
```

### 验收

扩展 `src/modules/settings/ui/__tests__/header.test.ts`：断言两个链接的
`href` / `target` / `rel`，以及 `app.developer` 在英文包渲染为 `kizemo`。
判别性探针：删掉 `app.repository` → 必须转红且 received 显示缺失占位符。

---

## 2. 需求 1：磁盘卡片「空余空间 / 总空间」（约 15 分钟）

**数据已就位，不需要新增任何字段。** `driveInfoToDirEntry` 早已把总空间写进
`entry.size`，空余空间在 `drive_metadata.available_space`，两个 helper 各取一个：

- `getDriveEntryAvailableSpaceBytes()` — `src/utils/drive-icon.ts:59`
- `getDriveEntryVolumeSizeBytes()` — `src/utils/drive-icon.ts:49`

**唯一改动点**：`src/modules/navigator/components/file-browser/file-browser-grid-card.vue:229-231`。
当前磁盘条目直接 `return formatBytes(driveAvailableSpace)`，改为
`空余 / 总空间` 拼接；总空间为 `null`（老数据缺字段）时退回只显示空余，保持现有行为。

**建议用 `A / B` 斜杠形式，不用 `t('freeOf')`**：分隔符不进语言包，且避开下面这个坏串。

### 顺带修复（同一概念、同一屏系的真缺陷）

`src/localization/messages/ch.json:809` 的 `freeOf` 值是 `"自由于"` —— 机器翻译残留。
首页磁盘卡片（`src/modules/home/components/drive-card.vue:53`）现在渲染成
「147.1 GB 自由于 931.3 GB」。改为 `"可用"`。

`freeOf` 全仓库只有一个使用点（`drive-card.vue:53`），改动面可控。

### 验收

`tauri build` 后真机看「位置」页五张卡片 + 主页磁盘卡片。

---

## 3. 需求 4：递归目录内搜索 + 「打开所属目录」（最大的一块，约 4–6 小时）

### 3.1 后端：现有命令不支持递归，必须先补

**关键事实（已核实）**：`src-tauri/src/global_search/query.rs:337-357` 的
`global_search_query_paths_blocking` 只做**一层** `read_dir`，**不递归**：

```rust
if metadata.is_dir() {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry_result in entries.flatten() {
            collected_paths.push(entry_result.path());   // ← 只取直接子项
        }
    }
}
```

**好消息**：递归遍历的能力项目里已经有了。`src-tauri/src/global_search/scan.rs:292-298`
是一套成熟的写法，`walkdir = "2.5"` 已在 `src-tauri/Cargo.toml:49`：

```rust
WalkDir::new(&root_path)
    .follow_links(false)
    .max_depth(scan_depth.max(1))
    .into_iter()
    .filter_entry(|entry| should_scan_walk_entry(entry.path(), ignored_matcher, ...))
```

**做法**：把 `query.rs` 的遍历层换成 `WalkDir`，在
`GlobalSearchQueryOptions`（`src-tauri/src/global_search/types.rs:55-62`）加
`max_depth: usize`，`max_depth <= 1` 时保持现有一层行为。

> **为什么必须加开关**：该命令目前被全局搜索当作 priorityPaths 使用
> （`src/stores/runtime/global-search.ts:394`）。不加开关直接改成递归，会静默改变
> 全局搜索的现有语义和性能特征。

### 3.2 递归必须处理的性能与安全问题

不加这些会直接在大目录上卡死：

| 项 | 现状 | 必须改成 |
|---|---|---|
| 结果上限 | `query.rs:426-428` **收集完再 truncate** | **边走边收集**，超 `limit` 立即停 |
| 深度 | 无 | `max_depth` 上限（建议默认 5，用户可调） |
| 噪声目录 | 无 | 复用 `global_search/ignore.rs` 的 `IgnoredPathMatcher` 跳过 `.git` / `node_modules` 等 |
| 隐藏项 | 无 | 与 `showHiddenFiles` 语义对齐 |
| symlink | 无 | `follow_links(false)`，与 `scan.rs` 一致，防目录环 |
| 取消 | 无 | 取消标志 / 前端 abort，超时返回部分结果 |

### 3.3 前端：筛选框加「包含子目录」开关

- 开关放在 `file-browser-toolbar-filter.vue` 已有的属性面板里
  （该组件已有 `isPropertyPanelOpen` / `selectProperty`，位置现成）
- **默认关闭**：保持现有即时过滤的手感
- 开启时：输入 debounce 后调 `global_search_query_paths`，
  `paths: [currentPath]`、`max_depth` 传入
- **结果必须走 `externalEntries` 通道渲染，不能替换 `dirContents`**。
  否则点条目时应用会以为自己在当前目录，「打开所属目录」和相对路径全部失去意义。
  `global-search-view.vue:564-575` 已经有这套 external 接法可直接参照。

### 3.4 菜单项「打开所属目录」

**不能复用现有的 `open-containing-directory`**：

| | 现有 | 本次新增 |
|---|---|---|
| 含义 | 在 **Windows 资源管理器**中显示 | 在 **Alpha 内**跳转到父目录 |
| 实现 | `reveal_in_explorer` → `/select,` | 导航到 `dirname(entry.path)` |
| 可见性 | 仅 file，仅 Windows | 文件和目录都可，**跨平台** |
| 出现位置 | 目录浏览、目录树 | 全局搜索 + 递归目录内搜索 |

改动面：

1. `file-browser/types.ts:46` — `ContextMenuAction` 加 `'open-parent-directory'`
2. `utils/context-menu-action-visibility.ts` — 加规则；**不进 `WINDOWS_ONLY_ACTIONS`**；
   需把「是否搜索模式」传进可见性函数（当前签名只有 `entries` + `options`）
3. `composables/use-file-browser-actions.ts` — 加分发
4. **打通 external 模式的导航能力**：现在 `use-file-browser.ts:255-261` 的
   `handlePathSubmit` / `openFile` 全是 no-op（`setupExternalDataSource` 返回空函数）。
   要让「打开所属目录」真能把 Alpha 带过去，需通过 emit 从
   `global-search-view.vue` 冒泡到 navigator 页调用真实导航。**这是本需求的主要工作量。**
5. 17 个语言包加 `fileBrowser.actions.openParentDirectory`

### 3.5 验收

- 在一个有多层子目录的测试树上开启递归筛选，确认结果来自子树且路径正确
- 全局搜索结果与递归目录内搜索结果**两处**都能右键「打开所属目录」
- 点击后 Alpha 跳到该结果的上级目录，并且**选中该条目**（建议行为，需确认）
- 判别性探针：构造一个结果确实在子目录里的场景，确认代码路径真的被走到
  （规则 J 深化 —— 浅层目录下构造出的用例可能是平凡通过的）

---

## 4. 需求 3 A 档：补注册 shell 动词（约 2 小时）

### ⚠️ 先说一个风险：`*\shell\open` 建议换掉

`*\shell\open\command` 覆盖的是**所有文件系统对象**，不只是目录。设了它，双击任何文件
（`.txt` / `.jpg` / `.exe`）都会走 Alpha 的打开流程，而不是原来的关联程序。
这会让 Alpha 变成「所有文件的默认程序」，与「默认文件资源管理器」的目标不符，
且一旦发生极难排查。

Windows 自己把文件管理器设为默认时，写的是下面 6 个键，**不含 `*`**：

```
Folder\shell\open        Folder\shell\explore
Directory\shell\open     Directory\shell\explore
Drive\shell\open         Drive\shell\explore
```

**建议**：做 `Directory\shell\open` + `Directory\shell\explore` +
`Drive\shell\open` + `Drive\shell\explore`，把 `*\shell\open` 换成 `Drive\shell\open`。
覆盖面更对症，且没有劫持文件打开的风险。

> 若确认就是要 `*\shell\open`，照做，但请知悉上述后果。

### 当前注册面（已核实）

只写了 3 个键，全在 HKCU（`src-tauri/src/default_file_manager.rs:376-378`）：

```
SOFTWARE\Classes\Folder\shell\open\command
SOFTWARE\Classes\Folder\shell\explore\command
SOFTWARE\Classes\CLSID\{52205fd8-5dfb-447d-801a-d0b52f2e83e1}\shell\opennewwindow\command
```

### 改动点：4 处必须同步，漏一处就复现

1. `src-tauri/default-file-manager-common/src/lib.rs:11-20` — 加常量；
   `ROOT_REGISTRY_KEYS: [&str; 3]` 数组大小改 3 → 7。
   **这个数组同时驱动快照 / 恢复 / 撤销**，加了键就自动纳入，不用另写清理代码。
2. `src-tauri/src/default_file_manager.rs:376-378` — 写入点
3. `src-tauri/default-file-manager-launcher/src/main.rs` — **launcher 有一份完全独立的实现**，
   必须同步改，否则 launcher 路径会把新键删掉
4. 确认 `registry.rs` 的 `restore_registry_roots` 能覆盖新键（依赖第 1 项的数组）

> 这是本项目踩过的坑：漏改独立实现 → 表现为「装了又被删回去」，极难定位。

### 回滚与验收

- 注册前快照机制已存在（`DEFAULT_FILE_MANAGER_REGISTRY_SNAPSHOT_FILE_NAME`），
  新键进 `ROOT_REGISTRY_KEYS` 后自动进快照
- **必须真机验证三项**：① 双击文件夹走 Alpha ②「属性 → 打开方式」显示正确
  ③ 关闭「设为默认」后注册表能干净恢复（不能留残键）

---

## 5. 需求 2：「打开」对话框路径焦点同步（约 2–4 小时，诊断先行）

### 5.1 上轮判断更正

上一轮判定「仓库内无运行时日志、无法归因」是**错的**。sidecar 确实有日志，
只是当时找错了地方：

```
%LOCALAPPDATA%\kizemo\focus-sync\logs\spike.log      （每日轮转）
```

依据：`extensions/kizemo.focus-sync/sidecar/src/logger.rs:56-62` 的 `log_dir()`，
以及 `main.rs:69-85` 把它接到 `tracing_appender::rolling::daily`。

### 5.2 今日实测数据（2026-10-13，771KB / 6190 行）

| 事件 | 次数 | 说明 |
|---|---|---|
| `set_path_dialogs` `dialogs_count=0` | **312** | 400ms 重试窗口内没等到任何对话框 |
| `set_path_dialogs` `dialogs_count=1` | 88 | 检测到了一个 |
| `set_path_dialogs` `≥2` | 23 | 死 HWND 累积（代码注释承认过） |
| `opened_write_back` | 224 | **全部带文件名** —— 清一色 Save As 类 |

`dialogs_count=0` 占 73.6%，比例高得可疑。

### 5.3 两条假设仍未分开

- **H1 注入退化**：检测通过，但 `is_winui3_wrapped` 门
  （`uia_inject.rs:933-935, 1180`）判否 → 跳过 H1/H2 → 掉进 F3。
  F3 代码自己写着「That is not navigation… the user saw no change at all」（`:395-397`）。
  H2 的有效性前提还写死在注释里：*"Chromium's Save-As breadcrumb is updated by the
  first SetValue"*（`:854-857`）—— **明确只对 Save As 成立**。
- **H2 检测就没通过**：`has_child_class` 用 `FindWindowExW` 只看直接子窗口、不递归
  （`uia_event.rs:444-455`），Open 对话框的结构子类可能嵌套更深。

### 5.4 诊断实验（约 10 分钟）

同一个 Alpha 目录，先后打开一个 Chromium「另存为」和一个「打开」对话框，
每次在 Alpha 里切目录触发 `/set_path`，然后读日志：

| 观察 | 结论 |
|---|---|
| 出现 `dialogs_count=1` 但界面没跟着跳 | **H1** |
| 出现 `dialogs_count=0` | **H2** |
| 两种都出现 | 分场景成立，要按对话框类型分别修 |

### 5.5 顺带发现的覆盖缺口

`extensions/kizemo.focus-sync/sidecar/scripts/verify_target_matrix.ps1:147-155`
的 7 个验收目标里 **6 个是 Save As**，唯一的 Open 类是 `code → File → Open Folder`，
且断言只到 Write 事件（`:165-167`）—— **从未验证导航是否真的发生**。
这就是这个缺陷能一路漏到真机的原因。修的时候要把导航结果纳入断言。

### 5.6 修法（待诊断结果确认）

- H1 → 放宽 wrapper 判定，或给 Open 类补独立导航路径
  （Open 对话框的地址栏不在 41477，需重新定位控件）
- H2 → `has_child_class` 改成递归查找

风险中高（Rust 侧改动需重编译）。

---

## 6. 执行顺序与依赖

```
需求 5 追加（30min，零依赖，可立刻做）
   ↓
需求 1（15min，零依赖）
   ↓
需求 4 后端 3.1+3.2（新增 Rust 命令，需重编译）
   ↓
需求 4 前端 3.3（依赖 3.1 的命令）
   ↓
需求 4 菜单 3.4（依赖 3.3 打通的 external 导航）
   ↓
需求 3 A 档（2h，注册表改动独立，可并行）
需求 2 诊断 → 修复（独立，但需重编译）
```

**合并点建议**：需求 5 追加 + 需求 1 改完就跑一次 `tauri build` 验收，
这两项零风险、见效快。需求 4 完成后单独打包一次。需求 3 与需求 2 各自单独打包。

---

## 7. 全局约束（每一步都适用）

- 品牌名固定 **Alpha File Manager**
- **不得修改**：mDNS 服务名、legacy 数据目录名、Tauri `identifier`
  `com.sigma-file-manager.app`
- 17 个语言包必须同步（中文 locale code 是 `ch`，不是 `zh`）
- **零新依赖**（`walkdir` 已在 Cargo.toml:49，可直接用）
- 版本号**固定 3.0.3**，不得升 3.0.4
- `tauri build` 前必须关闭所有 `alpha-file-manager.exe` 实例，否则文件锁失败
- **真机验收必须用 `tauri build` 打包产物**；`tauri dev` 会渲染空白路由页，不能用于验收
- Rust 工具链固定 1.90.0：
  `C:\Users\Duanyi\.rustup\toolchains\1.90.0-x86_64-pc-windows-msvc\bin`
- 用户可见文本、注释、文档一律简体中文
- 删除文件用可恢复方式：`rm -- "<target>"`（**必须正斜杠**，反斜杠会被 shim 吞掉）

## 8. 已知既有缺陷（不在本轮范围，别误当新问题）

- 全量测试有 2 例在干净 HEAD 上同样失败的并行超时：
  `use-navigator-item-icon.test.ts`、`home-banner-click-opens-background-manager.test.ts`。
  单独跑都通过，失败数在 2–4 之间跳。与本轮改动无关。
- 长按置顶：代码层无 favorite 触发路径，判定为 Windows 焦点/drag plugin 行为。
- P1 启动崩溃调查：接受现状，不再处理。