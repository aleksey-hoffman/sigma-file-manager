# 下阶段实施规划 —— 六项需求（2026-10-15）

> 基线：`main` = `0f73f159`（缩略图四档修复已验收并推送）
> 已完成：3.1 小房子跳此电脑、3.5 外链品牌化、3.6 缩略图四档（含 10-15 截断修复）
> 本文档所有现状结论都来自读源码，每条带 `文件:行号`。

---

## 0. 需求清单与编号对照

| 用户本轮编号 | 内容 |
|---|---|
| **N1** | 仪表盘页签「⋮」菜单新增「新建标记」：选目录/文件 + 标记名称 + 标记颜色 |
| **N2** | 仪表盘页签「⋮」菜单新增「新建收藏」「新建分类」；右键改收藏归属分类；拖拽调整收藏排序；收藏支持自定义显示名 |
| **N3** | 侧边栏仪表盘悬停菜单：删「仪表盘」「快速访问」两行；加「常用」「历史」两个导航（悬停出子菜单）；四组之间加横线；「收藏夹」只显示分类 + 无分类归属的收藏，有分类的悬停分类时右侧弹子菜单 |
| **N4** | 搜索：确认「扫描深度」设置 —— **已确认，见 §3** |
| **N5** | 全局搜索与目录搜索的结果，右键菜单加「打开所属目录」 |
| **N6** | 目录树展开过长时超出窗口且无滚动条，需可滚动 |

---

## 0.1 决策记录（用户 2026-10-15 10:35 拍板）

| # | 决策 | 连带影响 |
|---|---|---|
| D1 | **「打开所属目录」= 在本应用里跳到父目录并选中该条目**（不是资源管理器） | 走 `pendingLaunchReveal` 通道，需新增 1 个 action + handler + 把 `isExternalMode` 透出到 context + **新增 1 个 i18n key（17 包同步）**。资源管理器语义那套已有代码仍然保留不动 |
| D2 | **「新建标记」= 只建标签定义，之后手动给条目打标** | 对话框只需「名称 + 颜色」，**不需要选择目录/文件**。工作量显著下降，也不必新建路径选择组件。⚠️ 但这与需求原文「点击可以选择目录、文件」矛盾，见 §5 待确认 |
| D3 | **「新建分类」与「新建标记」是两个独立概念**（Alpha 里被分为两组），**分类不需要颜色** | 确认：分类**不复用** `ItemTag`。新增独立 `categories: {id, name}[]`（无 color）。这纠正了本文档上一版「复用 ItemTag」的建议 |
| D4 | 侧边栏「历史」「常用」点击后**切到仪表盘对应页签** | 走 `scrollStore.setActiveTab('dashboard', 'frequent' \| 'history')`。⚠️ **有坑**：`composables/use-restored-active-tab.ts:10` 只在 setup 时一次性读 store，若仪表盘页已挂载，外部 set 不会更新已创建的 ref —— 必须给该 composable 加 store→ref 的反向 watch |

---

## 1. 结论速览

| 需求 | 现状 | 真实缺口 | 风险 |
|---|---|---|---|
| N6 目录树滚动 | 三层 CSS 叠加失效 | 滚动容器没落在真实盒上 | **低**（纯布局） |
| N5 打开所属目录 | **action、文案、handler 全都存在**，只是菜单没渲染它 | 语义二选一 | **低**（走资源管理器语义时几乎零成本） |
| N3①②③ 菜单改造 | 数据源、折叠、拖拽全部现成 | 类型联合是写死的，要加两项 | **低** |
| N1 新建标记 | `createTag(name, color)` 已存在 | 没有封装好的「选目录/文件」组件 | **中** |
| N2 收藏分类 | 右键插槽现成、自定义显示名要新建 | 分类概念完全不存在；grid 拖拽要新建 | **较高**（碰持久化） |
| N3④ 分类分组 + 悬停子菜单 | — | **无可复用的二级子菜单方案** | **高**（依赖 N2 + 新交互模式） |

**依赖关系**：N3④ 依赖 N2 的分类数据；N1 与 N2 共用「新建对话框」基础设施（选目录/文件 + 配色）。

---

## 2. 逐项落点与风险（全部带行号）

### N6 · 目录树滚动 —— 根因是三层叠加

