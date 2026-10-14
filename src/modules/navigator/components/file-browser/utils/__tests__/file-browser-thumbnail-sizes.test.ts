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
    [
      'small',
      {
        listThumbnailPx: 32,
        listRowHeight: 48,
        listRowHeightWithDescription: 62,
        gridEntryHeight: 80,
        gridDirEntryHeight: 35,
        gridMinColumnWidth: 113,
      },
    ],
    [
      'medium',
      {
        listThumbnailPx: 48,
        listRowHeight: 64,
        listRowHeightWithDescription: 78,
        gridEntryHeight: 120,
        gridDirEntryHeight: 52,
        gridMinColumnWidth: 170,
      },
    ],
    [
      'large',
      {
        listThumbnailPx: 64,
        listRowHeight: 80,
        listRowHeightWithDescription: 94,
        gridEntryHeight: 160,
        gridDirEntryHeight: 69,
        gridMinColumnWidth: 227,
      },
    ],
    [
      'xlarge',
      {
        listThumbnailPx: 80,
        listRowHeight: 96,
        listRowHeightWithDescription: 110,
        gridEntryHeight: 200,
        gridDirEntryHeight: 87,
        gridMinColumnWidth: 283,
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

  // 兜底一旦被原型键绕过，产物就是 `${undefined}px` 这种静默失效的 CSS 声明，
  // 所以这里逐值断言，不接受"字符串里带 px 就算过"。
  it('never emits undefined px for inherited keys', () => {
    const inheritedKeys: string[] = ['__proto__', 'constructor', 'toString'];

    for (const key of inheritedKeys) {
      expect(resolveThumbnailCssVariables(key as ThumbnailSize)).toEqual({
        '--navigator-list-view-entry-height': '64px',
        '--navigator-grid-view-entry-height': '120px',
        '--navigator-grid-view-dir-entry-height': '52px',
      });
    }
  });
});
