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
  currentTabGroupRef,
  getDirEntryMock,
  openNewTabGroupMock,
  openPathInCurrentTabMock,
  setCurrentTabIndexMock,
  setPendingLaunchRevealMock,
  toggleSplitViewMock,
} = vi.hoisted(() => ({
  currentTabGroupRef: { value: [] as unknown[] },
  getDirEntryMock: vi.fn(),
  openNewTabGroupMock: vi.fn(),
  openPathInCurrentTabMock: vi.fn(),
  setCurrentTabIndexMock: vi.fn(),
  setPendingLaunchRevealMock: vi.fn(),
  toggleSplitViewMock: vi.fn(),
}));

vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    get currentTabGroup() { return currentTabGroupRef.value; },
    getDirEntry: getDirEntryMock,
    openNewTabGroup: openNewTabGroupMock,
    openPathInCurrentTab: openPathInCurrentTabMock,
    setCurrentTabIndex: setCurrentTabIndexMock,
    setPendingLaunchReveal: setPendingLaunchRevealMock,
    toggleSplitView: toggleSplitViewMock,
  }),
}));

vi.mock('@/router/routes', () => ({
  loadNavigatorRoute: vi.fn(async () => ({})),
}));

import {
  openNavigatorPath,
  openNavigatorPathInNewTab,
  openNavigatorRevealEntry,
  preloadNavigatorRoute,
} from '@/utils/open-navigator-directory';
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

describe('openNavigatorPathInNewTab', () => {
  beforeEach(() => {
    openNewTabGroupMock.mockReset().mockResolvedValue(undefined);
    openPathInCurrentTabMock.mockReset().mockResolvedValue(undefined);
  });

  it('opens and activates a tab group and navigates to navigator', async () => {
    const router = createRouter('home');

    openNavigatorPathInNewTab(router, 'D:/');

    expect(router.push).toHaveBeenCalledWith({ name: 'navigator' });

    await vi.waitFor(() => {
      expect(openNewTabGroupMock).toHaveBeenCalledWith('D:/');
    });

    expect(openPathInCurrentTabMock).not.toHaveBeenCalled();
  });

  it('opens and activates a tab group without navigating when already on navigator', async () => {
    const router = createRouter('navigator');

    openNavigatorPathInNewTab(router, 'D:/');

    expect(router.push).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(openNewTabGroupMock).toHaveBeenCalledWith('D:/');
    });
  });
});

// 真机验收（2026-10-15）推翻了这里的旧实现：原先调 openNewTabGroup，实测结果是
// 标签条上多出一个新标签、内容区仍只有一个面板。导航器的并排面板是遍历
// **当前 tabGroup 内的每个 tab** 渲染的（navigator.vue 的
// isSplitView === currentTabGroup.length > 1），所以「右侧多一个面板」要靠
// toggleSplitView 在当前 tabGroup 里加第二个 tab，而不是新开标签组。
describe('openNavigatorRevealEntry', () => {
  beforeEach(() => {
    currentTabGroupRef.value = [];
    openNewTabGroupMock.mockReset().mockResolvedValue(undefined);
    openPathInCurrentTabMock.mockReset().mockResolvedValue(undefined);
    setCurrentTabIndexMock.mockReset();
    setPendingLaunchRevealMock.mockReset();
    toggleSplitViewMock.mockReset();
  });

  it('splits the current tab group and points the right pane at the parent directory', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    expect(toggleSplitViewMock).toHaveBeenCalledTimes(1);
    expect(setCurrentTabIndexMock).toHaveBeenCalledWith(1);
    expect(openNewTabGroupMock).not.toHaveBeenCalled();
  });

  it('does not toggle again when the group is already split', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
      {
        id: 'tab-2',
        path: 'D:/',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'D:/notes.md');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('D:/');
    });

    // toggleSplitView on an already-split group collapses the panes back.
    expect(toggleSplitViewMock).not.toHaveBeenCalled();
    expect(setCurrentTabIndexMock).toHaveBeenCalledWith(1);
  });

  it('reveals the entry itself, not its parent, after the split', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf');

    await vi.waitFor(() => {
      expect(setPendingLaunchRevealMock).toHaveBeenCalledWith(
        'C:/Users/aleks/Downloads',
        'C:/Users/aleks/Downloads/report.pdf',
      );
    });
  });

  it('uses the parent of a directory result so the directory itself stays selected', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks');
      expect(setPendingLaunchRevealMock).toHaveBeenCalledWith(
        'C:/Users/aleks',
        'C:/Users/aleks/Downloads',
      );
    });
  });
});