**根因（已定位到具体声明）**：
1. `file-browser-tree-view.vue:327-331` 声明了 `overflow-y: auto; height: 100%`，但这个 div 同时被套上全局类 `.sigma-ui-context-menu-trigger { display: contents }`（`components/ui/context-menu/context-menu-trigger.vue:17` 传类、`:24-26` 定 `display: contents`）。**全项目仅此一处 `display: contents`。** `display: contents` 元素不生成主盒，其 `height`/`overflow` 不生效。
2. `navigator.vue:1758-1762` 的 `.navigator-page__folder-tree { width/height:100%; overflow:auto }` 在 `:1332`/`:1507` 传给 `<FileBrowserTreeView>`，但该组件模板是**双根节点**（`ContextMenu` 在 `:255-307`，`FileBrowserRenameDialog` 在 `:311-323`），**Vue 对 fragment 根节点的属性透传失效，这个类从未落到 DOM 上**。
3. 最近的真实盒是 `[data-panel]`（`navigator.vue:1745-1750`，由 `ResizablePanel` = reka `SplitterPanel` 渲染 `data-panel=""`），其 `overflow: hidden` 把溢出内容裁掉 —— 这正是「看得见但滚不动」。

**项目自己的正确先例**：文件浏览器把滚动容器放在 ContextMenuTrigger **外面** —— `file-browser-content.vue:88-96` 用 `ScrollAreaRoot/Viewport`（`:177-204`），触发器内层（`file-browser-content-body.vue:64-80`）同样中了 `display:contents`，但祖先是 `flex-direction: column` 的 ScrollArea，所以照常竖排 + 滚动。全局搜索也是 ScrollArea（`global-search-view.vue:22,477`）。共用组件：`components/ui/scroll-area/`。

**推荐修法**：在 `navigator.vue` 把滚动容器放到真实盒上 —— 给 `.navigator-page__folder-tree-panel` 加 `overflow-y: auto`，或包一层 `<div class="navigator-page__folder-tree-scroll">`（`overflow-y:auto; height:100%; min-height:0`）。顺带让 `:1758-1762` 那条死规则可删。

**明确不做**：不摘 `context-menu-trigger.vue` 的 `display: contents` —— 会波及文件浏览器、空状态等所有 `as-child` 用法，回归面太大。

**关于「静态分析与截图矛盾」这一点,结论是:以截图为准,不需要跑 JS 实测。**

