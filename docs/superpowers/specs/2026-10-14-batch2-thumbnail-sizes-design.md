# 第二批设计：缩略图四档重定 + 网格视图联动

日期：2026-10-14
状态：待用户评审
所属系列：六项需求分批推进 · 第二批（需求 3.6）
起点：`rollback/batch1-merged-20261014-230005`（= main `fe23ab0f`）

---

## 1. 需求

| 编号 | 要求 |
|---|---|
| 3.6.1 | 保持 小 / 中 / 大 / 特大 四档，**菜单里去掉像素说明** |
| 3.6.2 | 列表视图： 小 = 32、中 = 48、大 = 64、特大 = 80 像素。**默认 中** |
| 3.6.3 | 缩略图档位**对网格视图同样生效**；以当前默认值（中）为基准，其余档位按比例缩放 |

---

## 2. 现状（实测，不是读注释）

| 事实 | 位置 |
|---|---|
| 列表缩略图像素**硬编码**在组件的 `effectiveSize` 计算里：24 / 32 / 48 / 54 | `file-browser-list-entry-thumbnail.vue:41-50` |
| 列表行高常量：42 / 42 / 64 / 70，带说明行 56 / 56 / 78 / 84 | `use-file-browser-virtual-layout.ts:45-50` |
| **网格分支根本没接 `thumbnailSize`**，`createGridRows` 收到的参数里没有它 | `use-file-browser-virtual-layout.ts:309-315` |
| 网格卡高 120 / 目录卡高 52 / 网格最小列宽 170 | 虚拟布局常量 + `file-browser-virtual-rows.ts:8` |
| 三个 CSS 变量在 `vars.css` 里**静态写死** | `styles/vars.css:35-37` |

结论：**当前缩略图像素、行高、网格尺寸分散在 4 个互不相干的副本里**，而且 CSS 与虚拟布局
各存一份同样的数字。这两份一旦不一致，虚拟滚动的行高就会算错——那是一个比"数字漂移"
隐蔽得多的故障（页面看起来正常，滚动或定位开始跳）。

### 一个已经排除的担忧

网格卡片放大**不会**让图片变糊：`file-browser-grid-card.vue:71` 用 ResizeObserver 量出
卡片实际尺寸，并以 `max(width, height)` 向缩略图缓存取图。卡片变大，缓存自动按新尺寸重生成。

---

## 3. 方案选择

- **方案 B（最小改动）**：逐个替换 4 处硬编码数字。diff 小，但四份副本继续各自漂移。
- **方案 A（采纳）**：抽单一事实来源模块，CSS 变量改为运行时按档位注入。

采纳 A。多写一个模块，换掉一类必然发生的故障。

---

## 4. 单一事实来源

新建 `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts`：

```ts
import type { ThumbnailSize } from '../types';

export interface FileBrowserThumbnailMetrics {
  /** 列表视图中缩略图的边长（像素） */
  listThumbnailPx: number;
  /** 列表行高 */
  listRowHeight: number;
  /** 带描述行的列表行高 */
  listRowHeightWithDescription: number;
  /** 网格视图媒体/文档卡片高度 */
  gridEntryHeight: number;
  /** 网格视图目录卡片高度 */
  gridDirEntryHeight: number;
  /** 网格视图最小列宽（决定列数） */
  gridMinColumnWidth: number;
}

export const FILE_BROWSER_THUMBNAIL_METRICS: Record<ThumbnailSize, FileBrowserThumbnailMetrics> = {
  small: {
    listThumbnailPx: 32, listRowHeight: 48, listRowHeightWithDescription: 62,
    gridEntryHeight: 80, gridDirEntryHeight: 35, gridMinColumnWidth: 113,
  },
  medium: {
    listThumbnailPx: 48, listRowHeight: 64, listRowHeightWithDescription: 78,
    gridEntryHeight: 120, gridDirEntryHeight: 52, gridMinColumnWidth: 170,
  },
  large: {
    listThumbnailPx: 64, listRowHeight: 80, listRowHeightWithDescription: 94,
    gridEntryHeight: 160, gridDirEntryHeight: 69, gridMinColumnWidth: 227,
  },
  xlarge: {
    listThumbnailPx: 80, listRowHeight: 96, listRowHeightWithDescription: 110,
    gridEntryHeight: 200, gridDirEntryHeight: 87, gridMinColumnWidth: 283,
  },
};

export function resolveThumbnailMetrics(size: ThumbnailSize): FileBrowserThumbnailMetrics {
  return FILE_BROWSER_THUMBNAIL_METRICS[size] ?? FILE_BROWSER_THUMBNAIL_METRICS.medium;
}

export function resolveThumbnailCssVariables(size: ThumbnailSize): Record<string, string> {
  const m = resolveThumbnailMetrics(size);
  return {
    '--navigator-list-view-entry-height': `${m.listRowHeight}px`,
    '--navigator-grid-view-entry-height': `${m.gridEntryHeight}px`,
    '--navigator-grid-view-dir-entry-height': `${m.gridDirEntryHeight}px`,
  };
}
```

