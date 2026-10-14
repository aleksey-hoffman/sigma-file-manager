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
