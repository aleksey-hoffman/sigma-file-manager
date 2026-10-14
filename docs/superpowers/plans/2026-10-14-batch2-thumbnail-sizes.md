# 缩略图四档重定 + 网格联动 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把缩略图四档重定为 32/48/64/80 像素（默认「中」），去掉菜单里的像素说明，并让档位对网格视图同样生效（卡片高度与列宽按比例联动）。

**Architecture:** 新建 `utils/file-browser-thumbnail-sizes.ts` 作为**唯一度量来源**，六个数字（列表缩略图边长、列表行高、带说明行行高、网格卡高、网格目录卡高、网格最小列宽）全部集中在一处。四个消费方（列表缩略图组件、虚拟布局、CSS 变量、网格列数）改为查表。CSS 变量保留 medium 静态值作兜底，运行时在文件浏览器根元素按档位覆盖。

**Tech Stack:** Vue 3 `<script setup>` + TypeScript、Vitest + @vue/test-utils、Tauri 2（打包验收）、Node 脚本改 17 个语言包。

## Global Constraints

- 面向用户的输出一律用**简体中文**；代码标识符、文件路径、命令保持原样。
- 品牌名统一 **Alpha File Manager**。受保护常量（mDNS 服务名、legacy 数据目录名、Tauri `identifier`）不得改动。
- 本批**不单独发版**：版本号保持 `3.1.1`，不跑 `release:prepare`，不动 `package.json` / `Cargo.toml` 版本。
- **真机验收必须用 `npm run tauri:build` 的打包产物**，不能用 `tauri dev`（dev 构建下所有路由页内容区空白，界面结论一律作废）。
- npm 必须经 `cmd.exe /d /c` 调用（Node 20+ 下 `.cmd` shim + `shell:false` 会 EINVAL）。本机 PowerShell 写法：`cmd.exe /d /c npm run ts`。
- 全量单测必须带 `--testTimeout=30000`：`npm run test:unit:run -- --testTimeout=30000`。默认 5 秒阈值下**基线也会假红**（本项目常态）。
- eslint 只量不改：`npx eslint .`（`npm run lint:eslint` 带 `--fix` 会改文件）。基线 = **188 errors / 121 warnings**，不得新增。
- **JSON 一律用 Node `writeFileSync(..., 'utf8')` 写入**，PowerShell `Set-Content -Encoding UTF8` 会写 BOM 导致 `JSON.parse` 失败。
- **提交信息一律写文件后 `git commit -F`**，PowerShell 会把 markdown 反引号当转义符。
- 禁止 `git clean` 或任何暴力清理；本仓库有大量历史分支与未跟踪文件属历史沉淀。
- 新增/删除 i18n key 必须同步全部 17 个语言包。本批**只改取值、不增删 key**，但仍要逐包写入。
- 本批的回滚点是 `rollback/batch1-merged`（= `fe23ab0f`），已在实施前建立，无需重建。
- 所有新文件必须带 SPDX 三行头（见本仓库既有 .ts 文件）。

## 设计文档与本计划的差异（执行前必读）

设计文档 `docs/superpowers/specs/2026-10-14-batch2-thumbnail-sizes-design.md` §6 的消费方清单**漏了两处**，本计划已补上。不要按设计文档的清单改，会漏：

1. **`utils/file-browser-box-selection-hit-test.ts`** 也读网格列宽。列宽一变，框选命中就会错位 —— 这是真 bug，不是洁癖。
2. **`__tests__/file-browser-list-entry-thumbnail.test.ts`** 断言了旧像素值（32 / 54），不同步改会红。

---

## File Structure

**新建**

| 文件 | 职责 |
|---|---|
| `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts` | 四档 × 六个度量的唯一来源；另导出 CSS 变量解析函数 |
| `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts` | 纯函数单测：四档全部数值 + 脏配置回落 + CSS 变量字符串 |

**修改**

| 文件 | 改动 |
|---|---|
| `file-browser-list-entry-thumbnail.vue` | `effectiveSize` 查表，删掉 24/32/48/54 硬编码分支 |
| `__tests__/file-browser-list-entry-thumbnail.test.ts` | 像素断言参数化为四档 |
| `utils/file-browser-virtual-rows.ts` | `getGridColumnCount` / `getFileBrowserGridLayoutMetrics` 增加 `minColumnWidth` 必填参数；删除 `GRID_MIN_COLUMN_WIDTH` |
| `composables/use-file-browser-virtual-layout.ts` | 删 6 个行高常量 + 2 个网格常量；`createGridRows` 接入档位；`gridColumnCount` 查表 |
| `composables/__tests__/use-file-browser-virtual-layout.test.ts` | 旧值 42/56/64/70 改新值；`getGridColumnCount` 调用补参数；新增网格随档位缩放用例 |
| `utils/file-browser-box-selection-hit-test.ts` | 增加 `gridMinColumnWidth` 必填选项 |
| `composables/use-file-browser-box-selection.ts` | 透传 `gridMinColumnWidth` |
| `composables/use-file-browser.ts` | 计算 `thumbnailMetrics` 并喂给框选 |
| `utils/__tests__/file-browser-box-selection-hit-test.test.ts` | 4 处调用补参数；新增「框选跟随档位」判别性用例 |
| `composables/__tests__/use-file-browser-box-selection.test.ts` | 1 处调用补参数 |
| `file-browser.vue` | 根元素绑定 `:style="thumbnailCssVariables"` |
| `styles/vars.css` | 三个变量值不变，仅加注释说明是兜底默认值 |
| `src/localization/messages/*.json` × 17 | 6 个取值改写（key 不变） |

**明确不改**：`file-browser-grid-card.vue`（第 71 行已用 ResizeObserver 按实际尺寸取图，卡片变大缓存自动重生成）、`file-browser-list-view.vue`（第 576 行只把 CSS 变量当 `min-height` 用）。

---

### Task 1: 单一事实来源模块

**Files:**
- Create: `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts`
- Create: `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts`

**Interfaces:**
- Consumes: `ThumbnailSize`（已存在于 `src/modules/navigator/components/file-browser/types.ts:17`，**不要新建重复类型**）
- Produces:
  - `interface FileBrowserThumbnailMetrics { listThumbnailPx: number; listRowHeight: number; listRowHeightWithDescription: number; gridEntryHeight: number; gridDirEntryHeight: number; gridMinColumnWidth: number }`
  - `const FILE_BROWSER_THUMBNAIL_METRICS: Record<ThumbnailSize, FileBrowserThumbnailMetrics>`
  - `function resolveThumbnailMetrics(size: ThumbnailSize): FileBrowserThumbnailMetrics`
  - `function resolveThumbnailCssVariables(size: ThumbnailSize): Record<string, string>`

**数值表**（Task 1 测试直接断言这张表，后续任务全部依赖它）：

| 档位 | listThumbnailPx | listRowHeight | listRowHeightWithDescription | gridEntryHeight | gridDirEntryHeight | gridMinColumnWidth |
|---|---|---|---|---|---|---|
| small | 32 | 48 | 62 | 80 | 35 | 113 |
| medium | 48 | 64 | 78 | 120 | 52 | 170 |
| large | 64 | 80 | 94 | 160 | 69 | 227 |
| xlarge | 80 | 96 | 110 | 200 | 87 | 283 |

- [ ] **Step 1: 写失败测试**

创建 `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts`：

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求 3.6 缩略图四档重定（2026-10-14）。
// 这张表是四个消费方的唯一事实来源，改这里等于改全局。

