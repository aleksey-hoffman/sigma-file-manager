// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { UserSettingsNavigator } from '@/types/user-settings';
import {
  buildExtensionViewSortingUpdates,
  isExtensionViewLayout,
  isExtensionViewSortDirection,
  normalizeExtensionViewSortColumn,
  readExtensionViewLayout,
  readExtensionViewSorting,
  toNavigatorLayoutType,
} from '@/modules/extensions/utils/extension-view-settings';

function createNavigator(overrides: Partial<UserSettingsNavigator> = {}): UserSettingsNavigator {
  return {
    layout: {
      type: {
        title: 'listLayout',
        name: 'list',
      },
      dirItemOptions: {
        title: { height: 0 },
        directory: { height: 0 },
        file: { height: 0 },
      },
    },
    listSortColumn: 'name',
    listSortDirection: 'asc',
    gridSortColumn: 'name',
    gridSortDirection: 'desc',
    ...overrides,
  } as UserSettingsNavigator;
}

describe('extension-view-settings', () => {
  it('validates supported layout modes', () => {
    expect(isExtensionViewLayout('list')).toBe(true);
    expect(isExtensionViewLayout('details')).toBe(false);
  });

  it('maps layout modes to navigator layout objects', () => {
    expect(toNavigatorLayoutType('grid')).toEqual({
      title: 'gridLayout',
      name: 'grid',
    });
  });

  it('normalizes legacy sort column aliases', () => {
    expect(normalizeExtensionViewSortColumn('dateModified')).toBe('modified');
    expect(normalizeExtensionViewSortColumn('type')).toBe('kind');
  });

  it('validates supported sort directions', () => {
    expect(isExtensionViewSortDirection('asc')).toBe(true);
    expect(isExtensionViewSortDirection('desc')).toBe(true);
    expect(isExtensionViewSortDirection('ascending')).toBe(false);
  });

  it('rejects invalid sort order values', () => {
    expect(() => buildExtensionViewSortingUpdates(createNavigator(), 'list', {
      by: 'name',
      order: 'ascending' as never,
    })).toThrow('Invalid sort order: ascending');
  });

  it('reads layout and sorting for the active view', () => {
    const navigator = createNavigator({
      layout: {
        type: {
          title: 'gridLayout',
          name: 'grid',
        },
        dirItemOptions: {
          title: { height: 0 },
          directory: { height: 0 },
          file: { height: 0 },
        },
      },
      gridSortColumn: 'modified',
      gridSortDirection: 'desc',
    });

    expect(readExtensionViewLayout(navigator)).toBe('grid');
    expect(readExtensionViewSorting(navigator, 'grid')).toEqual({
      by: 'modified',
      order: 'desc',
    });
  });

  it('uses list sort settings for compact-list layout', () => {
    const navigator = createNavigator({
      layout: {
        type: {
          title: 'compactListLayout',
          name: 'compact-list',
        },
        dirItemOptions: {
          title: { height: 0 },
          directory: { height: 0 },
          file: { height: 0 },
        },
      },
      listSortColumn: 'created',
      listSortDirection: 'desc',
    });

    expect(readExtensionViewSorting(navigator, 'compact-list')).toEqual({
      by: 'created',
      order: 'desc',
    });
  });

  it('builds sorting updates for the active layout', () => {
    const navigator = createNavigator();
    const updates = buildExtensionViewSortingUpdates(navigator, 'list', {
      by: 'size',
      order: 'desc',
    });

    expect(updates).toEqual([
      {
        key: 'navigator.listSortColumn',
        value: 'size',
      },
      {
        key: 'navigator.listSortDirection',
        value: 'desc',
      },
    ]);
  });
});
