// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 需求 3.6 缩略图四档重定（2026-10-14）。
// 这张表是四个消费方的唯一事实来源，改这里等于改全局。

import { describe, expect, it } from 'vitest';
import type { ThumbnailSize } from '../../types';
import {
  FILE_BROWSER_THUMBNAIL_METRICS,
  GRID_DIR_ENTRY_HEIGHT_FLOOR,
  GRID_MEDIA_ENTRY_HEIGHT_FLOOR,
  resolveThumbnailCssVariables,
  resolveThumbnailMetrics,
} from '../file-browser-thumbnail-sizes';

describe('FILE_BROWSER_THUMBNAIL_METRICS', () => {
  it.each([
    [
      'small',
      {
        listThumbnailPx: 32,
        listRowHeight: 48,
        listRowHeightWithDescription: 62,
        gridEntryHeight: 120,
        gridDirEntryHeight: 52,
        gridMinColumnWidth: 170,
      },
    ],
    [
      'medium',
      {
        listThumbnailPx: 48,
        listRowHeight: 64,
        listRowHeightWithDescription: 78,
        gridEntryHeight: 180,
        gridDirEntryHeight: 78,
        gridMinColumnWidth: 225,
      },
    ],
    [
      'large',
      {
        listThumbnailPx: 64,
        listRowHeight: 80,
        listRowHeightWithDescription: 94,
        gridEntryHeight: 240,
        gridDirEntryHeight: 104,
        gridMinColumnWidth: 300,
      },
    ],
    [
      'xlarge',
      {
        listThumbnailPx: 80,
        listRowHeight: 96,
        listRowHeightWithDescription: 110,
        gridEntryHeight: 300,
        gridDirEntryHeight: 130,
        gridMinColumnWidth: 420,
      },
    ],
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

  // FORK-MODIFICATION: 验收反馈 2026-10-15 —— 第一版把网格四档按 0.667:1:1.333:1.667 缩放，
  // 「小」落到 80 / 35，低于卡片自身写死的内边距与字号能容纳的下限：
  // 目录卡的说明行被垂直裁掉一半，文档卡的 48px 图标压在文件名上。
  // 纯数值表的断言拦不住这种回归 —— 表里的 80 / 35 完全自洽，只有"装不下"这件事是错的。
  // 所以这里把下限钉成不变量：任何一档掉到下限以下，这条就红。
  it('keeps every grid card tall enough to hold its own content', () => {
    for (const [size, metrics] of Object.entries(FILE_BROWSER_THUMBNAIL_METRICS)) {
      // 文档 / 图片 / 视频卡：48px 图标 + 8px 外边距 + 底部信息层
      expect(
        metrics.gridEntryHeight,
        `${size} 的 gridEntryHeight 低于卡片内容下限，图标会压住文件名`,
      ).toBeGreaterThanOrEqual(GRID_MEDIA_ENTRY_HEIGHT_FLOOR);

      // 目录卡：上下各 8px 内边距 + 上下各 1px 边框 + 两行字形
      expect(
        metrics.gridDirEntryHeight,
        `${size} 的 gridDirEntryHeight 低于卡片内容下限，说明行会被裁掉`,
      ).toBeGreaterThanOrEqual(GRID_DIR_ENTRY_HEIGHT_FLOOR);
    }
  });

  // 下限本身也要有出处，否则它只是把一个魔数换了个地方放。
  it('pins the content floors to the card box model they came from', () => {
    // 全局 line-height 1.5（src/styles/preflight.css）：名称行 13*1.5，说明行 11*1.5。
    const nameLine = 13 * 1.5;
    const metaLine = 11 * 1.5;

    // --icon-full 卡：图标 48 + margin 8 = 56；底部信息层 8 + 名称行 + 2 + 说明行 + 8。
    // 这个下限是硬推导 —— 低于它，48px 图标一定会压到文件名上。
    expect(GRID_MEDIA_ENTRY_HEIGHT_FLOOR).toBe(56 + (8 + nameLine + 2 + metaLine + 8));

    // 目录卡的下限不是硬推导：行盒叠上 padding 8*2 + border 1*2 要 56px，
    // 但字形比行盒矮约 5.5px，可见字形只需 50.5px。
    // 52px 的依据是「第一版 medium 档就是 52px，验收通过且从未被报为截断」，
    // 而不是某次专门的截断测试 —— 小档沿用它是为了满足"小 = 原中档尺寸"的需求。
    // 所以这里钉住 52，同时钉住它不低于字形下限 50.5。
    expect(GRID_DIR_ENTRY_HEIGHT_FLOOR).toBe(52);
    expect(GRID_DIR_ENTRY_HEIGHT_FLOOR).toBeGreaterThanOrEqual(8 * 2 + 1 * 2 + (nameLine + 2 + metaLine) - 5.5);
  });
});

describe('resolveThumbnailMetrics', () => {
  it('falls back to medium for an unknown or dirty configured size', () => {
    expect(resolveThumbnailMetrics('huge' as ThumbnailSize))
      .toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium);
  });

  // 常量表是普通对象字面量，会继承 Object.prototype，
  // 所以 constructor / toString / __proto__ 这些键取值并不是 undefined，
  // 用 `?? ` 兜底会被绕过、悄悄把原型对象当度量用。
  it.each([
    '__proto__',
    'constructor',
    'toString',
    'valueOf',
    'hasOwnProperty',
  ])('falls back to medium for the inherited key %s', (key) => {
    const metrics = resolveThumbnailMetrics(key as ThumbnailSize);

    // 用 `toBe` 锁定"返回的就是 medium 那一档对象本身，不是新拷贝"，
    // 再钉住具体数值，避免断言退化成"没抛异常就算过"。
    expect(metrics).toBe(FILE_BROWSER_THUMBNAIL_METRICS.medium);
    expect(metrics).not.toBe(Object.prototype);
    expect(metrics.listThumbnailPx).toBe(48);
    expect(metrics.listRowHeight).toBe(64);
  });
});

describe('resolveThumbnailCssVariables', () => {
  it('emits the three CSS variables consumed by list and grid views', () => {
    expect(resolveThumbnailCssVariables('large')).toEqual({
      '--navigator-list-view-entry-height': '80px',
      '--navigator-grid-view-entry-height': '240px',
      '--navigator-grid-view-dir-entry-height': '104px',
    });
  });

  it('emits the medium fallback values for a dirty configured size', () => {
    expect(resolveThumbnailCssVariables('huge' as ThumbnailSize)).toEqual({
      '--navigator-list-view-entry-height': '64px',
      '--navigator-grid-view-entry-height': '180px',
      '--navigator-grid-view-dir-entry-height': '78px',
    });
  });

  // 兜底一旦被原型键绕过，产物就是 `${undefined}px` 这种静默失效的 CSS 声明，
  // 所以这里逐值断言，不接受"字符串里带 px 就算过"。
  it('never emits undefined px for inherited keys', () => {
    const inheritedKeys: string[] = ['__proto__', 'constructor', 'toString'];

    for (const key of inheritedKeys) {
      expect(resolveThumbnailCssVariables(key as ThumbnailSize)).toEqual({
        '--navigator-list-view-entry-height': '64px',
        '--navigator-grid-view-entry-height': '180px',
        '--navigator-grid-view-dir-entry-height': '78px',
      });
    }
  });
});