import { describe, expect, it } from 'vitest';
import type { ThumbnailSize } from '../../types';
import {
  FILE_BROWSER_THUMBNAIL_METRICS,
  resolveThumbnailCssVariables,
  resolveThumbnailMetrics,
} from '../file-browser-thumbnail-sizes';

describe('FILE_BROWSER_THUMBNAIL_METRICS', () => {
  it.each([
    ['small', { listThumbnailPx: 32, listRowHeight: 48, listRowHeightWithDescription: 62, gridEntryHeight: 80, gridDirEntryHeight: 35, gridMinColumnWidth: 113 }],
    ['medium', { listThumbnailPx: 48, listRowHeight: 64, listRowHeightWithDescription: 78, gridEntryHeight: 120, gridDirEntryHeight: 52, gridMinColumnWidth: 170 }],
    ['large', { listThumbnailPx: 64, listRowHeight: 80, listRowHeightWithDescription: 94, gridEntryHeight: 160, gridDirEntryHeight: 69, gridMinColumnWidth: 227 }],
    ['xlarge', { listThumbnailPx: 80, listRowHeight: 96, listRowHeightWithDescription: 110, gridEntryHeight: 200, gridDirEntryHeight: 87, gridMinColumnWidth: 283 }],
  ] as Array<[ThumbnailSize, Record<string, number>]>)(
    'defines every metric for %s',
    (size, expected) => {
      expect(FILE_BROWSER_THUMBNAIL_METRICS[size]).toEqual(expected);
    },
  );

  it('keeps the description row exactly 14 px taller than the plain row', () => {
    for (const metrics of Object.values(FILE_BROWSER_THUMBNAIL_METRICS)) {
      expect(metrics.listRowHeightWithDescription - metrics.listRowHeight).toBe(14);
    }
  });
});

describe('resolveThumbnailMetrics', () => {
  it('falls back to medium for an unknown or dirty configured size', () => {
    expect(resolveThumbnailMetrics('huge' as ThumbnailSize))
      .toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium);
  });
});

describe('resolveThumbnailCssVariables', () => {
  it('emits the three CSS variables consumed by list and grid views', () => {
    expect(resolveThumbnailCssVariables('large')).toEqual({
      '--navigator-list-view-entry-height': '80px',
      '--navigator-grid-view-entry-height': '160px',
      '--navigator-grid-view-dir-entry-height': '69px',
    });
  });

  it('emits the medium fallback values for a dirty configured size', () => {
    expect(resolveThumbnailCssVariables('huge' as ThumbnailSize)).toEqual({
      '--navigator-list-view-entry-height': '64px',
      '--navigator-grid-view-entry-height': '120px',
      '--navigator-grid-view-dir-entry-height': '52px',
    });
  });
});
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts
```

Expected: FAIL —— `Failed to resolve import "../file-browser-thumbnail-sizes"`（模块还不存在）。**必须是这个失败**；如果报别的错（比如 vitest 配置问题），先修环境再往下走。

- [ ] **Step 3: 写实现**

创建 `src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts`：

```ts
// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 缩略图四档的唯一度量来源（需求 3.6，2026-10-14）。
// 缩略图像素、列表行高、网格卡高、网格最小列宽全部从这里取。
// 以前这些数字散在组件 props、虚拟布局常量、CSS 变量三处各存一份，
// CSS 与虚拟布局不一致时虚拟滚动的行高会算错 —— 那比"数字漂移"隐蔽得多。

import type { ThumbnailSize } from '../types';

export interface FileBrowserThumbnailMetrics {
  /** 列表视图中缩略图的边长（像素） */
  listThumbnailPx: number;
  /** 列表行高（缩略图 + 16 留白） */
  listRowHeight: number;
  /** 带说明行的列表行高（行高 + 14 说明行） */
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
    listThumbnailPx: 32,
    listRowHeight: 48,
    listRowHeightWithDescription: 62,
    gridEntryHeight: 80,
    gridDirEntryHeight: 35,
    gridMinColumnWidth: 113,
  },
  medium: {
    listThumbnailPx: 48,
    listRowHeight: 64,
    listRowHeightWithDescription: 78,
    gridEntryHeight: 120,
    gridDirEntryHeight: 52,
    gridMinColumnWidth: 170,
  },
  large: {
    listThumbnailPx: 64,
    listRowHeight: 80,
    listRowHeightWithDescription: 94,
    gridEntryHeight: 160,
    gridDirEntryHeight: 69,
    gridMinColumnWidth: 227,
  },
  xlarge: {
    listThumbnailPx: 80,
    listRowHeight: 96,
    listRowHeightWithDescription: 110,
    gridEntryHeight: 200,
    gridDirEntryHeight: 87,
    gridMinColumnWidth: 283,
  },
};

// 用户设置可能来自被手改过的配置文件，运行时不能假定它一定落在四档内，
// 因此这里按 string 索引并显式回落，而不是让 TS 的 Record 类型掩盖脏数据。
const THUMBNAIL_METRICS_BY_SIZE = FILE_BROWSER_THUMBNAIL_METRICS as Record<
  string,
  FileBrowserThumbnailMetrics | undefined
>;

export function resolveThumbnailMetrics(size: ThumbnailSize): FileBrowserThumbnailMetrics {
  return THUMBNAIL_METRICS_BY_SIZE[size] ?? FILE_BROWSER_THUMBNAIL_METRICS.medium;
}

export function resolveThumbnailCssVariables(size: ThumbnailSize): Record<string, string> {
  const metrics = resolveThumbnailMetrics(size);

  return {
    '--navigator-list-view-entry-height': `${metrics.listRowHeight}px`,
    '--navigator-grid-view-entry-height': `${metrics.gridEntryHeight}px`,
    '--navigator-grid-view-dir-entry-height': `${metrics.gridDirEntryHeight}px`,
  };
}
```

- [ ] **Step 4: 跑测试，确认通过**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts
```

Expected: PASS，9 个用例（4 + 1 + 1 + 2 + 1）。

- [ ] **Step 5: 提交**

```bash
git add src/modules/navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts src/modules/navigator/components/file-browser/utils/__tests__/file-browser-thumbnail-sizes.test.ts
```
提交信息写入文件 `F:\soft\00selfmade\filemanager\sigma-file-manager\.git\COMMIT_MSG_T2.txt`，内容：

