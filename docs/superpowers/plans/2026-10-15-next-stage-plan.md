# 下阶段规划 —— 3.2 收藏分类 / 3.3 标记新建 / 3.4 搜索重做

> 写于 2026-10-15。基线：`main` = `0f73f159`（网格四档修复已验收并推送）。
> 已完成：3.1 小房子跳此电脑、3.5 外链品牌化、3.6 缩略图四档（含 2026-10-15 截断修复）。

---

## 0. 一个必须先说清楚的前提

**这轮上下文里没有 3.2 / 3.3 / 3.4 的需求原文，只有需求名称。**

确认过三条路径都没有原文：

- 仓库 `docs/` 下的设计文档只记录已实施的批次（第一批设计文档里出现过「需求 3.2（收藏分类）、3.3（标记新建）、3.4（搜索重做）」这句排除声明，但只有名字，没有描述）；
- 本次会话早期消息已被上下文压缩，取不回来；
- GitHub issue 里 #530（Favourites 可重排）、#534（Enhance Tag Manager）是上游 issue，与你的 3.x 不是同一套编号。

所以本规划的做法是：**不编需求，先把代码现状摸到能决策的程度**，再把「会导致工作量差一个量级」的分叉点挑出来请你拍板。
下面每一条现状都带 `文件:行号`，是读代码读出来的，不是推测。

---

## 1. 总体判断：三项都不是从零做

这是本轮摸底最重要的结论，它改变了整个规划的性质。

| 需求 | 现有底座 | 真实缺口 |
|---|---|---|
| 3.3 标记新建 | 标签系统已成熟：全局标签表 + 按路径挂的标签集合，存储、编辑 UI、批量操作、增删改色、拖拽排序、反向 reconcile 全齐。**给已存在条目打标记已经做完了**（右键菜单 `edit-tags` → TagSelector） | **「新建流程里带标记」完全空白** |
| 3.2 收藏分类 | 收藏能增删、能拖拽排序、能被删改联动；**标签系统（含颜色、分组渲染）已经建好** | 收藏本身是一条裸路径列表，**零分类** |
| 3.4 搜索重做 | Tantivy 离线索引 + 双通道查询，索引侧**已递归**，并发/取消/进度/去抖齐全 | **重点路径快扫只探一层**（`query.rs:343-353`），子目录搜不到 |

**风险不在「能不能做」，在「做哪一档」。** 三项各自都有 2–3 种合理解读，且工作量差一个量级。

---

## 2. 三项的现状与分叉点

### 第三批 · 3.3 标记新建

**已核实的事实**：
- 数据模型 = 全局标签表 + 按路径挂的标签 id 集合。存储落 `user-data/user-stats.json`（`src-shared/user-storage-files.json:6` → `stores/storage/user-paths.ts:84` → `stores/storage/user-stats.ts:58`）。
- **解读 A「给已存在条目打标记」——已经做完了**：
  - 导航器右键菜单 `file-browser-actions-menu.vue:472-490`（`edit-tags` → `TagSelector`，五个事件齐全）
  - 看板 `entry-card-tags.vue:79-92`、`dashboard-tag-section-header.vue:41-45`
  - 可见性规则 `context-menu-action-visibility.ts:76-80` 对单选/多选、文件/目录全放开
  - 剩余小缺口：命令面板 / 快捷键入口；**设置页没有标记集中管理页**（`settings/ui/item.vue`、`categories/tabs/index.vue` 与标记无关，grep 命中的全是 `stagger` 假阳性）
- **解读 B「新建文件夹/文件时顺带打标记」——完全空白**，且要动**两条**新建链路：
  - 导航器：`file-browser.vue:325` → `use-file-browser-dialogs.ts:103` → `use-file-browser-selection.ts:834`
  - 通用组件：`dir-entry-interactive.vue:230` → `use-dir-entry-actions.ts:301`
  - 对话框 `file-browser-new-item-dialog.vue:23-26,116-140` 只有 name 字段，`confirm: [name: string]`
- 「新建标签」本身也没有独立流程，只能在 TagSelector 搜索框里顺带建（`tag-selector.vue:101-107`）。

**三条风险**：
1. `createTag` 用 `tag-${Date.now()}` 作 id（`user-stats.ts:250`），同毫秒建两个标签会撞 id，被 `reconcileMissingTagDefinitions` 静默合并成一个。
2. `applyStatsRecord:79-89` 只做顶层 key 整体覆盖，**不给嵌套对象补默认值**；给 `ItemTag` 加字段时旧数据会拿到 `undefined`，必须自己写逐字段 normalize。
3. **无 schema 版本号**：`schemaVersion` 字段存在（`startup-storage-bootstrap.ts:13`）但 user-stats 调 `canUseStartupStorageFastPath` 时不传版本（`user-stats.ts:92`），永远放行 —— 加字段只能靠 `DEFAULT_USER_STATS` 就地兼容，不能指望迁移。

