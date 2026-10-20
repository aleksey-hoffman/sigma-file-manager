// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { ListColumnVisibility } from '@/types/user-settings';
import {
  applyListColumnVisibilityForPath,
  buildCompactListColumnWidths,
  buildListColumnsGridTemplate,
  clampListColumnWidth,
  convertWidthsToFlexWeights,
  getListColumnFlexGridTrack,
  getListColumnGridTrack,
  getListColumnIdsHiddenForPath,
  getVisibleListColumnDefinitions,
  normalizeListColumnOrder,
  redistributeListColumnWidths,
} from '../file-browser-list-columns';

const defaultVisibility: ListColumnVisibility = {
  kind: true,
  links: false,
  linkTarget: false,
  linkStatus: false,
  items: true,
  size: true,
  // FORK-MODIFICATION 2026-10-20：与产品默认值一致 —— 「可用空间」默认可见。
  availableSpace: true,
  modified: true,
  created: false,
  tags: false,
};

const defaultTemplateOptions = {
  fillWidth: false,
  columnWidths: {},
  flexWeights: {},
  resizePreviewWidths: {},
  resizePreviewFlexWeights: {},
  isResizing: false,
};

describe('file-browser-list-columns', () => {
  it('clamps widths to the column minimum', () => {
    expect(clampListColumnWidth(40, 70)).toBe(70);
    expect(clampListColumnWidth(88.4, 70)).toBe(88);
  });

  it('keeps default grid tracks when no widths are saved', () => {
    expect(getListColumnGridTrack(
      {
        id: 'items',
        visibilityKey: 'items',
        defaultMin: 70,
        defaultMax: 90,
      },
      undefined,
    )).toBe('minmax(70px, 90px)');
    expect(getListColumnGridTrack(
      {
        id: 'name',
        visibilityKey: null,
        defaultMin: 200,
        defaultMax: Number.POSITIVE_INFINITY,
        isFlex: true,
      },
      undefined,
    )).toBe('minmax(200px, 500px)');
  });

  it('builds flex tracks with default and saved weights', () => {
    expect(getListColumnFlexGridTrack(
      {
        id: 'name',
        visibilityKey: null,
        defaultMin: 200,
        defaultMax: Number.POSITIVE_INFINITY,
        isFlex: true,
      },
      undefined,
    )).toBe('minmax(200px, 4fr)');
    expect(getListColumnFlexGridTrack(
      {
        id: 'size',
        visibilityKey: 'size',
        defaultMin: 50,
        defaultMax: 100,
      },
      3,
    )).toBe('minmax(50px, 3fr)');
  });

  it('applies saved widths as fixed tracks without going below defaults', () => {
    expect(getListColumnGridTrack(
      {
        id: 'size',
        visibilityKey: 'size',
        defaultMin: 50,
        defaultMax: 100,
      },
      120,
    )).toBe('120px');
    expect(getListColumnGridTrack(
      {
        id: 'size',
        visibilityKey: 'size',
        defaultMin: 50,
        defaultMax: 100,
      },
      30,
    )).toBe('50px');
    expect(getListColumnGridTrack(
      {
        id: 'name',
        visibilityKey: null,
        defaultMin: 200,
        defaultMax: Number.POSITIVE_INFINITY,
        isFlex: true,
      },
      640,
    )).toBe('640px');
  });

  it('normalizes saved column order and appends missing columns', () => {
    expect(normalizeListColumnOrder(['tags', 'size', 'tags', 'unknown'])).toEqual([
      // 先保留已保存的（去重、丢弃 unknown），再按
      // FILE_BROWSER_LIST_REORDERABLE_COLUMN_IDS 的顺序补齐缺失列。
      'tags',
      'size',
      'items',
      // FORK-MODIFICATION 2026-10-20：可用空间紧跟「大小」，
      // 而「大小」本身在声明顺序里排第二，所以补齐时落在 items 之后。
      'availableSpace',
      'modified',
      'created',
      'kind',
      'links',
      'linkStatus',
    ]);
  });

  it('builds templates from visible columns, saved widths, and order', () => {
    const template = buildListColumnsGridTemplate(
      defaultVisibility,
      {
        ...defaultTemplateOptions,
        columnWidths: { size: 110 },
      },
      ['tags', 'size', 'items', 'modified', 'kind'],
    );

    expect(template).toBe([
      'minmax(200px, 500px)',
      '110px',
      'minmax(70px, 90px)',
      'minmax(120px, 160px)',
      'minmax(90px, 130px)',
      // FORK-MODIFICATION 2026-10-20：availableSpace 没有保存宽度，走区间轨道；
      // 它排在 kind 之后是因为用户给的 order 里没写它，normalize 按声明顺序补在末尾。
      'minmax(50px, 100px)',
    ].join(' '));
  });

  it('builds fill-width templates from flex weights', () => {
    const template = buildListColumnsGridTemplate(
      defaultVisibility,
      {
        fillWidth: true,
        columnWidths: {},
        flexWeights: {
          name: 6,
          size: 2,
        },
        resizePreviewWidths: {},
        resizePreviewFlexWeights: {},
        isResizing: false,
      },
    );

    expect(template).toBe([
      'minmax(200px, 6fr)',
      'minmax(70px, 1fr)',
      'minmax(50px, 2fr)',
      // FORK-MODIFICATION 2026-10-20：可用空间列的默认 flex 权重是 1。
      'minmax(50px, 1fr)',
      'minmax(120px, 1fr)',
      'minmax(90px, 1fr)',
    ].join(' '));
  });

  it('uses preview flex weights while resizing in fill mode', () => {
    const template = buildListColumnsGridTemplate(
      defaultVisibility,
      {
        fillWidth: true,
        columnWidths: {},
        flexWeights: {},
        resizePreviewWidths: {},
        resizePreviewFlexWeights: {
          name: 220,
          items: 1,
          size: 5,
          modified: 1,
          kind: 1,
        },
        isResizing: true,
      },
    );

    expect(template).toBe([
      'minmax(200px, 220fr)',
      'minmax(70px, 1fr)',
      'minmax(50px, 5fr)',
      // FORK-MODIFICATION 2026-10-20：预览权重里没有 availableSpace，落到默认 1fr。
      'minmax(50px, 1fr)',
      'minmax(120px, 1fr)',
      'minmax(90px, 1fr)',
    ].join(' '));
  });

  it('builds one track per visible column', () => {
    const allVisible: ListColumnVisibility = {
      kind: true,
      links: true,
      linkTarget: true,
      linkStatus: true,
      items: true,
      size: true,
      // FORK-MODIFICATION 2026-10-20
      availableSpace: true,
      modified: true,
      created: true,
      tags: true,
    };
    const visibleColumns = getVisibleListColumnDefinitions(allVisible);
    const template = buildListColumnsGridTemplate(allVisible, defaultTemplateOptions);
    const tracks = visibleColumns.map(definition => getListColumnGridTrack(definition, undefined));

    // 名称列 + 9 个可选列（8 个原有 + 可用空间）。
    expect(visibleColumns).toHaveLength(10);
    expect(tracks).toHaveLength(visibleColumns.length);
    expect(template).toBe(tracks.join(' '));
  });

  it('builds compact widths from visible column minimums', () => {
    expect(buildCompactListColumnWidths(defaultVisibility)).toEqual({
      name: 200,
      kind: 90,
      size: 50,
      // FORK-MODIFICATION 2026-10-20
      availableSpace: 50,
      items: 70,
      modified: 120,
    });
  });

  it('returns visible columns in saved order with name first', () => {
    expect(getVisibleListColumnDefinitions(defaultVisibility, ['kind', 'size', 'items']).map(column => column.id)).toEqual([
      'name',
      'kind',
      'size',
      'items',
      // FORK-MODIFICATION 2026-10-20：order 里没写 availableSpace，
      // normalize 补在末尾，所以它排在 modified 前面而不是 size 后面。
      'availableSpace',
      'modified',
    ]);
  });

  it('redistributes widths proportionally when resizing in fill mode', () => {
    const definitions = getVisibleListColumnDefinitions(defaultVisibility);
    const redistributed = redistributeListColumnWidths(
      definitions,
      {
        name: 400,
        items: 80,
        size: 60,
        // FORK-MODIFICATION 2026-10-20：把可用空间也放进初始宽度，
        // 这样这条用例能顺带证明新列参与重分配，而不是躺在旁边不动的乘客。
        availableSpace: 70,
        modified: 140,
        kind: 100,
      },
      'name',
      460,
    );

    expect(redistributed.name).toBe(460);
    expect(redistributed.items).toBeLessThan(80);
    expect(redistributed.size).toBeLessThan(60);
    expect(redistributed.availableSpace).toBeLessThan(70);
    expect(
      Object.values(redistributed).reduce((sum, width) => sum + (width ?? 0), 0),
    ).toBe(850);
  });

  it('converts widths to flex weights from the space above minimums', () => {
    expect(convertWidthsToFlexWeights(
      getVisibleListColumnDefinitions(defaultVisibility),
      {
        name: 420,
        size: 55,
      },
    )).toEqual({
      name: 220,
      size: 5,
    });
  });

  // FORK-MODIFICATION 2026-10-20（用户附图要求）：列只在它有意义的地方出现。
  describe('按路径隐藏的列表列', () => {
    it('位置页把「修改时间」「创建时间」都藏起来', () => {
      // 位置页列的是磁盘，磁盘既没有修改时间也没有创建时间，
      // 那一列整列都是 `-`。
      const hidden = getListColumnIdsHiddenForPath('sfm://locations');

      expect(hidden.size).toBeGreaterThan(0);
      expect(hidden.has('modified')).toBe(true);
      expect(hidden.has('created')).toBe(true);
    });

    it('位置页保留「可用空间」', () => {
      expect(getListColumnIdsHiddenForPath('sfm://locations').has('availableSpace')).toBe(false);
    });

    it('普通目录把「可用空间」藏起来', () => {
      // 普通目录里没有磁盘条目，那一列整列都是 `—`。
      const hidden = getListColumnIdsHiddenForPath('C:/Users');

      expect(hidden.size).toBeGreaterThan(0);
      expect(hidden.has('availableSpace')).toBe(true);
    });

    it('普通目录保留日期列', () => {
      const hidden = getListColumnIdsHiddenForPath('C:/Users');

      expect(hidden.has('modified')).toBe(false);
      expect(hidden.has('created')).toBe(false);
    });

    it('位置页算出来的可见性里没有日期列，其它列照旧', () => {
      const visibility = applyListColumnVisibilityForPath(defaultVisibility, 'sfm://locations');

      expect(visibility.modified).toBe(false);
      expect(visibility.created).toBe(false);
      expect(visibility.items).toBe(true);
      expect(visibility.size).toBe(true);
      expect(visibility.availableSpace).toBe(true);
      expect(visibility.kind).toBe(true);
    });

    it('普通目录算出来的可见性里没有「可用空间」，日期列照旧', () => {
      const visibility = applyListColumnVisibilityForPath(defaultVisibility, 'C:/Users');

      expect(visibility.availableSpace).toBe(false);
      expect(visibility.modified).toBe(true);
      expect(visibility.created).toBe(false);
      expect(visibility.items).toBe(true);
      expect(visibility.size).toBe(true);
    });

    it('不修改传进来的那一份 —— 全局偏好不能被这一页改掉', () => {
      // 就地改的话，用户在位置页关掉一次「修改时间」，
      // 换个普通文件夹就再也回不来了。
      const visibility = applyListColumnVisibilityForPath(defaultVisibility, 'sfm://locations');

      expect(visibility).not.toBe(defaultVisibility);
      expect(defaultVisibility.modified).toBe(true);
      expect(defaultVisibility.availableSpace).toBe(true);
    });

    it('用户自己关掉的列不受影响（已经是 false 就不要再动）', () => {
      const hiddenAlready: ListColumnVisibility = {
        ...defaultVisibility,
        modified: false,
      };

      const visibility = applyListColumnVisibilityForPath(hiddenAlready, 'sfm://locations');

      expect(visibility.modified).toBe(false);
      expect(visibility.created).toBe(false);
    });

    it('位置页的可见列里真的没有「修改时间」，却有「可用空间」', () => {
      // 前面几条只验了规则本身；这一条验「规则接上去之后列真的不见了」。
      const visibility = applyListColumnVisibilityForPath(defaultVisibility, 'sfm://locations');
      const columnIds = getVisibleListColumnDefinitions(visibility).map(definition => definition.id);

      expect(columnIds).not.toContain('modified');
      expect(columnIds).toContain('size');
      expect(columnIds).toContain('availableSpace');
    });

    it('普通目录的可见列里没有「可用空间」，却有「修改时间」', () => {
      const visibility = applyListColumnVisibilityForPath(defaultVisibility, 'C:/Users');
      const columnIds = getVisibleListColumnDefinitions(visibility).map(definition => definition.id);

      expect(columnIds).not.toContain('availableSpace');
      expect(columnIds).toContain('modified');
      expect(columnIds).toContain('size');
    });
  });
});