```
feat: add single source of truth for thumbnail size metrics

需求 3.6（2026-10-14 第二批）：缩略图四档重定为 32/48/64/80，
并让档位对网格视图生效。缩略图像素、列表行高、网格卡高与最小列宽
此前散在组件 props、虚拟布局常量、CSS 变量三处各存一份，
CSS 与虚拟布局一旦不一致，虚拟滚动行高就会算错。

新增 utils/file-browser-thumbnail-sizes.ts 集中全部度量，
供后续任务改造四个消费方。本任务只加模块与测试，不改任何消费方。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

---

### Task 2: 列表缩略图组件改查度量表

**Files:**
- Modify: `src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue:21`（props 注释）、`:38-50`（`effectiveSize`）
- Modify: `src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts:118`、`:121-134`、`:192`

**Interfaces:**
- Consumes: `resolveThumbnailMetrics(size): FileBrowserThumbnailMetrics`（Task 1）
- Produces: 无新导出。组件对外行为不变，仍接受可选 `size` 数字 prop 优先。

- [ ] **Step 1: 写失败测试**

改 `__tests__/file-browser-list-entry-thumbnail.test.ts`。把 `:118` 那条断言 `getImageThumbnail).toHaveBeenCalledWith(entry, 32)` 的用例扩成四档参数化；把 `:121-134` 的 xlarge 用例换成同一套参数化；把 `:192` 的 `cancelImageThumbnail).toHaveBeenCalledWith(entry, 32)` 改成 `48`。

具体做法：先加一个新的参数化用例（旧的 xlarge 用例暂时保留，它会红）：

```ts
  // FORK-MODIFICATION: 需求 3.6 四档重定为 32/48/64/80。
  it.each([
    ['small', 32],
    ['medium', 48],
    ['large', 64],
    ['xlarge', 80],
  ] as Array<[typeof mockThumbnailSize, number]>)(
    'requests a %s thumbnail at %i px',
    async (size, expectedPx) => {
      mockThumbnailSize = size;
      const entry = createEntry({ path: `C:/photo-${size}.jpg`, ext: 'jpg' });
      const wrapper = mount(FileBrowserListEntryThumbnail, {
        props: { entry },
        global: { stubs: { Teleport: true } },
      });

      enterViewport();
      await wrapper.vm.$nextTick();

      expect(getImageThumbnail).toHaveBeenCalledWith(entry, expectedPx);
      const image = wrapper.find('img.file-browser-list-entry-thumbnail__image');
      expect(image.attributes('width')).toBe(String(expectedPx));
      expect(image.attributes('height')).toBe(String(expectedPx));
    },
  );
```

- [ ] **Step 2: 跑测试，确认失败**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
```

Expected: FAIL —— small 档期望 32 实际 24；large 档期望 64 实际 48；xlarge 期望 80 实际 54；medium 期望 48 实际 32。**必须看到这四个数字全错**；如果只有 medium 挂了，说明参数化没生效，回头查测试本身。

- [ ] **Step 3: 写实现**

在 `file-browser-list-entry-thumbnail.vue` 的 import 区（第 16 行 `import { getImageSrc } from './utils';` 之后）加：

```ts
import { resolveThumbnailMetrics } from './utils/file-browser-thumbnail-sizes';
```

把第 21 行的 props 注释改为：

```ts
  // 显式传入时优先；否则按 navigator.thumbnailSize 设置（见 utils/file-browser-thumbnail-sizes.ts）
  size?: number;
```

把第 38-50 行整段替换为：

```ts
// 缩略图档位 → 像素尺寸，唯一来源是 utils/file-browser-thumbnail-sizes.ts。
// 显式传入 props.size 优先（保持向后兼容）；未传则按 setting 查表。
const effectiveSize = computed<number>(() => {
  if (typeof props.size === 'number') {
    return props.size;
  }

  return resolveThumbnailMetrics(userSettingsStore.userSettings.navigator.thumbnailSize)
    .listThumbnailPx;
});
```

- [ ] **Step 4: 清理旧断言并跑测试，确认通过**

删掉原来那条 `'uses 54 px when thumbnailSize is xlarge'` 用例（已被参数化用例覆盖，标题里的 54 也不再成立）；把取消用例的 32 改成 48：

```ts
    expect(cancelImageThumbnail).toHaveBeenCalledWith(entry, 48);
```

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
```

Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add src/modules/navigator/components/file-browser/file-browser-list-entry-thumbnail.vue src/modules/navigator/components/file-browser/__tests__/file-browser-list-entry-thumbnail.test.ts
```
提交信息写入 `.git/COMMIT_MSG_T2.txt`：

```
feat: drive list thumbnail pixels from the shared metrics table

effectiveSize 原本在组件里硬编码 24/32/48/54 四个像素值。改为查
utils/file-browser-thumbnail-sizes.ts，档位重定为 32/48/64/80。

测试同步参数化为四档，并断言 img 的 width/height 属性，
避免以后只改了取图尺寸、没改渲染尺寸这类半改。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

---

### Task 3: 虚拟布局行高与网格尺寸接入档位

**Files:**
- Modify: `src/modules/navigator/components/file-browser/utils/file-browser-virtual-rows.ts:8`、`:54-60`、`:110-118`
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-virtual-layout.ts:40-53`、`:138-156`、`:174-178`、`:251-298`、`:300-319`、`:364`
- Modify: `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-virtual-layout.test.ts:57-58`、`:63-111`、`:206-212`、`:274-275`、`:295-296`

**Interfaces:**
- Consumes: `resolveThumbnailMetrics(size)`、`FILE_BROWSER_THUMBNAIL_METRICS`（Task 1）；`ThumbnailSize`（已有）
- Produces（签名变化，后续任务依赖）：
  - `getGridColumnCount(viewportWidth: number, gridGap: number, minColumnWidth: number): number` —— **第三个参数必填**
  - `getFileBrowserGridLayoutMetrics(contentWidth: number, gridGap: number, minColumnWidth: number): FileBrowserGridLayoutMetrics`
  - `createFileBrowserVirtualRows(options)` 的 `thumbnailSize?: ThumbnailSize` 现在**对 grid 布局同样生效**
  - **删除**导出 `GRID_MIN_COLUMN_WIDTH`

**删除前先确认引用面**：`GRID_MIN_COLUMN_WIDTH` 是删除而不是保留转发。已核实全仓只有 `file-browser-virtual-rows.ts` 自身使用它（`getGridColumnCount` 第 59 行），可安全删除。执行时用编辑器全局搜索 `GRID_MIN_COLUMN_WIDTH` 复核一遍——若发现本计划未列出的引用，**停下来报告**，不要自行扩大改动范围。

- [ ] **Step 1: 写失败测试**

改 `composables/__tests__/use-file-browser-virtual-layout.test.ts`：

(a) 第 57-58 行，把默认（medium）用例的期望改新值：

```ts
    expect(rows.map(row => row.start)).toEqual([0, 64, 142]);
    expect(rows.map(row => row.size)).toEqual([64, 78, 64]);
```

(b) 第 62-111 行整个 `describe('thumbnailSize')` 块替换为：

```ts
  // FORK-MODIFICATION: 需求 3.6 四档重定 32/48/64/80，行高 = 缩略图 + 16（带说明行 +14）。
  describe('thumbnailSize', () => {
    it('medium (default): list rows are 64 / 78', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'medium',
      });
      expect(rows.map(row => row.size)).toEqual([64, 78, 64]);
    });

    it('small: list rows shrink to 48 / 62', () => {
      const entries = [createEntry('a'), createEntry('b')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'small',
      });
      expect(rows.map(row => row.size)).toEqual([48, 62]);
    });

    it('large: list rows grow to 80 / 94', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'large',
      });
      expect(rows.map(row => row.size)).toEqual([80, 94, 80]);
    });

    it('xlarge: list rows grow to 96 / 110', () => {
      const entries = [createEntry('a'), createEntry('b'), createEntry('c')];
      const rows = createFileBrowserVirtualRows({
        entries,
        layout: 'list',
        viewportWidth: 500,
        entryDescription: e => (e.name === 'b' ? 'desc' : undefined),
        thumbnailSize: 'xlarge',
      });
      expect(rows.map(row => row.size)).toEqual([96, 110, 96]);
    });

    // FORK-MODIFICATION: 需求 3.6.3 —— 档位以前对网格完全无效，
    // createGridRows 根本没收到 thumbnailSize。
    // 1 个目录 + 3 张图片 ⇒ 4 行：目录段头 / 目录行 / 图片段头 / 图片行。
    // 目录行高 = gridDirEntryHeight + gap；图片行高 = gridEntryHeight + gap。
    it.each([
      ['small', 16, [0, 54, 101, 155], [54, 47, 54, 92]],
      ['medium', 11, [0, 54, 118, 172], [54, 64, 54, 132]],
      ['xlarge', 6, [0, 54, 153, 207], [54, 99, 54, 212]],
    ] as Array<[ThumbnailSize, number, number[], number[]]>)(
      'grid rows scale with thumbnailSize %s',
      (thumbnailSize, columns, expectedStarts, expectedSizes) => {
        const entries = [
          createEntry('dir-1', { is_dir: true, is_file: false }),
          createEntry('image-1', { ext: 'jpg', mime: 'image/jpeg' }),
          createEntry('image-2', { ext: 'jpg', mime: 'image/jpeg' }),
          createEntry('image-3', { ext: 'jpg', mime: 'image/jpeg' }),
        ];
        const rows = createFileBrowserVirtualRows({
          entries,
          layout: 'grid',
          viewportWidth: 2000,
          thumbnailSize,
        });

        expect(
          getGridColumnCount(
            2000,
            12,
            FILE_BROWSER_THUMBNAIL_METRICS[thumbnailSize].gridMinColumnWidth,
          ),
        ).toBe(columns);
        expect(rows.map(row => row.start)).toEqual(expectedStarts);
        expect(rows.map(row => row.size)).toEqual(expectedSizes);
      },
    );
  });
```