**附带事实（规划用）**：`getTagsByIdsInListOrder`（`utils/item-tag-order.ts:7-13`）按**全局标签表**顺序渲染，`tagIds` 自身顺序被忽略 —— 所以系统里没有「每条目独立的标记排序」这个概念。标记也没有分类/分组字段，分组只存在于看板 UI 层。

---

### 第四批 · 3.2 收藏分类

**已核实的事实**：
- 收藏项结构 = `{path, addedAt}`（`src/types/user-stats.ts:18-21`），存在 `user-stats.json` 的 `favorites` 键（`user-stats.ts:155-160`）。
- **`user-stats.json` 没有 `__schemaVersion`**；而 `user-settings.json` 有（`stores/schemas/user-settings.ts:18-19`，当前 `= 31`）且 bootstrap 快路径会校验版本（`user-settings.ts:687`）。**动 settings 会让 Rust 侧 fast-path 降级，动 stats 不会**（`user-stats.ts:92` 不校验版本）。
- 项目里已有两套「分类」基础设施，但都不是收藏的：
  - **标签 tags**：`ItemTag = {id, name, color}`（`types/user-stats.ts:5-9`），可自建/改名/改色/删除（`user-stats.ts:248-302, 355-364`），**分组渲染已经写好了**（侧边栏 `quick-access-panel.vue:72-79`、dashboard `dashboard.vue:86-96`）
  - **section 顺序**：`QuickAccessSectionId = 'favorites' | 'tagged'`（`types/user-settings.ts:178`）是写死的字面量联合，只管顺序与折叠（`quick-access-section-order.ts:16-38`），**名字不可自定义**
- **推荐做法**：收藏项加 `categoryId?`，分类实体直接复用 `ItemTag` 结构；老收藏缺 `categoryId` 一律归入「未分类」，**不动版本号，用启动时幂等 reconcile** —— 这就是 `reconcileMissingTagDefinitions`（`src/utils/reconcile-user-stats-tags.ts:9-33`，每次 `init()` 后执行，`user-stats.ts:604`）的现成解法。
- **改动面**：3 个渲染面（侧边栏面板 / dashboard 收藏页签 / 空态）+ 1 个写入面（右键菜单 `use-dir-entry-actions.ts:374-388`）。

**三条风险**：
1. **新增字段会被静默丢弃**：`applyStatsRecord` 用 `if (key in userStats.value)` 过滤（`user-stats.ts:84-88`），新字段漏加进 `UserStats` 类型就不报错、也不落盘。
2. **拖拽排序会抹掉分类**：`setFavorites` 靠 `get-key = item.path`（`user-stats.ts:322-331`、`quick-access-panel.vue:142-144`）只回传 path，分组归属会丢，必须另开 reorder 通道。
3. **语言包门禁是全等的**：每个包叶子 key 集合必须与 `en.json` 完全相等（`messages-key-alignment.test.ts:14-20`），只比 key 不比值。

---

### 第五批 · 3.4 搜索重做

**已核实的事实，含两条否证**：
- 架构 =「Tantivy 离线索引 + 双通道查询」：先按深度给选定盘符建索引（递归），查询时并发跑「索引查询」与「重点路径快扫」再合并去重。
- ✅ **重点路径快扫只做一层 `read_dir`，无递归无深度参数**（`src-tauri/src/global_search/query.rs:343-353`）。
- ❌ **否证**「索引侧也只有一层」—— 索引侧是递归的 `WalkDir::new().follow_links(false).max_depth(scan_depth.max(1))`（`scan.rs:292-294`）。
- ✅ 该命令确实被全局搜索当 priorityPaths 用（`global-search.ts:376` 取 priorityPaths，`:392-400` invoke `global_search_query_paths`）—— **所以补递归必须加新参数或新命令，不能改老签名**。
- ❌ **否证**「搜索结果打开文件是 no-op」—— external 模式本身不导航（`use-file-browser.ts:306-309, 474-475`），但 emit 后 `navigator.vue:752-762` 会真正调 `navigateToPath` / `openFile`。**真实缺陷是搜完不定位、不高亮**：`navigateToPath` 只 `readDir`（`use-file-browser-navigation.ts:716-719`），而现成的 `pendingLaunchReveal` 机制（`navigator.vue:346-350, 655-661`）搜索结果没走。

**三个方向与代价**：

