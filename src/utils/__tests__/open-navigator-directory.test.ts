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
  globalSearchIsOpenRef,
} = vi.hoisted(() => ({
  currentTabGroupRef: { value: [] as unknown[] },
  getDirEntryMock: vi.fn(),
  openNewTabGroupMock: vi.fn(),
  openPathInCurrentTabMock: vi.fn(),
  setCurrentTabIndexMock: vi.fn(),
  setPendingLaunchRevealMock: vi.fn(),
  toggleSplitViewMock: vi.fn(),
  globalSearchIsOpenRef: { value: false },
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

// FORK-MODIFICATION: 全局搜索面板开着 = 结果列表独立在布局左侧，旁边的导航器 pane
// 直接复用（不拆分）。关着 = 结果列表就是导航器 pane 自己，才需要拆出新 pane。
vi.mock('@/stores/runtime/global-search', () => ({
  useGlobalSearchStore: () => ({
    get isOpen() { return globalSearchIsOpenRef.value; },
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

// 2026-10-15 真机验收把这个 describe 的前提推翻过一次，别再回退：
//
// 导航器的并排面板是遍历**当前 tabGroup 内的每个 tab** 渲染的
// （`navigator.vue` 的 `isSplitView === currentTabGroup.length > 1`），
// 所以「多一个面板」= tabGroup 里多一个 tab（`toggleSplitView`），
// 而不是 `openNewTabGroup`（那会在标签条上加标签、内容区不变）。
//
// 但「总是拆分」同样是错的：用户要的是搜索结果列表**保持打开、内容不变**，
// 父目录显示在它**旁边**。全局搜索面板开着时，这个布局本来就存在
// （`.navigator-page__panes-container` 是横向 flex），所以这时必须**不拆**。
// 两条通道由 `globalSearchStore.isOpen` 区分。
describe('openNavigatorRevealEntry', () => {
  beforeEach(() => {
    currentTabGroupRef.value = [];
    globalSearchIsOpenRef.value = false;
    openNewTabGroupMock.mockReset().mockResolvedValue(undefined);
    openPathInCurrentTabMock.mockReset().mockResolvedValue(undefined);
    setCurrentTabIndexMock.mockReset();
    setPendingLaunchRevealMock.mockReset();
    toggleSplitViewMock.mockReset();
  });

  it('keeps the single pane and reuses it when the search panel owns the result list', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];
    globalSearchIsOpenRef.value = true;

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    // 拆分会把「搜索面板 + 两个导航器 pane」挤在一屏，左侧列表虽在但右半屏被劈成两半。
    expect(toggleSplitViewMock).not.toHaveBeenCalled();
    expect(setCurrentTabIndexMock).toHaveBeenCalledWith(0);
    expect(openNewTabGroupMock).not.toHaveBeenCalled();
  });

  it('splits only when the navigator pane itself is the filtered result list', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];
    globalSearchIsOpenRef.value = false;

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf');

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    expect(toggleSplitViewMock).toHaveBeenCalledTimes(1);
    // 新 pane 落在最右（index 1），原 pane 留着过滤结果不动。
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

  it('never splits an empty tab group (toggleSplitView would clone an undefined tab)', async () => {
    currentTabGroupRef.value = [];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/report.pdf');

    await vi.waitFor(() => {
      expect(setCurrentTabIndexMock).toHaveBeenCalledWith(0);
    });

    expect(toggleSplitViewMock).not.toHaveBeenCalled();
  });

  it('reveals the entry itself, not its parent', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];
    globalSearchIsOpenRef.value = true;

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
    globalSearchIsOpenRef.value = true;

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
