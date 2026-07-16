// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { DirContents } from '@/types/dir-entry';
import type { Tab, TabGroup, Workspace } from '@/types/workspaces';

const {
  closeWindowMock,
  invokeMock,
  lazyStoreGetMock,
  lazyStoreSaveMock,
  routerPushMock,
  toastCustomMock,
  updateInfoPanelMock,
} = vi.hoisted(() => ({
  closeWindowMock: vi.fn(),
  invokeMock: vi.fn(),
  lazyStoreGetMock: vi.fn(),
  lazyStoreSaveMock: vi.fn(),
  routerPushMock: vi.fn(),
  toastCustomMock: vi.fn(),
  updateInfoPanelMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    close: closeWindowMock,
  }),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {
      await lazyStoreSaveMock();
    }

    async get<T>(key: string): Promise<T | undefined> {
      return lazyStoreGetMock(key);
    }

    async set(): Promise<void> {}
  },
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/router', () => ({
  default: {
    push: routerPushMock,
  },
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    custom: toastCustomMock,
  },
  ToastStatic: {},
}));

vi.mock('@/stores/runtime/navigator', () => ({
  useNavigatorStore: () => ({
    updateInfoPanel: updateInfoPanelMock,
  }),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    userPaths: {
      homeDir: 'C:/Users/aleks',
    },
    customPaths: {
      appUserDataWorkspacesPath: 'mock/user-workspaces.json',
    },
  }),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: {
        lastTabCloseBehavior: 'createDefaultTab',
      },
    },
  }),
}));

import { useWorkspacesStore } from '@/stores/storage/workspaces';