### 数值是怎么来的

- **列表缩略图**：需求直接指定 32 / 48 / 64 / 80。
- **列表行高**：沿用现有的「缩略图 + 16 内边距」与「说明行 +14」两条既有规则
  （现状 48px→64 行、54px→70 行都是 +16；带说明行一律 +14）。
- **网格与目录卡**：按列表档位相对「中」的比例等比缩放，
  比例 = 32:48:64:80 ÷ 48 = 0.667 : 1 : 1.333 : 1.667。
  基准取当前默认值（中 = 120 / 52 / 170），所以**中档下网格观感与今天完全一致**。

---

## 5. CSS 变量的注入策略

**保留 `vars.css` 里的静态值作为 medium 档的兜底**，在文件浏览器根元素上用行内 style
按当前档位覆盖。

这样做的理由：若注入环节缺失或抛错，布局退化成 medium 档（也就是默认值），
而不是塌成无高度。属于优雅降级，不是静默出错。

| 文件 | 改动 |
|---|---|
| `styles/vars.css` | 三个变量**保持 medium 档现值不变**，仅补注释说明它们是兜底默认值、运行时会被覆盖 |
| `file-browser.vue` | 在根元素绑定 `:style="thumbnailCssVariables"`，值来自 `resolveThumbnailCssVariables(userSettings.navigator.thumbnailSize)` |

`file-browser-grid-card.vue` 与 `file-browser-list-view.vue` **不需要改**——
它们读的仍是同名 CSS 变量。

---

## 6. 各消费方改动

| 文件 | 改动 |
|---|---|
| `utils/file-browser-thumbnail-sizes.ts` | **新建**，见 §4 |
| `file-browser-list-entry-thumbnail.vue` | `effectiveSize` 改为读 `metrics.listThumbnailPx`，删掉 24/32/48/54 硬编码分支 |
| `use-file-browser-virtual-layout.ts` | 删除 6 个行高常量 + 2 个网格常量，改查 metrics；**`createGridRows` 接入 `thumbnailSize`**；`getGridColumnCount` 传档位的最小列宽 |
| `utils/file-browser-virtual-rows.ts` | `GRID_MIN_COLUMN_WIDTH` 常量改为函数入参；`getGridColumnCount` / `getGridLayoutMetrics` 增加该参数 |
| `file-browser.vue` | 注入 CSS 变量（见 §5） |

`ThumbnailSize` 类型复用 `file-browser/types.ts` 已有的定义，**不新建重复类型**。

---

## 7. 文案改动

### 去掉像素说明（3.6.1）

| key | 现值（中文） | 新值 |
|---|---|---|
| `thumbnailSizeSmall` | `小（24 像素）` | `小` |
| `thumbnailSizeMedium` | `中（32 像素）` | `中` |
| `thumbnailSizeLarge` | `大（48 像素）` | `大` |
| `thumbnailSizeXLarge` | `特大（54 像素）` | `特大` |

英文同步：`Small (24 px)` → `Small` 等四条。

### 描述文案必须一并改（否则就是错的）

`thumbnailSizeDescription` 现为「调整列表视图中缩略图的尺寸。」——网格也生效了之后这句话
不再准确。改为同时涵盖两种视图。

