# 第四批 —— 用户反馈 5 条（2026-10-15）

> 基线：`feat/batch3-tree-scroll-and-nav` 分支，第三批已验收推送。
> 本文只记录**这一轮反馈**的处理方案；第三批的 N1–N6 见 `2026-10-15-next-stage-plan.md`。

---

## 0. 反馈清单与本轮结论

| # | 用户反馈 | 性质 | 状态 |
|---|---|---|---|
| 1 | 四个箭头「跳仪表盘页签」行为 | 验收确认 | ✅ 用户现场确认全部通过，含新增的收藏夹/已标记 |
| 2 | 搜索结果右键项：改名「打开所属目录」；行为改为**拆分窗口、右侧显示** | 改需求 | ✅ 本批已改 |
| 3 | 目录内搜索没递归，只搜当前层 | 补能力 | ⏳ 本批只出方案，需 Rust + 前端双侧改动 |
| 4 | 收藏夹/已标记页签缺「新建分类/标记」入口，缺排序、改分类等编辑 | 补能力 | ⏳ 本批只出方案，工作量最大 |
| 5 | 侧栏菜单：收藏夹/已标记默认展开、常用/历史默认收起；子菜单缩进；面板加宽 | 改样式 | ✅ 本批已改 |

---

## 1. 反馈 2 —— 「打开所属目录」

### 1.1 文案

用户要求显示为「打开所属目录」。

**但不能照抄到英文**：`openContainingDirectory`（资源管理器版，Windows 专有）在 `en.json` 里
本来就是 `Open containing directory`，中文却是「打开文件所在目录」。搜索结果视图里
右键一个**文件**时这两条会同时出现（`context-menu-action-visibility.ts:94-107`）：

- 资源管理器版：`entryTypes: ['file']`
- 应用内版：`entryTypes: ['file', 'directory']`，且只在搜索结果视图出现

中文靠两条不同措辞区分，英文照抄就会变成两条一模一样的菜单项。所以：

| 包 | explorer 版 | 应用内版 |
|---|---|---|
| `ch` | 打开文件所在目录 | **打开所属目录** |
| 其余 16 包（占位英文） | Open containing directory | Show containing folder in split view |

### 1.2 行为：拆分窗口而不是原地跳转

原实现走 `applyLaunchTarget`，而它的分支是「已在导航器路由 → 当前标签页打开，
否则 → 新开标签组」。用户要的是**恒定拆分**（原位置留一份上下文，右侧看所属目录），
所以 `openNavigatorRevealEntry` 改成直接调 `openNewTabGroup`，不再经过那个分支。

导航器的标签组是 `SplitterPanel` 并排布局，新标签组出现在**右侧**，与用户描述一致。

---

## 2. 反馈 5 —— 侧栏面板

| 子项 | 改动 | 落点 |
|---|---|---|
| 默认展开 | 收藏夹/已标记恒定展开，常用/历史恒定收起 | `quick-access-panel.vue:131-141` |
| 子菜单缩进 | `padding-inline-start` 20px → 28px | `quick-access-section.vue` |
| 面板加宽 | `--quick-access-panel-width` 260px → 300px | `styles/vars.css:23` |

默认展开从「有内容就展开」改成固定值，是因为常用 100 条 + 历史 100 条会把面板拉成一长串，
随手要点的收藏夹/已标记反而被挤在折叠线之上。`openStates` 仍只在用户手动切换后接管，
**手动折叠的偏好不受影响**。

---

## 3. 反馈 3 —— 目录内搜索递归化（本批只出方案）

### 3.1 根因（已复核，早前结论是错的）

目录内搜索**纯前端内存过滤**，全程不调任何 Tauri command：

```
file-browser-toolbar-filter.vue:178   输入框 update:filterQuery
  → file-browser-toolbar.vue:91 → file-browser.vue:262
  → use-file-browser-filter.ts:34     filterQuery 状态
  → use-file-browser-entries.ts:52-70 items = dirContents.entries.filter(matchesQuickSearch)
  → file-browser-entry-quick-search.ts:323-382  纯字符串匹配，无 IO
```

数据源只有一层：`use-file-browser-navigation.ts:137` 的 `invoke('read_dir', { path })`。

**早前「`query.rs:343-353` 只做一层 `read_dir`」这条结论的对象认错了** —— 那个函数是
全局搜索的 `global_search_query_paths`（优先路径补充查询），不在目录内搜索链路上。
全局搜索之所以能递归，是因为它走 tantivy 索引，索引由 `scan.rs:292-294` 的
`WalkDir::max_depth` 构建。

### 3.2 改动面