（期望值推导：列数 = floor((2000+12)/(min+12))，113→16、170→11、283→6。
段头行 = 42 + 12 = 54。目录行 = gridDirEntryHeight + 12：small 47、medium 64、xlarge 99。
图片行 = gridEntryHeight + 12：small 92、medium 132、xlarge 212。
起点依次为 0、54、54+目录行、54+目录行+54。）

(c) 文件顶部 import 追加：

```ts
import type { ThumbnailSize } from '../../types';
import { FILE_BROWSER_THUMBNAIL_METRICS } from '../../utils/file-browser-thumbnail-sizes';
```

(d) `describe('getGridColumnCount')`（第 206-212 行）替换为：

```ts
describe('getGridColumnCount', () => {
  it('derives column count from minimum card width and gap', () => {
    expect(getGridColumnCount(500, 12, 170)).toBe(2);
    expect(getGridColumnCount(850, 12, 170)).toBe(4);
    expect(getGridColumnCount(950, 12, 170)).toBe(5);
  });

  // FORK-MODIFICATION: 列数必须随缩略图档位变化，否则大卡片会被挤成窄条。
  it('derives fewer columns as the minimum column width grows', () => {
    expect(getGridColumnCount(2000, 12, 113)).toBe(16);
    expect(getGridColumnCount(2000, 12, 170)).toBe(11);
    expect(getGridColumnCount(2000, 12, 227)).toBe(8);
    expect(getGridColumnCount(2000, 12, 283)).toBe(6);
  });
});
```

(e) 第 274-275、295-296 行的四处调用补参数：`getGridColumnCount(x)` → `getGridColumnCount(x, 12, 170)`。

- [ ] **Step 2: 跑测试，确认失败**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-virtual-layout.test.ts
```

Expected: FAIL —— 类型错误 `Expected 3 arguments, but got 1`（`getGridColumnCount` 还没加参数）+ 数值断言失败。**这是预期失败**，说明测试确实约束了新行为。

- [ ] **Step 3: 参数化网格列宽（`utils/file-browser-virtual-rows.ts`）**

(a) **删除**第 6 行整行 `import { FILE_BROWSER_GRID_GAP_DEFAULT } from './file-browser-layout-gaps';`。`gridGap` 改为必填后本文件不再引用它。本文件**不需要**从 `file-browser-thumbnail-sizes.ts` 引入任何东西——最小列宽由调用方传入。

(b) 删除第 8 行 `export const GRID_MIN_COLUMN_WIDTH = 170;`（连同上一行空行整理好格式）。

(c) 把 `getGridColumnCount`（第 54-60 行）替换为：

```ts
// FORK-MODIFICATION: 最小列宽随缩略图档位变化，这里必须由调用方传入，
// 不能给默认值 —— 默认值会让漏传的调用方静默按 medium 列数布局。
export function getGridColumnCount(
  viewportWidth: number,
  gridGap: number,
  minColumnWidth: number,
): number {
  const availableWidth = Math.max(0, viewportWidth - GRID_VIEW_PADDING_X);
  return Math.max(1, Math.floor((availableWidth + gridGap) / (minColumnWidth + gridGap)));
}
```

（原 `gridGap` 的默认值 `FILE_BROWSER_GRID_GAP_DEFAULT` 一并去掉，改为必填，避免"传了列宽却漏传间距"这类半截调用。`file-browser-layout-gaps.ts` 的导出本身不动，`use-file-browser-virtual-layout.ts` 仍从那里取间距。）

(d) 把 `getFileBrowserGridLayoutMetrics`（第 110-118 行）替换为：

```ts
export function getFileBrowserGridLayoutMetrics(
  contentWidth: number,
  gridGap: number,
  minColumnWidth: number,
): FileBrowserGridLayoutMetrics {
  const availableWidth = Math.max(0, contentWidth - GRID_VIEW_PADDING_X);
  const columnCount = getGridColumnCount(contentWidth, gridGap, minColumnWidth);
  const columnWidth = columnCount > 0
    ? (availableWidth - ((columnCount - 1) * gridGap)) / columnCount
    : availableWidth;

  return {
    gridGap,
    columnCount,
    columnWidth,
    availableWidth,
  };
}
```

- [ ] **Step 4: 虚拟布局改查度量表（`composables/use-file-browser-virtual-layout.ts`）**

(a) import 区（第 28 行 `} from '../utils/file-browser-virtual-rows';` 之后）加：

```ts
import { resolveThumbnailMetrics } from '../utils/file-browser-thumbnail-sizes';
import type { ThumbnailSize } from '../types';
```

(b) 把第 40-53 行的常量块整段替换为：

```ts
// FORK-MODIFICATION: 缩略图四档的行高 / 卡高 / 最小列宽已全部移入
// ../utils/file-browser-thumbnail-sizes.ts，这里不再重复任何数字。
const GRID_SECTION_HEADER_HEIGHT = 42;
const VIRTUAL_OVERSCAN_PX = 420;
```

（其余 `SCROLL_TO_PATH_DOM_SYNC_ATTEMPTS` 等常量保持原位不动。删掉的 8 个常量：
`LIST_ENTRY_HEIGHT_BASE`、`LIST_ENTRY_HEIGHT_LARGE`、`LIST_ENTRY_HEIGHT_XLARGE`、
`LIST_ENTRY_WITH_DESCRIPTION_HEIGHT_BASE`、`LIST_ENTRY_WITH_DESCRIPTION_HEIGHT_LARGE`、
`LIST_ENTRY_WITH_DESCRIPTION_HEIGHT_XLARGE`、`GRID_DIR_ENTRY_HEIGHT`、`GRID_ENTRY_HEIGHT`。）

(c) 把 `getEntryDescriptionHeight`（第 138-156 行）替换为：

```ts
function getEntryDescriptionHeight(
  entry: DirEntry,
  entryDescription?: (entry: DirEntry) => string | undefined,
  thumbnailSize: ThumbnailSize = 'medium',
): number {
  const metrics = resolveThumbnailMetrics(thumbnailSize);

  return entryDescription?.(entry)
    ? metrics.listRowHeightWithDescription
    : metrics.listRowHeight;
}
```

(d) `createListRows`（第 177 行）的参数类型 `thumbnailSize: 'small' | 'medium' | 'large' | 'xlarge' = 'medium'` 改为 `thumbnailSize: ThumbnailSize = 'medium'`，函数体不动。

(e) `createGridRows`（第 251-298 行）替换为：

```ts
// FORK-MODIFICATION: 需求 3.6.3 —— 这里以前只吃 columnCount/gridGap，
// 缩略图档位完全传不进来，所以网格卡片一直是固定的 120/52。
function createGridRows(
  entries: readonly DirEntry[],
  columnCount: number,
  gridGap: number,
  thumbnailSize: ThumbnailSize,
): FileBrowserVirtualRow[] {
  const metrics = resolveThumbnailMetrics(thumbnailSize);
  const groupedEntries = groupFileBrowserEntries(entries);
  const sections: GridSectionDefinition[] = [
    {
      key: 'dirs',
      variant: 'dir',
      entries: groupedEntries.dirs,
      stickyIndex: 10,
      entryHeight: metrics.gridDirEntryHeight,
    },
    {
      key: 'images',
      variant: 'image',
      entries: groupedEntries.images,
      stickyIndex: 11,
      entryHeight: metrics.gridEntryHeight,
    },
    {
      key: 'videos',
      variant: 'video',
      entries: groupedEntries.videos,
      stickyIndex: 12,
      entryHeight: metrics.gridEntryHeight,
    },
    {
      key: 'others',
      variant: 'other',
      entries: groupedEntries.others,
      stickyIndex: 13,
      entryHeight: metrics.gridEntryHeight,
    },
  ];

  let offset = 0;
  const rows: FileBrowserVirtualRow[] = [];

  for (const section of sections) {
    const result = createGridSectionRows(section, columnCount, offset, gridGap);
    rows.push(...result.rows);
    offset = result.offset;
  }

  return rows;
}
```

(f) `createFileBrowserVirtualRows`（第 300-319 行）替换为：

```ts
export function createFileBrowserVirtualRows(options: {
  entries: readonly DirEntry[];
  layout: 'list' | 'grid' | 'tree' | undefined;
  viewportWidth: number;
  entryDescription?: (entry: DirEntry) => string | undefined;
  increaseFileViewGaps?: boolean;
  // FORK-MODIFICATION: 缩略图大小档位（同时影响 list 行高与 grid 卡高/列宽）。默认 medium。
  thumbnailSize?: ThumbnailSize;
}): FileBrowserVirtualRow[] {
  const thumbnailSize = options.thumbnailSize ?? 'medium';

  if (options.layout === 'grid') {
    const gridGap = getFileBrowserGridGap(!!options.increaseFileViewGaps);

    return createGridRows(
      options.entries,
      getGridColumnCount(
        options.viewportWidth,
        gridGap,
        resolveThumbnailMetrics(thumbnailSize).gridMinColumnWidth,
      ),
      gridGap,
      thumbnailSize,
    );
  }

  return createListRows(options.entries, options.entryDescription, thumbnailSize);
}
```

(g) `useFileBrowserVirtualLayout` 的 options 类型里第 352-353 行：

```ts
  // FORK-MODIFICATION: 缩略图大小档位（影响 list 行高与 grid 卡高/列宽）
  thumbnailSize?: () => ThumbnailSize;
