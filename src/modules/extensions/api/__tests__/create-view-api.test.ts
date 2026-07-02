// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { createViewAPI } from '@/modules/extensions/api/create-view-api';

const userSettingsStoreMock = {
  userSettings: {
    navigator: {
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
    },
  },
  set: vi.fn(async () => undefined),
};

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

function createContext(permissions: ExtensionPermission[] = []): ExtensionContext {
  return {
    extensionId: 'test.extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    t: (key: string, params?: Record<string, string | number>) => {
      if (params) {
        return `${key}:${Object.entries(params).map(([paramKey, paramValue]) => `${paramKey}=${paramValue}`).join(',')}`;
      }

      return key;
    },
  } as ExtensionContext;
}

describe('createViewAPI', () => {
  beforeEach(() => {
    userSettingsStoreMock.set.mockClear();
  });

  it('requires the view permission', async () => {
    const viewApi = createViewAPI(createContext());

    await expect(viewApi.getLayout()).rejects.toThrow('extensions.api.permissionDenied:permission=view');
  });

  it('reads the current layout and sorting', async () => {
    const viewApi = createViewAPI(createContext(['view']));

    await expect(viewApi.getLayout()).resolves.toBe('list');
    await expect(viewApi.getSorting()).resolves.toEqual({
      by: 'name',
      order: 'asc',
    });
  });

  it('updates layout and sorting settings', async () => {
    const viewApi = createViewAPI(createContext(['view']));

    await viewApi.setLayout('grid');
    userSettingsStoreMock.userSettings.navigator.layout.type = {
      title: 'gridLayout',
      name: 'grid',
    };
    await viewApi.setSorting({
      by: 'dateModified',
      order: 'desc',
    });

    expect(userSettingsStoreMock.set).toHaveBeenCalledWith('navigator.layout.type', {
      title: 'gridLayout',
      name: 'grid',
    });
    expect(userSettingsStoreMock.set).toHaveBeenCalledWith('navigator.gridSortColumn', 'modified');
    expect(userSettingsStoreMock.set).toHaveBeenCalledWith('navigator.gridSortDirection', 'desc');
  });

  it('rejects invalid sort order values', async () => {
    const viewApi = createViewAPI(createContext(['view']));

    await expect(viewApi.setSorting({
      by: 'name',
      order: 'ascending' as never,
    })).rejects.toThrow('Invalid sort order: ascending');
  });
});
