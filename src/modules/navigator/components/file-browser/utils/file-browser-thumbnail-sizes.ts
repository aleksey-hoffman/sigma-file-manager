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

// FORK-MODIFICATION: 网格卡不能按比例往下缩（验收反馈 2026-10-15）。
// 第一版四档按 0.667 : 1 : 1.333 : 1.667 缩放，把「小」压到了 80 / 35，
// 而 file-browser-grid-card.vue 的卡片内边距与字号是写死的固定值，不跟着档位走。
// 全局 line-height 1.5（src/styles/preflight.css），所以名称行 13*1.5 = 19.5、
// 说明行 11*1.5 = 16.5：
//   目录卡（flex row，上下各 8px 内边距 + 上下各 1px 边框 = 18）：
//     内容区只剩 35 - 18 = 17px，而两行字形合计要 19.5 + 2 + 16.5 - 5.5 = 32.5px。
//     align-items: center 把两行垂直居中后上下同时被裁：名称行还能勉强认出，
//     说明行只剩上半截 —— 截图里 "3 项 · 19.8 MB" 的 MB 只剩顶部一条。
//   文档卡（--icon-full，48px 图标 + 8px 外边距 = 56；底部信息层 8 + 19.5 + 2 + 16.5 + 8 = 54）：
//     80px 装不下 56 + 54 = 110px，图标直接压在文件名上。
// 所以「小」不再是一个更小的排版，而是把「中」原来的尺寸整体上移一档，
// 下面的四档依次再放大一档。改这几个数之前先看下面两个下限。
// GRID_DIR_ENTRY_HEIGHT_FLOOR 的依据是「第一版 medium 档就是 52px，验收通过且
// 从未被报为截断」，不是一次专门的截断测试 —— 小档沿用它是为了满足"小 = 原中档尺寸"。
export const GRID_MEDIA_ENTRY_HEIGHT_FLOOR = 110;
export const GRID_DIR_ENTRY_HEIGHT_FLOOR = 52;

export const FILE_BROWSER_THUMBNAIL_METRICS: Record<ThumbnailSize, FileBrowserThumbnailMetrics> = {
  small: {
    listThumbnailPx: 32,
    listRowHeight: 48,
    listRowHeightWithDescription: 62,
    gridEntryHeight: 120,
    gridDirEntryHeight: 52,
    gridMinColumnWidth: 170,
  },
  medium: {
    listThumbnailPx: 48,
    listRowHeight: 64,
    listRowHeightWithDescription: 78,
    gridEntryHeight: 180,
    gridDirEntryHeight: 78,
    gridMinColumnWidth: 225,
  },
  large: {
    listThumbnailPx: 64,
    listRowHeight: 80,
    listRowHeightWithDescription: 94,
    gridEntryHeight: 240,
    gridDirEntryHeight: 104,
    gridMinColumnWidth: 300,
  },
  xlarge: {
    listThumbnailPx: 80,
    listRowHeight: 96,
    listRowHeightWithDescription: 110,
    gridEntryHeight: 300,
    gridDirEntryHeight: 130,
    gridMinColumnWidth: 420,
  },
};

// 用户设置可能来自被手改过的配置文件，运行时不能假定它一定落在四档内，
// 因此这里按 string 索引并显式回落，而不是让 TS 的 Record 类型掩盖脏数据。
// 关键：必须先判自有属性再取值，不能写成 `THUMBNAIL_METRICS_BY_SIZE[size] ?? …`。
// 常量表是普通对象字面量，继承 Object.prototype，constructor / toString / __proto__
// 这些键取值不是 undefined，`?? ` 永不触发，会把原型对象当度量用，
// 顺着 resolveThumbnailCssVariables 出去就是 `${undefined}px` 这种静默失效的 CSS 声明。
// 也不能改用 typeof 判断：`__proto__` 取到的 Object.prototype 恰好也是 object，会漏掉一半坏值。
const THUMBNAIL_METRICS_BY_SIZE = FILE_BROWSER_THUMBNAIL_METRICS as Record<
  string,
  FileBrowserThumbnailMetrics | undefined
>;

export function resolveThumbnailMetrics(size: ThumbnailSize): FileBrowserThumbnailMetrics {
  if (!Object.hasOwn(THUMBNAIL_METRICS_BY_SIZE, size)) {
    return FILE_BROWSER_THUMBNAIL_METRICS.medium;
  }

  return THUMBNAIL_METRICS_BY_SIZE[size] as FileBrowserThumbnailMetrics;
}

export function resolveThumbnailCssVariables(size: ThumbnailSize): Record<string, string> {
  const metrics = resolveThumbnailMetrics(size);

  return {
    '--navigator-list-view-entry-height': `${metrics.listRowHeight}px`,
    '--navigator-grid-view-entry-height': `${metrics.gridEntryHeight}px`,
    '--navigator-grid-view-dir-entry-height': `${metrics.gridDirEntryHeight}px`,
  };
}