| 方向 | 内容 | 代价 | 评价 |
|---|---|---|---|
| ① 补递归 + 深度上限 | priorityPaths 快扫加递归，带 `max_depth` 与结果上限 | **小**。`walkdir = "2.5"` 已在 `Cargo.toml:49`，写法照抄 `scan.rs:292-294` | **推荐先做**，唯一实缺口 |
| ② 重做结果组织 | 目前只有一种结果视图（`view:568` 硬编码 `layout="list"`）、只按盘符一种分组（`view:162-184`）、无筛选栏 | **中**，体验改善明显但不治本，可与①并行 |
| ③ 重做搜索模型 | 统一多范围 / 实时索引 | **高**。改 `index.rs build_schema` 即触发 `SCHEMA_VERSION` 变更 → `validate_index` 走 `clear_index` 全量重建（`scan.rs:152-154`） | 不建议先动 |

**三条风险**：
1. **补递归后每次按键都全盘走**：`getAllPriorityPaths()`（`global-search.ts:549-582`）会带入多个用户目录，无上限时 `spawn_blocking` 任务堆积；而前端 `AbortController` 只丢弃响应、**不中断后端**（`:336-348`）。
2. **索引查询的 limit 不是硬上限**：`query.rs:299` 按盘符分组各自 `truncate(limit)`，总数可达 `limit × 盘数`，上限开关按直觉调会失效。
3. **改 schema 即触发全量重建索引**，用户等待成本从分钟级起。

---

## 3. 一条横跨三项的共同隐患

3.2 和 3.3 的调研**各自独立**指出了同一条：`applyStatsRecord`（`user-stats.ts:79-89`）
只做顶层 key 整体覆盖，既不校验新字段是否在 `UserStats` 类型里，也不给嵌套对象补默认值。
也就是说 —— **给收藏或标签加字段时，漏改类型的后果是静默丢数据，不报错、不告警。**

这一条值得在第三批开工前先单独处理（加一条 normalize + 一条类型层断言），否则后面两批都在同一个坑上走。

---

## 4. 每批沿用的工作纪律（上一批已验证有效）

1. **动手前建回滚点**：分支 + tag 成对，如 `rollback/3.3-baseline` / `rollback/batch3-merged`。
2. **每项改动都要有判别性测试** —— 测试必须证明「若实现退回旧行为则红」，不接受平凡通过的断言。
   （本批教训：网格那个 bug 就是纯数值表断言拦不住的，必须把「装得下」这种**下限不变量**钉住。）
3. **真机验收必须用 `tauri build` 打包产物**，不能用 `tauri dev`（dev 下路由页内容区空白，界面结论一律作废）。
4. **验收标准只能是实际可见变化 / 实际像素值**，不是日志回显。
5. **不擅自推 upstream**。

---

## 5. 需要你拍板的三个点

这三项各自决定一个量级的工作量差异。**拍板后我再出设计文档与实施计划。**

### ① 3.2 收藏分类：分类要不要跟现有标签打通？
- **A（推荐）** 复用现有标签做分类 —— 分组渲染已经写好，几乎零渲染成本。
- **B** 收藏要有一套独立分类，与标签互不相通 —— 要新建分类实体 + 配套 reconcile。

### ② 3.3 标记新建：「新建」指的是什么？
- **A** 新建文件夹/文件时顺带打标记（解读 B）—— 要动两条新建链路，是真正的流程改造。
- **B** 新建**标记**时能选颜色/归类 —— 与 A 是完全不同的线。
- 补充事实：如果你想的是「给已有条目打标记」，**那已经做完了**（右键菜单 → 编辑标记）。

### ③ 3.4 搜索重做：要解决的是「搜不到」还是「搜不准」？
- **A** 搜不到深层文件 → 走方向①（补递归 + 深度上限），小。
- **B** 不知道搜什么 / 搜不准 → 要加筛选维度甚至内容搜索，中到大。

---

## 6. 已知的验收环境陷阱（沿用，不重复踩）

- `Process.MainWindowHandle` 会落到 15×15 托盘窗；必须自己 `EnumWindows`，取 class 为 `Tauri Window`、可见、面积最大的。
- 改 `user-settings.json` 的 `defaultDirectory` 不够，`user-workspaces.json` 里保存的当前标签页优先，会把启动目录钉死。
- UIA / 截图量到的是**物理像素**，本机 DPI 144（150% 缩放），换算要除 1.5。
- `PrintWindow(hwnd, hdc, 2)` 在平滑滚动动画未结束时会抓到未绘制的黑块 —— 延长等待并连拍两次取后一帧再下结论。
- PowerShell 5.1 把无 BOM 的 .ps1 按 ANSI 读：所有 `.ps1` 必须纯 ASCII。
- JSON 一律用 Node `writeFileSync(..., 'utf8')` 写；`Set-Content -Encoding UTF8` 会写 BOM 导致解析失败。
