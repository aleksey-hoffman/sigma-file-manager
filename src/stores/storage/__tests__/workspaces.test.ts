// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
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
      appUserDataWorkspacesPath: 'mock/workspaces.json',
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

  it('closes duplicate single-tab groups for matching Windows paths and keeps the requested tab', async () => {
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

    await workspacesStore.closeDuplicatePathTabs(keepTab.id);

    expect(workspacesStore.currentWorkspace?.tabGroups).toEqual([
      [keepTab],
      [splitLeftTab, splitRightTab],
      [uniqueTab],
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

    await workspacesStore.closeDuplicatePathTabs(lowerCaseTab.id);

    expect(workspacesStore.currentWorkspace?.tabGroups).toEqual([
      [lowerCaseTab],
      [upperCaseTab],
    ]);
  });

  it('hydrates from startup bootstrap without reading workspaces from LazyStore', async () => {
    invokeMock.mockImplementation((command: string) => {
      if (command === 'get_dir_entries') {
        return Promise.resolve([]);
      }

      if (command === 'get_dir_entry') {
        return Promise.resolve({
          path: 'C:/Users/aleks/Projects',
        });
      }

      return Promise.resolve(null);
    });

    const workspacesStore = useWorkspacesStore();

    await workspacesStore.init({
      path: 'mock/workspaces.json',
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
    expect(invokeMock).toHaveBeenCalledWith('get_dir_entries', { path: 'C:/Users/aleks/Projects' });
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