```

(h) 第 364 行 `gridColumnCount` 替换为：

```ts
  const gridColumnCount = computed(() => getGridColumnCount(
    viewportWidth.value,
    gridGap.value,
    resolveThumbnailMetrics(options.thumbnailSize?.() ?? 'medium').gridMinColumnWidth,
  ));
```

- [ ] **Step 5: 跑测试，确认通过**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-virtual-layout.test.ts
```

Expected: PASS。

若报 `Expected 2-3 arguments, but got 1`，说明还有别处在调用 `getGridColumnCount` / `getFileBrowserGridLayoutMetrics` 而全局搜索没搜到（隐藏字符串拼接的调用极少，但仍要按报错定位补齐）。此时**不要**给函数加回默认值。

- [ ] **Step 6: 类型检查**

```bash
cmd.exe /d /c npm run ts
```

Expected: `0 error`。这一步能兜住 Step 5 之后所有下游文件的类型破坏（Task 4 会再引出一批，届时再跑一次）。

- [ ] **Step 7: 提交**

```bash
git add src/modules/navigator/components/file-browser/utils/file-browser-virtual-rows.ts src/modules/navigator/components/file-browser/composables/use-file-browser-virtual-layout.ts src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-virtual-layout.test.ts
```
提交信息写入 `.git/COMMIT_MSG_T2.txt`：

```
feat: scale virtual list and grid metrics with the thumbnail size

虚拟布局里原有 6 个行高常量与 2 个网格卡高常量，全部改为查
utils/file-browser-thumbnail-sizes.ts。createGridRows 此前压根收不到
thumbnailSize，所以网格卡片高度一直是固定的 120/52，本次一并接入。

getGridColumnCount / getFileBrowserGridLayoutMetrics 的最小列宽改为必填参数：
给它默认值会让漏传的调用方静默按 medium 列数布局，那正是本次要消灭的漂移。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

---

### Task 4: 框选命中跟随缩略图档位

**Files:**
- Modify: `src/modules/navigator/components/file-browser/utils/file-browser-box-selection-hit-test.ts:84-94`、`:151`
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser-box-selection.ts:89-104`、`:168-178`
- Modify: `src/modules/navigator/components/file-browser/composables/use-file-browser.ts:277-282`、`:411-426`
- Modify: `src/modules/navigator/components/file-browser/utils/__tests__/file-browser-box-selection-hit-test.test.ts:44`、`:85`、`:104`、`:147`
- Modify: `src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-box-selection.test.ts:96` 附近

**Interfaces:**
- Consumes: `resolveThumbnailMetrics(size)`（Task 1）、`getFileBrowserGridLayoutMetrics(contentWidth, gridGap, minColumnWidth)`（Task 3）
- Produces: `collectFileBrowserBoxSelectionEntries` 新增**必填**选项 `gridMinColumnWidth: number`；`useFileBrowserBoxSelection` 新增**必填**选项 `gridMinColumnWidth: ComputedRef<number>`

**为什么必须做**：列数随档位变化后，框选仍按固定 170px 算列宽，选中的会是另一个卡片。这是真 bug，不是代码洁癖。

- [ ] **Step 1: 写失败测试**

改 `utils/__tests__/file-browser-box-selection-hit-test.test.ts`：

(a) 现有 4 处 `collectFileBrowserBoxSelectionEntries({...})` 调用各补一行 `gridMinColumnWidth: 170,`（放在 `increaseFileViewGaps` 之后）。

(b) 追加一条判别性用例（放在文件末尾 `});` 之前）：

```ts
  // FORK-MODIFICATION: 需求 3.6 —— 列数随档位变化后，框选必须用同一套列宽，
  // 否则选中的会是另一张卡片。用同一个选框在两种列宽下必须选到不同条目。
  it('follows the thumbnail size when mapping a box to grid columns', () => {
    const entries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
      createEntry('/tmp/d'),
    ];
    const rows = createFileBrowserVirtualRows({
      entries,
      layout: 'grid',
      viewportWidth: 800,
    });
    const contentRect = new DOMRect(100, 200, 800, 600);
    const viewportRect = new DOMRect(100, 200, 800, 600);
    const gridGap = 12;
    const rowTop = 200 + 42 + gridGap;
    // medium：4 列，列宽 191，第 4 列左边界 100 + 3*(191+12) = 709
    const selectionBox = {
      left: 711,
      top: rowTop + 2,
      right: 898,
      bottom: rowTop + 40,
    };
    const shared = {
      rows,
      selectionBox,
      layout: 'grid' as const,
      contentRect,
      viewportRect,
      contentWidth: 800,
      virtualContentOffset: 0,
      scrollTop: 0,
      increaseFileViewGaps: false,
    };

    expect(collectFileBrowserBoxSelectionEntries({ ...shared, gridMinColumnWidth: 170 })
      .map(entry => entry.path)).toEqual(['/tmp/d']);
    // xlarge：2 列，列宽 394，同一 x 区间落在第 2 列（/tmp/b）
    expect(collectFileBrowserBoxSelectionEntries({ ...shared, gridMinColumnWidth: 283 })
      .map(entry => entry.path)).toEqual(['/tmp/b']);
  });
```