| 文件:行号 | 改什么 |
|---|---|
| `src-tauri/src/global_search/query.rs:329-357` | 新增递归版本（`read_dir` → `WalkDir` + `max_depth`），复用 359-430 的打分/排序块 |
| `src-tauri/src/global_search/ignore.rs:42/74` | 递归后复用 `IgnoredPathMatcher`（已 `pub(super)`） |
| `src-tauri/src/global_search/commands.rs:52-60` + `lib.rs` | 新增 command 并注册 |
| `use-file-browser-entries.ts:52-70` | 由「同步纯过滤」改为「合并远端结果」；空查询回落到全量 |
| `use-file-browser-filter.ts:34` | 加防抖 / 取消（对齐 `global-search.ts:342-347` 的 AbortController 模式） |
| `types/user-settings.ts:222` / `stores/storage/user-settings.ts:177` | 深度复用 `globalSearch.scanDepth`（默认 7） |
| `use-file-browser.ts:527-543` | 首条选中逻辑需复核（现有假定结果是目录子集） |

**风险点**：目录内搜索逐字符触发，递归扫盘必须防抖 + 可取消，否则大目录会打爆 IO。

---

## 4. 反馈 4 —— 仪表盘收藏夹/已标记的入口与编辑（本批只出方案）

### 4.1 现状缺口

| 能力 | 收藏页签 | 已标记页签 |
|---|---|---|
| `⋮` 菜单 | **只有「清空」**（`dashboard-action-bar.vue:50-57`，四页签共用） | 同左 |
| 新建收藏 / 新建标记 | ❌ 不存在 | ❌ 只能在卡片内的 tag 选择器里建 |
| 可复用新建对话框 | ❌ 全仓没有 | ❌ |
| 拖拽排序 | ❌ 仪表盘内没有，**只有侧栏面板有** | ❌ |
| 改归属分类 | ❌ 数据层无「分类」概念 | — |
| 标记重命名/改色/删除 | — | ✅ 有，但入口在卡片内联和分区标题 hover，不在 `⋮` |

### 4.2 四个必须先解决的问题

**A. 「分类」在数据层完全不存在。** 全仓搜 `category|categories|categoryId` 只命中设置页目录、
扩展分类和 i18n 文案，与 `FavoriteItem` 无关。`FavoriteItem` 只有 `path` + `addedAt`
（`types/user-stats.ts:18-21`）。要从零新增，且**必须**同时往 `DEFAULT_USER_STATS` 加
`favoriteCategories: []` —— 否则 `user-stats.ts:45` 的 `USER_STATS_TOP_LEVEL_KEYS` 白名单
会静默丢弃该字段（该处 35-45 行注释明写了这个坑）。

**B. 仪表盘收藏是 grid，`SortableList` 会算错索引。** `sortable-geometry.ts:5-13` 从
listTop 起逐项累加高度算行中点，`getNeighborReorderIndex`（`:15-32`）只比 Y。
N 列并排时中点被累加成「N 倍高」的假坐标，横向跨列完全无感知。
要改：`captureRowHeights` 改存每个 item 的完整 `getBoundingClientRect()`，
算 `columnCount = round(listWidth / itemWidth)`，把指针映射成 `(col, row)`。
`sortable-geometry.test.ts` 要补 grid 用例。

**C. `FavoriteItem` 没有 `isFile`。** `dashboard.vue:134-140` 靠「路径含 `.`」猜，
`my.folder` 这类含点目录会被当文件。对「在仪表盘新建收藏」意味着：对话框里只有路径字符串，
无从判定类型。要么让用户选文件/目录，要么给 `FavoriteItem` 补 `isFile`
（`TaggedItem` 已有该字段可作模板，但需同步 `entry-card.vue` / `DirEntryInteractive`
调用点与 `handlePathRenamed`）。

**D. 落盘与迁移。** `user-stats.json` 是扁平键结构、**无 `__schemaVersion`**。
迁移机制存在（`stores/schemas/schema-utils.ts` 的 `migrateStorageSchema`，用法见
`user-settings.ts:586-593`）但**没接到 user-stats**，`stores/schemas/` 下也没有
`user-stats.ts`。好消息是纯新增数组字段靠 `applyStatsRecord` 的逐字段覆盖 +
`DEFAULT_USER_STATS` 缺省即可完成「软迁移」，不必引入 schema 版本。
仍需确认：后端启动 bootstrap 是否按 key 白名单放行（`startup-storage-bootstrap.ts:17-22`
目前只按文件维度）。

### 4.3 建议拆成两批

- **4a**：新建收藏 / 新建分类 / 新建标记三个对话框 + `favoriteCategories` 数据结构 + 三个入口
- **4b**：grid 拖拽排序 + 收藏改归属分类 + 标记排序/重命名/改色上移到 `⋮`

---

## 5. 待用户拍板的两个产品边界

1. **目录内搜索要不要复用全局搜索的「扫描深度」设置**（默认 7），还是给目录内搜索单独一个？
2. **仪表盘新建收藏时，要不要让用户选文件/目录**，还是只填路径 + 靠「含点」猜？
   （后者会继续误判含点目录）
