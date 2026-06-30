// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import { ref } from 'vue';
import type { Router } from 'vue-router';
import type { DirEntry } from '@/types/dir-entry';

const {
  getDirEntryMock,
  openNewTabGroupMock,
  openPathInCurrentTabMock,
  setPendingLaunchRevealMock,
} = vi.hoisted(() => ({
  getDirEntryMock: vi.fn(),
  openNewTabGroupMock: vi.fn(),
  openPathInCurrentTabMock: vi.fn(),
  setPendingLaunchRevealMock: vi.fn(),
}));

vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    getDirEntry: getDirEntryMock,
    openNewTabGroup: openNewTabGroupMock,
    openPathInCurrentTab: openPathInCurrentTabMock,
    setPendingLaunchReveal: setPendingLaunchRevealMock,
  }),
}));

vi.mock('@/router/routes', () => ({
  loadNavigatorRoute: vi.fn(async () => ({})),
}));

import { openNavigatorPath, preloadNavigatorRoute } from '@/utils/open-navigator-directory';
import { loadNavigatorRoute } from '@/router/routes';

function createRouter(routeName: string | symbol | null | undefined): Router {
  return {
    currentRoute: ref({ name: routeName }),
    push: vi.fn(async () => undefined),
  } as unknown as Router;
}

function createEntry(overrides: Partial<DirEntry> & Pick<DirEntry, 'path'>): DirEntry {
  return {
    name: overrides.path,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
    ...overrides,
  };
}

describe('openNavigatorPath', () => {
  beforeEach(() => {
    getDirEntryMock.mockReset();
    openNewTabGroupMock.mockReset().mockResolvedValue(undefined);
    openPathInCurrentTabMock.mockReset().mockResolvedValue(undefined);
    setPendingLaunchRevealMock.mockReset();
    vi.mocked(loadNavigatorRoute).mockClear();
  });

  it('preloads the navigator route chunk', () => {
    preloadNavigatorRoute();
    expect(loadNavigatorRoute).toHaveBeenCalledTimes(1);
  });

  it('navigates immediately and opens the tab without waiting for path resolution', async () => {
    let resolveDirEntry: ((value: DirEntry | null) => void) | undefined;
    getDirEntryMock.mockReturnValue(new Promise((resolve) => {
      resolveDirEntry = resolve;
    }));

    const router = createRouter('home');

    openNavigatorPath(router, 'C:/Users/aleks/Downloads', { resolvePath: true });

    expect(router.push).toHaveBeenCalledWith({ name: 'navigator' });
    expect(openNewTabGroupMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');

    resolveDirEntry?.(createEntry({
      path: 'C:/Users/aleks/Downloads',
      is_file: false,
      is_dir: true,
    }));

    await vi.waitFor(() => {
      expect(getDirEntryMock).toHaveBeenCalledWith({ path: 'C:/Users/aleks/Downloads' });
    });
  });

  it('corrects the current tab when resolved path differs from the optimistic path', async () => {
    getDirEntryMock.mockResolvedValue(createEntry({
      path: 'D:/Resolved/Downloads',
      is_file: false,
      is_dir: true,
    }));

    const router = createRouter('home');

    openNavigatorPath(router, 'C:/Users/aleks/Downloads', { resolvePath: true });

    await vi.waitFor(() => {
      expect(openNewTabGroupMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('D:/Resolved/Downloads');
    });

    expect(openNewTabGroupMock).toHaveBeenCalledTimes(1);
  });

  it('reveals files after resolving a file path', async () => {
    getDirEntryMock.mockResolvedValue(createEntry({
      path: 'C:/Users/aleks/Downloads/report.pdf',
      is_file: true,
      is_dir: false,
    }));

    const router = createRouter('home');

    openNavigatorPath(router, 'C:/Users/aleks/Downloads/report.pdf', { resolvePath: true });

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
      expect(setPendingLaunchRevealMock).toHaveBeenCalledWith(
        'C:/Users/aleks/Downloads',
        'C:/Users/aleks/Downloads/report.pdf',
      );
    });
  });

  it('opens the current tab when already on navigator', async () => {
    const router = createRouter('navigator');

    openNavigatorPath(router, 'C:/Users/aleks/Downloads');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    expect(router.push).not.toHaveBeenCalled();
    expect(openNewTabGroupMock).not.toHaveBeenCalled();
  });
});