同时把文件顶部 import 补上 `createFileBrowserVirtualRows`（该文件已从 `../../composables/use-file-browser-virtual-layout` 导入，无需重复添加）。

- [ ] **Step 2: 跑测试，确认失败**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/utils/__tests__/file-browser-box-selection-hit-test.test.ts
```

Expected: FAIL —— TypeScript 报对象字面量有未知属性 `gridMinColumnWidth`（vitest 不做类型检查时会表现为两条断言都返回 `['/tmp/d']`，第二条不通过）。**第二条断言必须红**，这是判别性用例的价值所在。

- [ ] **Step 3: 实现（命中测试）**

改 `utils/file-browser-box-selection-hit-test.ts`：

(a) options 类型（第 84-94 行）末尾加一行：

```ts
  increaseFileViewGaps: boolean;
  // FORK-MODIFICATION: 网格列宽随缩略图档位变化，必须由调用方传入当前档位的最小列宽。
  gridMinColumnWidth: number;
}
```

(b) 第 150-151 行替换为：

```ts
  const gridGap = getFileBrowserGridGap(options.increaseFileViewGaps);
  const { columnWidth } = getFileBrowserGridLayoutMetrics(
    options.contentWidth,
    gridGap,
    options.gridMinColumnWidth,
  );
```

- [ ] **Step 4: 实现（composable 透传）**

改 `composables/use-file-browser-box-selection.ts`：

(a) options 类型（第 99 行 `increaseFileViewGaps: ComputedRef<boolean>;` 之后）加：

```ts
  gridMinColumnWidth: ComputedRef<number>;
```

(b) `applyBoxSelection` 内（第 177 行 `increaseFileViewGaps: options.increaseFileViewGaps.value,` 之后）加：

```ts
      gridMinColumnWidth: options.gridMinColumnWidth.value,
```

- [ ] **Step 5: 实现（接线）**

改 `composables/use-file-browser.ts`：

(a) import 区加：

```ts
import { resolveThumbnailMetrics } from '../utils/file-browser-thumbnail-sizes';
```

(b) 第 280-282 行 `increaseFileViewGaps` 之后加：

```ts
  const thumbnailMetrics = computed(
    () => resolveThumbnailMetrics(userSettingsStore.userSettings.navigator.thumbnailSize),
  );
```

(c) 第 421 行 `increaseFileViewGaps,` 之后加：

```ts
    gridMinColumnWidth: computed(() => thumbnailMetrics.value.gridMinColumnWidth),
```

- [ ] **Step 6: 补齐 composable 测试的调用参数**

改 `composables/__tests__/use-file-browser-box-selection.test.ts`，在第 96 行 `increaseFileViewGaps: computed(() => false),` 之后加：

```ts
        gridMinColumnWidth: computed(() => 170),
```

- [ ] **Step 7: 跑测试，确认通过**

```bash
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser/utils/__tests__/file-browser-box-selection-hit-test.test.ts src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-box-selection.test.ts
```

Expected: PASS。

- [ ] **Step 8: 类型检查**

```bash
cmd.exe /d /c npm run ts
```

Expected: `0 error`。这一步专门用来抓"还有别的调用方没补 `gridMinColumnWidth`"。

- [ ] **Step 9: 提交**

```bash
git add src/modules/navigator/components/file-browser/utils/file-browser-box-selection-hit-test.ts src/modules/navigator/components/file-browser/composables/use-file-browser-box-selection.ts src/modules/navigator/components/file-browser/composables/use-file-browser.ts src/modules/navigator/components/file-browser/utils/__tests__/file-browser-box-selection-hit-test.test.ts src/modules/navigator/components/file-browser/composables/__tests__/use-file-browser-box-selection.test.ts
```
提交信息写入 `.git/COMMIT_MSG_T2.txt`：

```
fix: make box selection follow the thumbnail-sized grid column width

列数随缩略图档位变化后，框选命中测试仍按写死的 170px 最小列宽算列宽，
选中的会是另一张卡片。改为由调用方传入当前档位的最小列宽。

新增一条判别性用例：同一选框在 medium(4 列) 与 xlarge(2 列) 下
必须选到不同条目，确保这不是一个平凡通过的断言。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

---

### Task 5: CSS 变量按档位运行时注入

**Files:**
- Modify: `src/modules/navigator/components/file-browser/file-browser.vue`（import 区、第 68 行前、第 243-246 行模板根元素）
- Modify: `src/styles/vars.css:35-37`（仅加注释，值不动）

**Interfaces:**
- Consumes: `resolveThumbnailCssVariables(size): Record<string, string>`（Task 1）、`useUserSettingsStore`（`@/stores/storage/user-settings`）
- Produces: `file-browser.vue` 根元素上的 `:style="thumbnailCssVariables"`

**关于测试覆盖的诚实说明**：`file-browser.vue` 挂载会拉起整条 Tauri IPC + i18n + 对话框链，本仓库没有、也不打算为此造桩。`resolveThumbnailCssVariables` 的取值由 Task 1 的单测覆盖；**"绑定是否真的生效"由 Task 8 的真机像素测量兜底**（medium 档行高若仍显示 42px，说明绑定断了）。不要因为没有单测就跳过 Task 8 的行高测量。

- [ ] **Step 1: 加运行时绑定**

改 `file-browser.vue`：

(a) import 区加（第 13 行 `import { provideFileBrowserContext } from './composables/use-file-browser-context';` 之后）：

```ts
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { resolveThumbnailCssVariables } from './utils/file-browser-thumbnail-sizes';
```

(b) 第 61 行 `const fileBrowserRef = ref<HTMLElement | null>(null);` 之后加：

```ts
const userSettingsStore = useUserSettingsStore();
// FORK-MODIFICATION: 网格/列表的行高与卡高由 CSS 变量驱动，这里按当前档位覆盖。
// vars.css 里的静态值是 medium 兜底，注入失败时退化成默认档而不是塌成无高度。
const thumbnailCssVariables = computed(() => resolveThumbnailCssVariables(
  userSettingsStore.userSettings.navigator.thumbnailSize,
));
```

(`computed` 已在第 7 行导入，无需补 import。)

(c) 模板根元素（第 243-246 行）改为：

```html
  <div
    ref="fileBrowserRef"
    class="file-browser"
    :style="thumbnailCssVariables"
  >
```

- [ ] **Step 2: 给静态兜底值加注释**

改 `src/styles/vars.css` 第 34-37 行：

```css
  --navigator-sorting-header-height: 36px;
  /* FORK-MODIFICATION: 以下三个变量是 medium 档的兜底默认值（需求 3.6）。
     运行时由 file-browser.vue 根元素按 navigator.thumbnailSize 覆盖，
     取值唯一来源是 utils/file-browser-thumbnail-sizes.ts。改这里请先改那张表。 */
  --navigator-list-view-entry-height: 42px;
  --navigator-grid-view-dir-entry-height: 52px;
  --navigator-grid-view-entry-height: 120px;
```