describe('workspaces storage duplicate tabs', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    closeWindowMock.mockReset();
    invokeMock.mockReset();
    lazyStoreGetMock.mockReset();
    lazyStoreSaveMock.mockReset();
    routerPushMock.mockReset();
    toastCustomMock.mockReset();
    updateInfoPanelMock.mockReset();
  });

  it('closes duplicate single-tab groups for matching Windows paths and keeps the leftmost tab', async () => {
    const keepTab = createTab('keep-tab', 'C:\\Users\\aleks\\Projects\\');
    const duplicateTab = createTab('duplicate-tab', 'c:/users/aleks/projects');
    const thirdDuplicateTab = createTab('third-duplicate-tab', 'C:/USERS/ALEKS/PROJECTS///');
    const splitLeftTab = createTab('split-left-tab', 'C:/Users/aleks/Projects');
    const splitRightTab = createTab('split-right-tab', 'D:/Archive');
    const uniqueTab = createTab('unique-tab', 'D:/Docs');

    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [keepTab],
        [duplicateTab],
        [splitLeftTab, splitRightTab],
        [thirdDuplicateTab],
        [uniqueTab],
      ]),
    ];

    await workspacesStore.closeAllDuplicatePathTabs();

    expect(workspacesStore.currentWorkspace?.tabGroups).toEqual([
      [keepTab],
      [splitLeftTab, splitRightTab],
      [uniqueTab],
    ]);
  });

  it('closes duplicate paths across the workspace and keeps the leftmost tab for each path', async () => {
    const firstFooTab = createTab('first-foo-tab', 'C:/Projects/Foo');
    const secondFooTab = createTab('second-foo-tab', 'c:/projects/foo');
    const firstBarTab = createTab('first-bar-tab', 'D:/Archive/Bar');
    const secondBarTab = createTab('second-bar-tab', 'd:/archive/bar');
    const uniqueTab = createTab('unique-tab', 'E:/Docs');

    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [firstFooTab],
        [uniqueTab],
        [secondFooTab],
        [firstBarTab],
        [secondBarTab],
      ]),
    ];

    await workspacesStore.closeAllDuplicatePathTabs();

    expect(workspacesStore.currentWorkspace?.tabGroups).toEqual([
      [firstFooTab],
      [uniqueTab],
      [firstBarTab],
    ]);
  });

  it('does not close tabs that only differ by case on case-sensitive paths', async () => {
    const lowerCaseTab = createTab('lower-case-tab', '/projects/docs');
    const upperCaseTab = createTab('upper-case-tab', '/Projects/docs');
    const workspacesStore = useWorkspacesStore();

    workspacesStore.workspaces = [
      createWorkspace([
        [lowerCaseTab],
        [upperCaseTab],
      ]),
    ];

    await workspacesStore.closeAllDuplicatePathTabs();

    expect(workspacesStore.currentWorkspace?.tabGroups).toEqual([
      [lowerCaseTab],
      [upperCaseTab],
    ]);
  });

  it('opens a path in the current tab without creating a new tab group', async () => {
    mockDirectoryReadResponses();

    const currentTab = createTab('current-tab', 'C:/Users/aleks/Projects');
    const otherTab = createTab('other-tab', 'C:/Users/aleks/Documents');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [currentTab],
        [otherTab],
      ]),
    ];
    currentTab.filterQuery = 'notes';

    await workspacesStore.openPathInCurrentTab('D:/');

    expect(workspacesStore.currentWorkspace?.tabGroups).toHaveLength(2);
    expect(workspacesStore.currentTab?.id).toBe('current-tab');
    expect(workspacesStore.currentTab?.path).toBe('D:/');
    expect(workspacesStore.currentTab?.filterQuery).toBe('');
    expect(workspacesStore.consumeCurrentTabPathNavigationRequest('current-tab', 'D:/')).toBe(true);
    expect(workspacesStore.consumeCurrentTabPathNavigationRequest('current-tab', 'D:/')).toBe(false);
    expect(invokeMock).toHaveBeenCalledWith('read_dir_with_timeout', {
      path: 'D:/',
      timeoutMs: expect.any(Number),
      options: {
        includeShortcutTargets: false,
        includeHardLinkCounts: false,
        includeItemCounts: false,
      },
    });
  });

  it('does not overwrite a changed tab path with stale preloaded entries', async () => {
    const projectsRead = createDeferred<DirContents>();
    const documentsRead = createDeferred<DirContents>();

    invokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
      if (command === 'read_dir_with_timeout') {
        return payload?.path === 'C:/Users/aleks/Projects'
          ? projectsRead.promise
          : documentsRead.promise;
      }

      if (command === 'get_dir_entry_with_timeout') {
        return Promise.resolve({ path: payload?.path ?? '' });
      }

      return Promise.resolve(null);
    });

    const currentTab = createTab('current-tab', 'C:/Users/aleks/Projects');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [currentTab],
      ]),
    ];

    const projectsOpen = workspacesStore.openTabGroup([currentTab]);
    const documentsOpen = workspacesStore.openPathInCurrentTab('D:/Documents');

    documentsRead.resolve(createDirContents('D:/Documents', 'D:/Documents/current.txt'));
    await documentsOpen;

    projectsRead.resolve(createDirContents('C:/Users/aleks/Projects', 'C:/Users/aleks/Projects/stale.txt'));
    await projectsOpen;

    expect(currentTab.path).toBe('D:/Documents');
    expect(currentTab.dirEntries.map(entry => entry.path)).toEqual(['D:/Documents/current.txt']);
  });

  it('does not request history when reopening the current tab path', async () => {
    mockDirectoryReadResponses();

    const currentTab = createTab('current-tab', 'D:/');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [currentTab],
      ]),
    ];

    await workspacesStore.openPathInCurrentTab('D:/');

    expect(workspacesStore.consumeCurrentTabPathNavigationRequest('current-tab', 'D:/')).toBe(false);
  });

  it('opens a path in the focused split pane tab', async () => {
    mockDirectoryReadResponses();

    const leftTab = createTab('left-tab', 'C:/Users/aleks/Projects');
    const rightTab = createTab('right-tab', 'C:/Users/aleks/Documents');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [leftTab, rightTab],
      ]),
    ];
    workspacesStore.setCurrentTabIndex(1);

    await workspacesStore.openPathInCurrentTab('D:/');

    expect(leftTab.path).toBe('C:/Users/aleks/Projects');
    expect(rightTab.path).toBe('D:/');
    expect(workspacesStore.currentTab?.id).toBe('right-tab');
  });

  it('restores the most recently closed tab group at its previous position', async () => {
    mockDirectoryReadResponses();

    const firstTab = createTab('first-tab', 'C:/Users/aleks/First');
    const secondTab = createTab('second-tab', 'C:/Users/aleks/Second');
    const thirdTab = createTab('third-tab', 'C:/Users/aleks/Third');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [firstTab],
        [secondTab],
        [thirdTab],
      ]),
    ];

    await workspacesStore.closeTabGroup([secondTab]);
    const restored = await workspacesStore.restoreLastClosedTabGroup();

    expect(restored).toBe(true);
    expect(workspacesStore.currentWorkspace?.tabGroups.map(tabGroup => tabGroup[0]?.path)).toEqual([
      'C:/Users/aleks/First',
      'C:/Users/aleks/Second',
      'C:/Users/aleks/Third',
    ]);
    expect(workspacesStore.currentWorkspace?.currentTabGroupIndex).toBe(1);
    expect(workspacesStore.currentTabGroup?.[0]?.path).toBe('C:/Users/aleks/Second');
    expect(workspacesStore.currentTabGroup?.[0]?.id).not.toBe(secondTab.id);
  });

  it('shows the restored path when restoring a closed tab group', async () => {
    mockDirectoryReadResponses();

    const firstTab = createTab('first-tab', 'C:/Users/aleks/First');
    const secondTab = createTab('second-tab', 'C:/Users/aleks/Second');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [firstTab],
        [secondTab],
      ]),
    ];

    await workspacesStore.closeTabGroup([secondTab]);
    await workspacesStore.restoreLastClosedTabGroup();

    expect(toastCustomMock).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      componentProps: {
        data: {
          title: 'tabs.closedTabRestored',
          description: 'C:/Users/aleks/Second',
        },
      },
    }));
  });

  it('shows a toast when there is no closed tab group to restore', async () => {
    const workspacesStore = useWorkspacesStore();

    const restored = await workspacesStore.restoreLastClosedTabGroup();

    expect(restored).toBe(false);
    expect(toastCustomMock).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({
      componentProps: {
        data: {
          title: 'tabs.noClosedTabsToRestore',
        },
      },
    }));
  });

  it('restores a closed tab group with renamed paths', async () => {
    mockDirectoryReadResponses();

    const firstTab = createTab('first-tab', 'C:/Users/aleks/First');
    const renamedTab = createTab('renamed-tab', 'C:/Users/aleks/Old/Child');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [firstTab],
        [renamedTab],
      ]),
    ];

    await workspacesStore.closeTabGroup([renamedTab]);
    workspacesStore.handlePathRenamed('C:/Users/aleks/Old', 'C:/Users/aleks/New');
    const restored = await workspacesStore.restoreLastClosedTabGroup();

    expect(restored).toBe(true);
    expect(workspacesStore.currentTabGroup?.[0]?.path).toBe('C:/Users/aleks/New/Child');
  });

  it('restores a closed tab group with deleted paths redirected to home', async () => {
    mockDirectoryReadResponses();

    const firstTab = createTab('first-tab', 'C:/Users/aleks/First');
    const deletedTab = createTab('deleted-tab', 'C:/Users/aleks/Deleted/Child');
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace([
        [firstTab],
        [deletedTab],
      ]),
    ];

    await workspacesStore.closeTabGroup([deletedTab]);
    workspacesStore.handlePathsDeleted(['C:/Users/aleks/Deleted']);
    const restored = await workspacesStore.restoreLastClosedTabGroup();

    expect(restored).toBe(true);
    expect(workspacesStore.currentTabGroup?.[0]?.path).toBe('C:/Users/aleks');
  });

  it('keeps only the 20 most recent closed tab groups', async () => {
    mockDirectoryReadResponses();

    const tabGroups = Array.from({ length: 25 }, (_unused, tabNumber) => ([
      createTab(`tab-${tabNumber}`, `C:/Users/aleks/Tab-${tabNumber}`),
    ]));
    const workspacesStore = useWorkspacesStore();
    workspacesStore.workspaces = [
      createWorkspace(tabGroups),
    ];

    workspacesStore.closeOtherTabGroups(tabGroups[0]);

    expect(workspacesStore.closedTabGroupHistory).toHaveLength(20);
    expect(workspacesStore.closedTabGroupHistory[0]?.tabGroup[0]?.path).toBe('C:/Users/aleks/Tab-5');

    const restored = await workspacesStore.restoreLastClosedTabGroup();

    expect(restored).toBe(true);
    expect(workspacesStore.currentTabGroup?.[0]?.path).toBe('C:/Users/aleks/Tab-24');
    expect(workspacesStore.closedTabGroupHistory).toHaveLength(19);
  });

  it('hydrates from startup bootstrap without reading workspaces from LazyStore', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'read_dir_with_timeout') {
        return Promise.resolve({
          path: 'C:/Users/aleks/Projects',
          entries: [],
          total_count: 0,
          dir_count: 0,
          file_count: 0,
          opened_directory_times: {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
          },
        });
      }

      if (command === 'get_dir_entry_with_timeout') {
        return Promise.resolve({
          path: 'C:/Users/aleks/Projects',
        });
      }

      return Promise.resolve(null);
    });

    const workspacesStore = useWorkspacesStore();

    await workspacesStore.init({
      path: 'mock/user-workspaces.json',
      status: 'ready',
      data: {
        __schemaVersion: 1,
        currentTabGroupIndex: 0,
        workspaces: [
          createWorkspace([
            [createTab('bootstrapped-tab', 'C:/Users/aleks/Projects')],
          ]),
        ],
      },
      schemaVersion: 1,
      error: null,
    });

    expect(lazyStoreGetMock).not.toHaveBeenCalled();
    expect(workspacesStore.workspaces[0]?.tabGroups[0]?.[0]?.path).toBe('C:/Users/aleks/Projects');
    expect(invokeMock).toHaveBeenCalledWith('read_dir_with_timeout', {
      path: 'C:/Users/aleks/Projects',
      timeoutMs: 5000,
      options: {
        includeShortcutTargets: false,
        includeHardLinkCounts: false,
        includeItemCounts: false,
      },
    });
  });

  it('uses an extended read timeout for likely-slow paths such as WSL mounts', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'read_dir_with_timeout') {
        return Promise.resolve({
          path: '//wsl.localhost/Ubuntu-24.04',
          entries: [],
          total_count: 0,
          dir_count: 0,
          file_count: 0,
          opened_directory_times: {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
          },
        });
      }

      if (command === 'get_dir_entry_with_timeout') {
        return Promise.resolve({
          path: '//wsl.localhost/Ubuntu-24.04',
        });
      }

      return Promise.resolve(null);
    });

    const workspacesStore = useWorkspacesStore();

    await workspacesStore.init({
      path: 'mock/user-workspaces.json',
      status: 'ready',
      data: {
        __schemaVersion: 1,
        currentTabGroupIndex: 0,
        workspaces: [
          createWorkspace([
            [createTab('wsl-tab', '//wsl.localhost/Ubuntu-24.04')],
          ]),
        ],
      },
      schemaVersion: 1,
      error: null,
    });

    expect(invokeMock).toHaveBeenCalledWith('read_dir_with_timeout', {
      path: '//wsl.localhost/Ubuntu-24.04',
      timeoutMs: 60000,
      options: {
        includeShortcutTargets: false,
        includeHardLinkCounts: false,
        includeItemCounts: false,
      },
    });
  });

  it('warns when preloading directory entries times out', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'read_dir_with_timeout') {
        return Promise.reject(new Error('Reading directory timed out after 5000 ms'));
      }

      if (command === 'get_dir_entry_with_timeout') {
        return Promise.resolve({
          path: 'C:/Users/aleks/Projects',
        });
      }

      return Promise.resolve(null);
    });

    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const workspacesStore = useWorkspacesStore();

    await workspacesStore.init({
      path: 'mock/user-workspaces.json',
      status: 'ready',
      data: {
        __schemaVersion: 1,
        currentTabGroupIndex: 0,
        workspaces: [
          createWorkspace([
            [createTab('timed-out-tab', 'C:/Users/aleks/Projects')],
          ]),
        ],
      },
      schemaVersion: 1,
      error: null,
    });

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Failed to preload directory entries for C:/Users/aleks/Projects: Reading directory timed out after 5000 ms',
    );

    consoleWarnSpy.mockRestore();
  });

  it('uses the timeout-bounded backend command for getDirEntry when a timeout is provided', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_entry_with_timeout') {
        return Promise.resolve({ path: 'C:/Users/aleks/Projects' });
      }

      return Promise.resolve(null);
    });

    const workspacesStore = useWorkspacesStore();

    const dirEntry = await workspacesStore.getDirEntry({
      path: 'C:/Users/aleks/Projects',
      timeoutMs: 1500,
    });

    expect(dirEntry).toEqual({ path: 'C:/Users/aleks/Projects' });
    expect(invokeMock).toHaveBeenCalledWith('get_dir_entry_with_timeout', {
      path: 'C:/Users/aleks/Projects',
      timeoutMs: 1500,
    });
    expect(invokeMock).not.toHaveBeenCalledWith('get_dir_entry', expect.anything());
  });

  it('returns null when the timeout-bounded getDirEntry rejects', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_entry_with_timeout') {
        return Promise.reject(new Error('Reading path timed out after 2000 ms'));
      }

      return Promise.resolve(null);
    });

    const workspacesStore = useWorkspacesStore();

    const dirEntry = await workspacesStore.getDirEntry({
      path: 'C:/Users/aleks/Projects',
      timeoutMs: 2000,
    });

    expect(dirEntry).toBeNull();
  });
});