**这会新增/修改 i18n 值**，必须同步全部 17 个语言包（`createI18n` 无 `fallbackLocale`，
门禁 `messages-key-alignment.test.ts` 要求叶子 key 集合与 `en.json` 完全相等）。
**key 集合不变，只改取值**，因此不会触发"多/少 key"的失败，但仍要逐包写入。

---

## 8. 默认值

已经是 `medium`（`user-settings` schema 的默认值），**不需要改**。
需求 3.6.2 的"默认为 中"自动满足。

注意副作用：已在用 medium 档的老用户，缩略图会从 32px 变 48px。这是需求本意，非缺陷。

---

## 9. 测试与验收

### 9.1 自动化

- 新增 `utils/__tests__/file-browser-thumbnail-sizes.test.ts`：断言四档的全部六个数值，
  并断言 `resolveThumbnailMetrics` 对未知档位回落到 medium（防御脏配置）。
- 更新 `composables/__tests__/use-file-browser-virtual-layout.test.ts`：
  现有用例断言的是 42/56/64/70 旧值，**必须同步改成新值**，否则测试会红。
- `npm run ts` 0 error。
- `npx eslint .`（**不带 `--fix`**）问题数不超过既有基线 188 errors / 121 warnings。
- 门禁：`src/localization` 相关两个测试必须绿。

> ⚠️ 全量单测在这台机器上**默认 5 秒阈值会假红**（175 个测试文件并行必超时，基线同样复现）。
> 跑全量时用 `npm run test:unit:run -- --testTimeout=30000`。此现象已在第一批坐实。

### 9.2 真机验收（必须用 `tauri build` 产物，`tauri dev` 的界面结论一律作废）

逐档核对，列表视图与网格视图**都要看**。

以下列数/列宽是**按 `getGridColumnCount` 公式实算的**（间距 12px，视口 2000px）：
`columnCount = floor((视口宽 + 间距) / (最小列宽 + 间距))`，`实际列宽 = (视口宽 − (列数−1)×间距) / 列数`。

| 档位 | 列表预期 | 网格最小列宽 | 网格实际列宽 | 卡高 | 列数 | 长宽比 |
|---|---|---|---|---|---|---|
| 小 | 缩略图 32px，行高 48 | 113 | 113 | 80 | 16 | 1.41 |
| **中**（默认） | 48px，行高 64 | 170 | 170 | 120 | 11 | 1.42 |
| 大 | 64px，行高 80 | 227 | 239 | 160 | 8 | 1.49 |
| 特大 | 80px，行高 96 | 283 | 323 | 200 | 6 | 1.62 |

长宽比从 1.42 漂到 1.62，说明**档位放大时卡片会略微变宽，不会被拉成高瘦条**——
这正是 §3 选方案 A（列宽联动）而非只改高度要达到的效果。

（2560px 宽窗口下的参考值：小 20 列 / 中 14 / 大 10 / 特大 8。）

**判别标准是"卡片实际像素尺寸与列数"**，不是"设置项显示成什么"。
缩略图清晰度也要看一眼，确认缓存按新尺寸重新生成了。

### 9.3 发版

本批同样**不单独发版**，版本号保持 3.1.1，随用户指定的下一个版本一起走发版流程。

---

## 10. 回滚

起点即回滚点：

```
tag    rollback/batch1-merged-20261014-230005 → fe23ab0f
分支   rollback/batch1-merged                 → fe23ab0f
```

整批回退：`git reset --hard rollback/batch1-merged`（**注意**：该仓库有大量历史分支与
未跟踪文件属历史沉淀，禁止 `git clean`）。

---

## 11. 本批不做

- 不动 `showListThumbnails`（「列表视图中显示缩略图」）开关的语义——网格始终显示缩略图、
  不受该开关影响，这条不变。
- 不动缩略图缓存的实现（`getImageThumbnail` 已按 `maxDimension` 分档）。
- 不改需求 3.2 / 3.3 / 3.4。

---

## 12. 工期

| 事项 | 预估 |
|---|---|
| 新建 metrics 模块 + 测试 | 1 小时 |
| 四个消费方改造 | 1.5–2 小时 |
| 17 语言包文案 | 0.5 小时 |
| 门禁 + `tauri build` + 真机逐档验收 | 1.5 小时 |
| **合计** | **4.5–5 小时** |