注意 `--navigator-list-view-entry-height` 的兜底值保持 **42px**（现状值），不是新表里的 64px。理由：这一行是"注入没发生"时的最后防线，写成 64 会让兜底与默认值 medium 产生认知偏差；写成 42 则与当前线上表现一致。真机验收 medium 档时若看到 42px 行高，就说明注入断了——这正好是个可判别的信号。

- [ ] **Step 3: 类型检查 + 现有相关测试**

```bash
cmd.exe /d /c npm run ts
cmd.exe /d /c npx vitest run src/modules/navigator/components/file-browser
```

Expected: `0 error`；file-browser 目录下测试全绿。

- [ ] **Step 4: 提交**

```bash
git add src/modules/navigator/components/file-browser/file-browser.vue src/styles/vars.css
```
提交信息写入 `.git/COMMIT_MSG_T2.txt`：

```
feat: inject thumbnail CSS variables from the selected size

网格卡高与列表行高由 CSS 变量驱动，但 vars.css 里是写死的静态值。
现在在 file-browser.vue 根元素按 navigator.thumbnailSize 覆盖，
取值来自 utils/file-browser-thumbnail-sizes.ts。

静态值保留为 medium 兜底：注入环节缺失时退化成默认档，
而不是塌成无高度。真机验收 medium 档若看到 42px 行高即说明注入断了。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

---

### Task 6: 17 个语言包改文案

**Files:**
- Modify: `src/localization/messages/*.json` × 17（`ch.json` 用中文，其余 16 个用英文）

**Interfaces:**
- Consumes: 无
- Produces: `settings.general.fileView.thumbnailSize{Small,Medium,Large,XLarge,Description}` 五个 key 的新取值。**key 集合完全不变**，`messages-key-alignment.test.ts` 的叶子 key 相等性不受影响。

**现值 → 新值**

| key | 现值（16 个非中文语言包，全部相同） | 新值 | 现值（`ch.json`） | 新值（`ch.json`） |
|---|---|---|---|---|
| `thumbnailSizeSmall` | `Small (24 px)` | `Small` | `小（24 像素）` | `小` |
| `thumbnailSizeMedium` | `Medium (32 px)` | `Medium` | `中（32 像素）` | `中` |
| `thumbnailSizeLarge` | `Large (48 px)` | `Large` | `大（48 像素）` | `大` |
| `thumbnailSizeXLarge` | `Extra large (54 px)` | `Extra large` | `特大（54 像素）` | `特大` |
| `thumbnailSizeDescription` | `Adjust thumbnail size in the list view.` | `Adjust thumbnail size in the list and grid views.` | `调整列表视图中缩略图的尺寸。` | `调整列表视图与网格视图中的缩略图尺寸。` |

描述文案必须一并改：网格也生效了之后，「调整列表视图中缩略图的尺寸」不再准确。

- [ ] **Step 1: 写改写脚本**

在 `F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\` 下创建临时脚本 `tmp-batch2-i18n.mjs`：

```js
import fs from 'node:fs';
import path from 'node:path';

const localeDirectoryPath = path.resolve('src/localization/messages');

const englishReplacements = [
  ['"thumbnailSizeSmall": "Small (24 px)"', '"thumbnailSizeSmall": "Small"'],
  ['"thumbnailSizeMedium": "Medium (32 px)"', '"thumbnailSizeMedium": "Medium"'],
  ['"thumbnailSizeLarge": "Large (48 px)"', '"thumbnailSizeLarge": "Large"'],
  ['"thumbnailSizeXLarge": "Extra large (54 px)"', '"thumbnailSizeXLarge": "Extra large"'],
  [
    '"thumbnailSizeDescription": "Adjust thumbnail size in the list view."',
    '"thumbnailSizeDescription": "Adjust thumbnail size in the list and grid views."',
  ],
];

const chineseReplacements = [
  ['"thumbnailSizeSmall": "小（24 像素）"', '"thumbnailSizeSmall": "小"'],
  ['"thumbnailSizeMedium": "中（32 像素）"', '"thumbnailSizeMedium": "中"'],
  ['"thumbnailSizeLarge": "大（48 像素）"', '"thumbnailSizeLarge": "大"'],
  ['"thumbnailSizeXLarge": "特大（54 像素）"', '"thumbnailSizeXLarge": "特大"'],
  [
    '"thumbnailSizeDescription": "调整列表视图中缩略图的尺寸。"',
    '"thumbnailSizeDescription": "调整列表视图与网格视图中的缩略图尺寸。"',
  ],
];

const fileNames = fs.readdirSync(localeDirectoryPath).filter(name => name.endsWith('.json'));
let touched = 0;

for (const fileName of fileNames) {
  const filePath = path.join(localeDirectoryPath, fileName);
  const original = fs.readFileSync(filePath, 'utf8');
  const replacements = fileName === 'ch.json' ? chineseReplacements : englishReplacements;
  let content = original;

  for (const [from, to] of replacements) {
    if (!content.includes(from)) {
      throw new Error(`${fileName}: 找不到待替换文本 ${from}`);
    }
    content = content.replace(from, to);
  }

  if (content === original) {
    throw new Error(`${fileName}: 没有任何替换发生，疑似读到了错误文件`);
  }

  // 校验改完仍是合法 JSON，且只动了这 5 个 key
  const parsed = JSON.parse(content);
  const fileView = parsed.settings.general.fileView;
  if (fileView.thumbnailSizeTitle !== JSON.parse(original).settings.general.fileView.thumbnailSizeTitle) {
    throw new Error(`${fileName}: thumbnailSizeTitle 被意外改动`);
  }

  fs.writeFileSync(filePath, content, 'utf8');
  touched += 1;
  console.log(`updated ${fileName}`);
}

if (touched !== 17) {
  throw new Error(`期望改动 17 个语言包，实际 ${touched} 个`);
}
console.log(`done: ${touched} locale files updated`);
```

- [ ] **Step 2: 跑脚本**

```bash
cmd.exe /d /c node scripts/tmp-batch2-i18n.mjs
```

Expected: 逐行打印 17 个 `updated xx.json`，末行 `done: 17 locale files updated`。

**脚本里的 `throw` 是故意的**：任何一条待替换文本找不到就整体失败，不允许"改了一部分就当成功"。看到这个报错不要放宽断言，先确认语言包里是不是已经被别的改动动过了。

- [ ] **Step 3: 校验 diff 干净**

```bash
git diff --stat src/localization/messages
git diff src/localization/messages/ch.json
```

Expected: 17 个文件，每个**恰好 5 行改动**（5 减 5 加）；`ch.json` 的 diff 里不含任何其他 key、无格式化噪音、无 BOM 变化。

- [ ] **Step 4: 跑 i18n 门禁**

```bash
cmd.exe /d /c npx vitest run src/localization
```

Expected: 4 个测试文件全绿（`messages-key-alignment`、`messages-json`、`messages-used-keys-exist`、`system-locale`）。

- [ ] **Step 5: 删临时脚本并提交**

```bash
git status --short
```
确认只有 17 个语言包是待提交的修改，`scripts/tmp-batch2-i18n.mjs` 是唯一多出来的未跟踪文件。

删掉临时脚本（可恢复删除，不要用永久删除）：

```bash
rm -- "F:\soft\00selfmade\filemanager\sigma-file-manager\scripts\tmp-batch2-i18n.mjs"
```

再 `git status --short` 复核：17 个 `M`，无 `??` 行。

然后：

```bash
git add src/localization/messages
```
提交信息写入 `.git/COMMIT_MSG_T2.txt`：

```
chore: drop pixel counts from the thumbnail size menu copy

需求 3.6.1：菜单里的「小（24 像素）」等像素说明去掉。
需求 3.6.3：档位现在对网格视图同样生效，所以描述文案从
"调整列表视图中缩略图的尺寸" 改为同时涵盖两种视图，否则文案是错的。

key 集合不变，只改取值，17 个语言包逐包写入。

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
```

```bash
git commit -F .git/COMMIT_MSG_T2.txt
```

改写用的临时脚本**不进版本库**：它是一次性凭据，Task 6 的提交信息已经完整记录了改了什么。

---

### Task 7: 全量门禁

**Files:** 无（只跑检查）

**Interfaces:**
- Consumes: Task 1-6 的全部改动
- Produces: 一条"可以进入打包"的判据

- [ ] **Step 1: 类型检查**

```bash
cmd.exe /d /c npm run ts
```
Expected: `0 error`。

- [ ] **Step 2: 全量单测**

```bash
cmd.exe /d /c npm run test:unit:run -- --testTimeout=30000
```
Expected: **175 个测试文件 / 1275 个用例全绿**，0 failed。少于这个数说明有文件没被收集到，回头查。

如果报超时失败，先单独跑报红的文件确认它自己能过；本项目在默认 5 秒阈值下基线也会假红，带了 `--testTimeout=30000` 还红才是真问题。

- [ ] **Step 3: eslint（只量不改）**

```bash
cmd.exe /d /c npx eslint .
```
Expected: **不超过 188 errors / 121 warnings**。新增任何一条都要在本任务内解决，不允许"下一批再修"。

- [ ] **Step 4: 记录基线对比**

把 Step 2 与 Step 3 的实际数字写进最终汇报，与上面两个基线数字对照。

---

### Task 8: 打包与真机逐档验收

**Files:** 无（只跑构建与验收）

**Interfaces:**
- Consumes: Task 1-7 的全部改动
- Produces: 一份带像素测量值的验收结论

- [ ] **Step 1: 打包**

```bash
cmd.exe /d /c npm run tauri:build
```
Expected: 成功，产物 `src-tauri\target\release\bundle\nsis\Alpha File Manager_3.1.1_x64-setup.exe`。记录文件大小与 sha256。

（Rust 工具链固定 1.90.0；若报找不到 cargo，先注入 PATH 再跑，不要改工具链版本。）

- [ ] **Step 2: 安装并启动**

静默安装打包产物到 `D:\Program Files\Alpha File Manager`，启动后记下应用 PID 与主窗口句柄（可用既有脚本 `E:\Users\Duanyi\AppData\Local\Temp\afm-accept.ps1` 的 `Get-TauriWindow`）。

**必须用打包产物**。`npm run tauri:dev` 下所有路由页内容区空白，dev 上的任何界面结论一律作废。

- [ ] **Step 3: 把窗口调到已知宽度**

把窗口最大化到全屏，记下窗口宽度像素值 `W`。网格内容宽度略小于 `W`（差一个内容区内边距），**从截图量一次实际列宽**比推算可靠。

- [ ] **Step 4: 列表视图逐档核对**

打开一个含图片的目录（建议 `F:\soft\00selfmade\filemanager\sigma-file-manager\src\assets`），切到列表视图。

用 `PrintWindow(hwnd, hdc, 2)` 截图，逐档测量左侧缩略图的实际边长：

| 档位 | 列表缩略图边长 | 列表行高 |
|---|---|---|
| 小 | 32 | 48 |
| 中 | 48 | 64 |
| 大 | 64 | 80 |
| 特大 | 80 | 96 |

**判别标准**：量出来的缩略图像素与行高落在上表 ±1 px 内。

若 medium 档量到 42px 行高 ⇒ Task 5 的 CSS 变量注入没生效，回查 `file-browser.vue` 的 `:style` 绑定。
若缩略图明显发虚 ⇒ 缩略图缓存没按新尺寸重生成，回查取图时传的 `maxDimension`。

- [ ] **Step 5: 网格视图逐档核对**

切到网格视图，逐档数**同一行内的卡片数**并量**卡片宽高**。视口 2000px、间距 12px 时的预期：

| 档位 | 网格最小列宽 | 实际列宽 | 卡高 | 列数（2000px） | 长宽比 |
|---|---|---|---|---|---|
| 小 | 113 | 113 | 80 | 16 | 1.41 |
| 中 | 170 | 170 | 120 | 11 | 1.42 |
| 大 | 227 | 239 | 160 | 8 | 1.49 |
| 特大 | 283 | 323 | 200 | 6 | 1.62 |

（2560px 宽窗口下的参考值：小 20 列 / 中 14 / 大 10 / 特大 8。
长宽比从 1.42 只漂到 1.62，说明放大档位时卡片略微变宽、不会被拉成高瘦条——这正是列宽联动的目的。）

**判别标准**：卡片数与实测卡高落在上表 ±1 内，且大/特大档卡片明显变大。
只看「设置项显示成什么」不算验收。

- [ ] **Step 6: 框选冒烟**

在网格视图开启框选，拖一个框跨过若干卡片，确认选中的是肉眼看到的那些卡片。特别在**特大档**（列数最少、列宽与 medium 差最多）测一次——这是 Task 4 修的那条路径。

- [ ] **Step 7: 菜单文案**

打开缩略图大小对话框，确认四个选项显示为「小 / 中 / 大 / 特大」，括号像素说明已消失；对话框描述同时涵盖列表与网格。

- [ ] **Step 8: 汇总汇报**

汇报里必须写清：
- 每档的**实测像素值**（不是设计表抄过来的数字）
- 打包产物的路径、大小、sha256
- 观察窗口是否足够长（扩展冷启动需 3-5 分钟，本批不涉及扩展，但要说明启动等待方式）
- `tauri build` 与 `tauri dev` 的构建形态差异说明（本批结论仅对打包产物成立）

---

## Self-Review

**规格覆盖**

| 需求 | 覆盖任务 |
|---|---|
| 3.6.1 去掉像素说明 | Task 6 |
| 3.6.2 列表 32/48/64/80、默认中 | Task 1（表）、Task 2（缩略图像素）、Task 3（行高）；默认值 schema 已是 `medium`，无需改 |
| 3.6.3 档位对网格生效 | Task 1（表）、Task 3（卡高 + 列宽）、Task 5（CSS 变量）、Task 8（实测） |
| 设计文档 §5 CSS 注入策略 | Task 5 |
| 设计文档 §11 本批不做 | 计划全程未触碰 `showListThumbnails`、缩略图缓存实现、3.2/3.3/3.4 |
| 设计文档 §10 回滚 | `rollback/batch1-merged` 已存在，Global Constraints 已声明 |

**补上的两处遗漏**：框选命中测试列宽（Task 4）、缩略图组件既有测试（Task 2）。

**类型一致性**：`resolveThumbnailMetrics` / `resolveThumbnailCssVariables` / `FILE_BROWSER_THUMBNAIL_METRICS` / `FileBrowserThumbnailMetrics` 在 Task 1 定义，Task 2/3/4/5 引用的名字与之一致。`getGridColumnCount` 与 `getFileBrowserGridLayoutMetrics` 的第三参数在 Task 3 定义为必填，Task 4 的调用点同步补齐；全仓已核实无其他调用方。

**占位符扫描**：无 TBD / TODO / 「类似 Task N」/ 无代码的步骤。所有代码块均为可直接粘贴的完整片段。
