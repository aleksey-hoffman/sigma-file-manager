// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { ListColumnVisibility } from '@/types/user-settings';
import {
  buildCompactListColumnWidths,
  buildListColumnsGridTemplate,
  clampListColumnWidth,
  convertWidthsToFlexWeights,
  getListColumnFlexGridTrack,
  getListColumnGridTrack,
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
      'tags',
      'size',
      'items',
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
      'minmax(120px, 1fr)',
      'minmax(90px, 1fr)',
    ].join(' '));
  });

  it('builds one track per visible column', () => {
    const allVisible = {
      kind: true,
      links: true,
      linkTarget: true,
      linkStatus: true,
      items: true,
      size: true,
      modified: true,
      created: true,
      tags: true,
    };
    const visibleColumns = getVisibleListColumnDefinitions(allVisible);
    const template = buildListColumnsGridTemplate(allVisible, defaultTemplateOptions);
    const tracks = visibleColumns.map(definition => getListColumnGridTrack(definition, undefined));

    expect(visibleColumns).toHaveLength(9);
    expect(tracks).toHaveLength(visibleColumns.length);
    expect(template).toBe(tracks.join(' '));
  });

  it('builds compact widths from visible column minimums', () => {
    expect(buildCompactListColumnWidths(defaultVisibility)).toEqual({
      name: 200,
      kind: 90,
      size: 50,
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
        modified: 140,
        kind: 100,
      },
      'name',
      460,
    );

    expect(redistributed.name).toBe(450);
    expect(redistributed.items).toBeLessThan(80);
    expect(redistributed.size).toBeLessThan(60);
    expect(
      Object.values(redistributed).reduce((sum, width) => sum + (width ?? 0), 0),
    ).toBe(780);
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
});