调研曾建议先执行 `getComputedStyle(document.querySelector('[data-e2e-root="file-tree-view"]')).display` 再动手。**这条在本项目执行不了** —— wry 不透传 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS`，CDP 连不上，拿不到 webview console（见 AGENTS.md）。

而**你的截图本身已经是证据**：树渲染成竖排。说明打包产物里 `display: contents` 并未导致横排（`mergeProps` 的 class 合并落点与静态推导不同）。因此上面第 1 种修法（把滚动容器放到 `[data-panel]` 这个真实盒上）不依赖那个未决问题，**可以直接做**。

替代取证手段：用 **UIA `BoundingRectangle`** 量树的行元素的 `Top`，相邻两行 `Top` 之差 > 0 即证明仍为竖排 —— 这条在本项目可执行（物理像素，记得 ÷1.5 换算）。

**验收判据（全部可用本项目现有工具执行）**：
- 展开足够多节点后，树的行元素总高度 > 面板可视高度，且**能滚动到最后一个节点**（用 UIA 找最后一个可见行，验证它出现在可视区域内）
- 相邻两行 `BoundingRectangle.Top` 之差 > 0（仍竖排）
- 面板的 `BoundingRectangle.Height` 恒定，不随节点数增长（回归护栏：树不能再把面板撑高）
- 截图确认滚动条可见

**附带事实**：树是全量 `v-for` 渲染（`file-browser-tree-view.vue:258-293`），**无虚拟列表**，节点多时 DOM 线性增长。修滚动不改变这一点。

---

### N5 · 搜索结果「打开所属目录」—— 好消息：这个功能已经建好了

**关键发现**：action 早就存在，只是没被渲染。
- `file-browser/types.ts:47` 的 `ContextMenuAction` 里已有 `open-containing-directory`
- 可见性规则已有：`utils/context-menu-action-visibility.ts:93-98`（仅 `entryTypes:['file']`、`:101` Windows 专属）
- handler 已有：`composables/use-file-browser-actions.ts:137-150` → `revealInExplorer` → `reveal_in_explorer`
- **17 个语言包的文案全都有**：`en.json:983`，中文 `ch.json:949`「打开文件所在目录」
- **但 `file-browser-actions-menu.vue` 只渲染 15 项**（`:205/224/242/261/279/337/370/389/401/413/421/429/441/449/462/472` 行），**不含它** —— 它目前只在目录树菜单里出现（`file-tree-context-menu.vue:127-131`）

**两套搜索 UI 其实是同一套**：全局搜索 `global-search-view.vue:564-575` 用 `:external-entries` + `:base-path` **复用 `FileBrowser`** 渲染；「目录搜索」= 文件浏览器工具栏的快速过滤（`file-browser-toolbar-filter.vue:181`，文案 key `fileBrowser.searchThisDirectory`，`en.json:905`），也是同一个 `FileBrowser`。两者共用 `file-browser-context-menu.vue` → `file-browser-actions-menu.vue`。**所以落点只有一处。**

**路径信息充足**：Rust `GlobalSearchResultEntry.path`（`src-tauri/src/global_search/types.rs:68`）→ store 映射进 `DirEntry.path`（`stores/runtime/global-search.ts:413-427`），父目录可用 `utils/normalize-path.ts:127` 的 `getParentDirectory`。

**✅ 决策 D1：采用「应用内导航」语义。** 现有资源管理器那套（`revealInExplorer`）保持不动，新增一条独立通道：

- 新增 action（如 `open-in-navigator`）+ handler，调 `openNavigatorPath(router, entry.path, { resolvePath: true })`
- `openNavigatorPath`（`utils/open-navigator-directory.ts:56-125`）会经 `resolvePathLaunchTarget` 解析出 `directoryPath + focusPath`，压入 `pendingLaunchReveal` 队列（`stores/storage/workspaces.ts:69-75, 976-984`）
- `navigator.vue:346-356` watch 后调 `applyPendingLaunchReveal()`（`:644-662`）→ `pane.requestFocusEntryAfterRefresh(parentPath, entryPath)`，实现「跳到父目录并选中该条目」
- **需要把 `isExternalMode` 从 `use-file-browser.ts:575-576` 透出到 `FileBrowserContext`**（`use-file-browser-context.ts:16-21` 目前没有该字段），并从 `file-browser-context-menu.vue` 透传 prop 给 `file-browser-actions-menu.vue:62-71`（它只收 props、不用 ctx），以免污染普通目录视图
- **新增 1 个 i18n key，17 个语言包同步**
- 关键点：**必须只在 `isExternalMode` 为真时出现** —— 否则普通目录视图里每个条目都会有两个几乎同名的项（资源管理器的 + 应用内的）

---

### N3 · 侧边栏仪表盘悬停菜单

**组件定位**：悬停触发在 `nav-sidebar.vue:164-204`；「仪表盘 Alt+3」行在 `nav-sidebar.vue:191-198`；「快速访问」行在 `components/quick-access-panel.vue:206-208`；分支渲染 `quick-access-panel.vue:221-309`。

**逐条**：

| 子项 | 状态 |
|---|---|
| ① 删两行文字 | **现成可做**。删 `nav-sidebar.vue:191-198` + `quick-access-panel.vue:206-208`。`getPageShortcutLabel`（`:93-99`）在 `:229` 仍被其它页面 tooltip 用，不会变死代码；Alt+3 来源 `stores/runtime/shortcuts.ts:54`，设置页也有展示，**不是唯一入口** |
| ② 加「常用」「历史」两个 section | 改 3 处：`types/user-settings.ts:178`（写死联合类型）+ 默认值 `stores/storage/user-settings.ts:228`、归一化 `nav-sidebar/utils/quick-access-section-order.ts:7-14`、渲染 `quick-access-panel.vue:221-309`。**数据可直接复用** `userStatsStore.sortedFrequentItems` / `sortedHistory`（`stores/storage/user-stats.ts:51-53`、`47-49`，上限各 100 在 `:31-32`），仪表盘页正是用这两个（`dashboard.vue:82-83`）。折叠状态是模块级 ref（`quick-access-panel.vue:9-10`、`:95-107`），不持久化，照抄即可。**拖拽排序无需新建** —— `SortableList` + `handle-selector`（`:212-220`）对新 section 自动生效 |
| ③ 分隔线 | **现成**。`components/ui/separator/separator.vue` 已存在；在 `:221` 循环里按索引插即可 |
| ④ 收藏夹分组 + 悬停子菜单 | **要新建**，且卡在数据模型：`FavoriteItem`（`types/user-stats.ts:18-21`）**只有 `path` + `addedAt`，没有 category 字段**（已确认） |
| ⑤ 点击跳转 | **决策 D4：切到仪表盘对应页签**。走 `scrollStore.setActiveTab('dashboard', 'frequent' \| 'history')`（`stores/runtime/scroll-restoration.ts:52`）。⚠️ **`use-restored-active-tab.ts:10` 只在 setup 时一次性读 store** —— 若仪表盘页已挂载（用户正是在仪表盘上悬停侧边栏），外部 set 不会更新已创建的 ref，**必须给该 composable 加 store→ref 的反向 watch**，否则会出现「点了没反应」。收藏与已标记区的现有跳转（`openItem` → `openNavigatorNavigablePath`，`:126-136`）保持不变 |

**最大不确定性：二级子菜单没有可复用方案。** `ContextMenuSub`（`components/ui/context-menu/context-menu-sub.vue`）与 `DropdownMenuSub` 都依赖各自 root 的 provide 注入，而面板挂在 reka-ui `Tooltip` 内容里，**脱离 ContextMenu 上下文，不能直接套**。项目里也**没有** hover-card 封装。

最小可行方案：复用 `components/ui/popover/popover.vue`（底层 `PopoverRoot`，支持 `v-model:open` + `PopoverPortal`），用 `hoveredSubmenuKey` ref 受控开合、`side="inline-end"` 弹出。比 context-menu 改动小，且不用新写定位/翻转逻辑。

**风险**：
1. **跳页签可能无效**：`composables/use-restored-active-tab.ts:10` 只在 setup 时一次性读 store，若仪表盘页已挂载，外部调 `scrollStore.setActiveTab('dashboard','frequent')`（`scroll-restoration.ts:52`）不会更新已创建的 ref，必须加 store→ref 的反向 watch。
2. **子菜单会打断父 Tooltip**：面板 Tooltip 由 `quickAccessTooltipOpen`（`nav-sidebar.vue:50-54`）驱动，鼠标移入弹出层若被 reka 判为离开 trigger，Tooltip 可能直接关闭。
3. **`⋮` 手柄会作用于全部 section**：`handle-selector`（`quick-access-panel.vue:216`）是全局选择器，新 section 自动获得拖拽能力，若不想要需额外排除。

---

### N1 · 新建标记

**落点**：菜单项加在 `modules/dashboard/components/dashboard-action-bar.vue:49-58`（`DropdownMenuContent` 内，现只有 `clearAll` 一项）；事件在 `pages/dashboard.vue:326-329` 接住。该组件已预留 `left`/`right` 具名插槽（`dashboard-action-bar.vue:35,38`），但 dashboard 四处调用都没传。

**可复用**：`createTag(name, color)`（`stores/storage/user-stats.ts:248`）已存在；`Dialog`/`Input`/`Button` 在 `components/ui/`；`composables/use-tag-inline-editor.ts` 封装了改名与颜色提交。

**缺口**：
- ~~没有封装的「选目录/文件」组件~~ —— **决策 D2 后不再需要**（只建标签定义，不选路径）。原先 6 处直接调 `open()` from `@tauri-apps/plugin-dialog` 的现状保持不变，不动。
- **颜色不是枚举而是自由 hex**（`types/user-stats.ts:8`）。现成 UI 只有 `components/ui/tag-selector/tag-selector.vue:293-301` 的原生 `<input type="color">`，且 `dashboard.vue:189` **另有一份硬编码 8 色数组 —— 两处色源不统一**。这是既有欠账，本轮顺手统一：新建对话框的取色器改为复用同一份 8 色色板，而不是再放一个原生 color input。

---

### N2 · 收藏分类与自定义显示名

| 子项 | 状态 |
|---|---|
| 新建收藏 | **缺**。`addToFavorites(path)`（`user-stats.ts:172`）只收 path |
| 新建分类 | **完全缺失**，无 categories 概念 |
| 右键改归属 | **现成**。`components/dir-entry-interactive/dir-entry-interactive.vue:214-219` 透传 `quick-actions` 插槽 → `dir-entry-context-menu.vue:108-113`，仪表盘卡片已全部被它包裹（`dashboard.vue:354`），**无需自研右键菜单** |
| 拖拽排序 | **需新建**。仪表盘收藏页签无拖拽；侧边栏有（`quick-access-panel.vue:231-244`），持久化走 `setFavorites`（`user-stats.ts:322-331`） |
| 自定义显示名 | **需新建**。`FavoriteItem` 只有 `{path, addedAt}` |

**✅ 决策 D3：分类是独立概念，不复用 `ItemTag`，且不带颜色。** 模型定为 `categories: {id, name}[]`（**无 `color` 字段**）。

理由（与用户的判断一致）：tag 是**多对多打标**（`TaggedItem.tagIds`，`types/user-stats.ts:11-16`），category 是收藏的**单归属分组**，语义不同 —— Alpha 里被分为两组正是这个意思。若强行复用会波及 `dashboard.vue:86-106`/`:340-383`、`entry-card-tags.vue:9-94`、`tag-selector.vue`、`dashboard-tag-section-header.vue`，以及 store 的 `getItemTags/addTagToItem/deleteTag`（`user-stats.ts:204-276`）。

**因为分类无颜色，N3④ 的悬停子菜单不需要展示色点**，实现面比预期小。

**自定义显示名的渲染面共 4 处**：`dashboard.vue:298-318`、`quick-access-panel.vue:231-244`、`quick-access-entry.vue:25-31`（`getPathDisplayName`）；`stores/runtime/global-search.ts:565` 按 path 匹配，不需要改。

**重命名联动**：唯一调用链 `composables/use-dir-entry-actions.ts:268-269` → `user-stats.ts:431-479`，**只改写 `item.path` 不碰显示名** —— 经本应用 UI 改名时自定义名保留（合理）。

**风险**：
1. **`SortableList` 不能直接用于仪表盘** —— 它的换位判定只比较 Y 轴行中点（`components/sortable-list/sortable-geometry.ts:15-32`），而仪表盘收藏是 `repeat(auto-fill, minmax(280px,1fr))` grid（`dashboard.vue:294-297`、`:564-568`），直接套用会算错目标索引。
2. **仪表盘与侧边栏共用同一个 `favorites` 数组顺序**，一处排序会静默覆盖另一处，两边交互必须统一。
3. **`FavoriteItem` 无 `isFile` 字段**，仪表盘现靠「路径含 `.`」猜（`dashboard.vue:134-140`），选中无扩展名文件会误判为目录。
4. **`applyStatsRecord`（`user-stats.ts:79-89`）只做顶层 key 整体覆盖**，新字段漏加进 `UserStats` 类型会被**静默丢弃**，不报错不告警。→ 本轮开工前先堵这个坑。

---

## 3. N4 · 扫描深度确认结论

**用户是对的，索引侧是递归的。** 证据链：

| 环节 | 位置 | 事实 |
|---|---|---|
| 设置默认值 | `stores/storage/user-settings.ts:177` | `globalSearch: { scanDepth: 7, ... }` |
| 传给后端 | `stores/runtime/global-search.ts:261` | `scan_depth: Math.max(1, Math.floor(settings.scanDepth))` |
| **索引侧消费** | `src-tauri/src/global_search/scan.rs:292-294` | `WalkDir::new(&root_path).follow_links(false).max_depth(scan_depth.max(1))` — **递归，深度吃这个设置** |
| 增量重建同值 | `scan.rs:729-731` | 同样是 `WalkDir ... .max_depth(scan_depth)` |

**但「只有一层」不是编的 —— 它说的是另一条通道。** 搜索是双通道：

```
一次查询 = 索引查询（递归，深度 = 扫描深度） + 重点路径快扫（只探一层）
```

- `src-tauri/src/global_search/query.rs:343-353` —— 目录直接 `std::fs::read_dir(path)` 收一层子项，文件收自己，**没有 `WalkDir`、没有深度参数**
- 更硬的证据：`GlobalSearchQueryOptions`（`src-tauri/src/global_search/types.rs:55-62`）只有 `limit / include_files / include_directories / exact_match / typo_tolerance / min_score_threshold` 六个字段，**根本没有深度字段** —— 这条通道在结构上就不可能被深度限制

**对 N5 的意义**：因为主通道已递归，「搜不到深层文件」不是真问题。真正的问题在快扫通道，而它服务于**收藏、历史、常用、下载、桌面**这些路径 —— 也就是说，在**未建索引的盘符或被忽略的路径**里搜不到深层文件。

---

## 4. 分批建议

| 批次 | 内容 | 依据 | 工期 |
|---|---|---|---|
| **预批 0** | 堵 `applyStatsRecord` 静默丢字段（逐字段 normalize + 类型层断言） | N2 会踩同一个坑，先堵 | 2–3 h |
| **第三批** | N6 目录树滚动 + N5 打开所属目录（D1）+ N3①②③⑤ 菜单改造（D4） | 三项互不依赖，均可独立验收，根因/落点都已钉死，决策已齐。**不含 N3④** —— 它依赖第五批才有的分类数据，做不了（上一版把 ④ 误列进第三批，此处更正） | 10–14 h |
| **第四批** | N1 新建标记（名称 + 颜色，D2）+ 统一色源 | 对话框只需两个字段，不碰路径选择 | 4–6 h |
| **第五批** | N2 收藏分类（D3，独立 `categories` 无颜色）+ 自定义显示名 + 右键改归属 + grid 拖拽 | 碰持久化；grid 拖拽要新建 | 10–14 h |
| **第六批** | N3④ 收藏夹分类分组 + 悬停子菜单 | 依赖第五批的分类数据；子菜单无可复用方案 | 8–12 h |

> 第三批工期比上一版上调（D1 从「几乎零成本」变成要新增 action + 透传 `isExternalMode` + 17 语言包；D4 要给 `use-restored-active-tab` 加反向 watch）。

每批前建分支 + tag 成对的回滚点（如 `rollback/3.3-baseline` / `rollback/batch3-merged`）。

---

## 5. 仍待确认的一个矛盾

**需求原文 N1 与决策 D2 直接冲突**：

> 原文：「点击可以**选择目录、文件**，选择标记名称，选择标记颜色」
> D2 答：「**只建标签定义，之后手动给条目打标**」

若真如 D2 所说「之后手动打标」，那「选择目录、文件」这一步在新建流程里就没有存在的意义。三种可能：

- **A（按 D2 理解）**：新建对话框 = 名称 + 颜色。不选路径。最简单，第四批 4–6 h。
- **B（按原文理解）**：新建对话框 = 名称 + 颜色 + 选目录/文件，建完立刻给选中项打标。需要新建路径选择组件（项目无封装，6 处直接调 Tauri `open()`），第四批回到 6–9 h。
- **C（两步都要）**：新建对话框只建定义；另外在仪表盘里给条目打标时提供一个「新建并应用」的快捷入口。

**这一条不阻塞第三批**（第三批不含 N1），可以并行推进。

---

## 5. 每批沿用的工作纪律

1. **每项改动都要有判别性测试** —— 必须证明「若实现退回旧行为则红」。本轮教训：缩略图那个 bug 就是纯数值表断言拦不住的，必须钉「装得下」这种下限不变量。
2. **真机验收必须用 `tauri build` 打包产物**，不能用 `tauri dev`（dev 下路由页内容区空白，界面结论一律作废）。
3. **验收标准只能是实际可见变化 / 实际像素值**，不是日志回显。
4. **动手前先跑归因实验**：N6 有一个静态分析与截图互相矛盾的点，必须先实测再动手。
5. **不擅自推 upstream**。

---

## 6. 验收环境陷阱（沿用）

- `Process.MainWindowHandle` 会落到 15×15 托盘窗；必须自己 `EnumWindows`，取 class 为 `Tauri Window`、可见、面积最大的。
- 改 `user-settings.json` 的 `defaultDirectory` 不够，`user-workspaces.json` 里保存的当前标签页优先。
- UIA / 截图量到的是**物理像素**，本机 DPI 144（150% 缩放），换算要除 1.5。
- `PrintWindow(hwnd, hdc, 2)` 在平滑滚动动画未结束时会抓到未绘制的黑块 —— 延长等待并连拍两次取后一帧。
- PowerShell 5.1 把无 BOM 的 `.ps1` 按 ANSI 读：所有 `.ps1` 必须纯 ASCII。
- JSON 一律用 Node `writeFileSync(..., 'utf8')` 写。
