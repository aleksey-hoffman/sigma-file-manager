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

// FORK-MODIFICATION: 反馈 3（2026-10-15）——mock 必须**真的**长出一个克隆 pane。
// 原来 toggleSplitViewMock 是空实现，tabGroup 永远只有 1 个 tab，
// 于是「右格那个 tab 有没有拿到过滤词」这件事在单测里根本无从观察 ——
// 而它恰恰是反馈 3 的全部要害。现在按 store 的真实语义补上：
// enableSplitView → splitTabGroup → tabGroup.push(clone(tabGroup[0])) 且换新 id。
function toggleSplitViewImpl() {
  const tabGroup = currentTabGroupRef.value as Array<Record<string, unknown>>;

  if (tabGroup.length === 1) {
    tabGroup.push({
      ...tabGroup[0],
      id: 'tab-2-clone',
    });
  }
}

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
    toggleSplitViewMock.mockReset().mockImplementation(toggleSplitViewImpl);
  });

  function tabGroup(): Array<Record<string, unknown>> {
    return currentTabGroupRef.value as Array<Record<string, unknown>>;
  }

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

  // FORK-MODIFICATION: 反馈 3（2026-10-15）——工具栏过滤通道的左右两格对调。
  // 原来这里断言 setCurrentTabIndex(1)：所属目录落右格，左格留搜索前的目录 ——
  // 正是用户指出的错。断言写成 0 是这道反馈的判别点。
  it('puts the containing directory on the left pane when it splits', async () => {
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
    // 反馈 3：左格 = 所属目录。右格（克隆出来的那个）留给搜索结果。
    expect(setCurrentTabIndexMock).toHaveBeenCalledWith(0);
    expect(openNewTabGroupMock).not.toHaveBeenCalled();
  });

  // 反馈 3 的另一半：右格必须**继续显示搜索结果**。
  // 拆出来的 pane 是全新挂载的组件，过滤词在组件本地 ref 里，克隆带不过来 ——
  // 不显式交接的话右格显示的就是搜索前的目录，「保持搜索结果」根本没发生。
  it('hands the filter query over to the cloned right pane only', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];
    globalSearchIsOpenRef.value = false;

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf', {
      filterQuery: 'report',
    });

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    const [revealPane, resultsPane] = tabGroup();

    expect(resultsPane?.pendingFilterQuery).toBe('report');
    // 左格要跳去所属目录，不能带着过滤词 —— 否则看起来像"没跳过去"。
    expect(revealPane?.pendingFilterQuery).toBeUndefined();
  });

  // 空过滤词必须写 undefined 而不是 ''：FileBrowser 按「有值才接管」处理，
  // '' 会被当成「用户要一个空过滤器」而把过滤框打开。
  it('writes undefined rather than an empty string for a blank filter query', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/report.pdf', {
      filterQuery: '',
    });

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    expect(tabGroup()[1]?.pendingFilterQuery).toBeUndefined();
  });

  // 重复点别的搜索结果时，左格会再被上一轮留在 tab 上的交接位污染。
  // clone 是深拷贝，所以必须显式清理 —— 这条钉的就是那次清理。
  it('clears a stale hand-over from the left pane on a repeated reveal', async () => {
    currentTabGroupRef.value = [
      {
        id: 'tab-1',
        path: 'C:/Users/aleks',
        // 上一轮 reveal 留下的交接位
        pendingFilterQuery: 'old-query',
      },
    ];

    const router = createRouter('navigator');

    openNavigatorRevealEntry(router, 'C:/Users/aleks/Downloads/other.pdf', {
      filterQuery: 'other',
    });

    await vi.waitFor(() => {
      expect(openPathInCurrentTabMock).toHaveBeenCalledWith('C:/Users/aleks/Downloads');
    });

    expect(tabGroup()[0]?.pendingFilterQuery).toBeUndefined();
    expect(tabGroup()[1]?.pendingFilterQuery).toBe('other');
  });

  // 两侧都列表样式：标记打在两个 tab 上，由各自的 FileBrowser 解析。
  // 断言打在 tab 对象上而不是函数参数上 —— 早一版是通过
  // `setPendingLaunchReveal` 的第三个参数下发，那条路要求 navigator.vue 额外
  // 存一份锁状态并给每个 pane 挂监听；挂到 tab 上则外层一行都不用改。
  it('marks both panes to force list layout after splitting', async () => {
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

    // 两格都标：只标右格的话左格多半仍是网格，等于没满足「都采用列表样式视图」。
    expect(tabGroup().map(pane => pane.pendingForceListLayout)).toEqual([true, true]);
  });

  // 全局搜索面板通道不拆栏，也就没有「两格」可言，不该打这个标记。
  it('does not force list layout when it does not split', async () => {
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

    expect(tabGroup()[0]?.pendingForceListLayout).toBeUndefined();
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