function createWorkspace(tabGroups: TabGroup[]): Workspace {
  return {
    id: 0,
    isPrimary: true,
    isCurrent: true,
    name: 'primary',
    actions: [],
    tabGroups,
    currentTabGroupIndex: 0,
    currentTabIndex: 0,
  };
}

function createTab(id: string, path: string): Tab {
  return {
    id,
    name: path,
    path,
    type: 'directory',
    paneWidth: 100,
    filterQuery: '',
    dirEntries: [],
    selectedDirEntries: [],
  };
}

function createDeferred<T>() {
  let resolvePromise: (value: T) => void = () => {};

  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: resolvePromise,
  };
}

function createDirContents(path: string, entryPath: string): DirContents {
  return {
    path,
    entries: [{
      name: entryPath.slice(entryPath.lastIndexOf('/') + 1),
      ext: 'txt',
      path: entryPath,
      size: 0,
      item_count: null,
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
      mime: 'text/plain',
      is_file: true,
      is_dir: false,
      is_symlink: false,
      is_hidden: false,
    }],
    total_count: 1,
    dir_count: 0,
    file_count: 1,
    opened_directory_times: {
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
    },
  };
}

function mockDirectoryReadResponses() {
  invokeMock.mockImplementation((command: string, payload?: { path?: string }) => {
    if (command === 'read_dir_with_timeout') {
      return Promise.resolve({
        path: payload?.path ?? '',
        entries: [],
        total_count: 0,
        dir_count: 0,
        file_count: 0,
        opened_directory_times: {
          modified_time: 0,
          accessed_time: 0,
          created_time: 0,
        },
      });
    }

    if (command === 'get_dir_entry_with_timeout') {
      return Promise.resolve({
        path: payload?.path ?? '',
      });
    }

    return Promise.resolve(null);
  });
}
