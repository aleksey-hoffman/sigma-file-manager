// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { effectScope, ref, type EffectScope } from 'vue';
import { flushPromises } from '@vue/test-utils';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { DIR_WATCHER_DEBOUNCE_MS, type DirChangePayload } from '@/modules/navigator/constants/dir-watcher';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

const {
  directoryEntriesByPath,
  resolveDirectoryContentsMock,
  dirChangeHandlers,
} = vi.hoisted(() => ({
  directoryEntriesByPath: new Map<string, DirEntry[]>(),
  resolveDirectoryContentsMock: vi.fn(),
  dirChangeHandlers: [] as Array<(event: { payload: DirChangePayload }) => void>,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async (_eventName: string, handler: (event: { payload: DirChangePayload }) => void) => {
    dirChangeHandlers.push(handler);
    return vi.fn();
  }),
}));

vi.mock('@/utils/virtual-locations', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/utils/virtual-locations')>();

  return {
    ...original,
    resolveDirectoryContents: resolveDirectoryContentsMock,
  };
});

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => ({ currentPlatform: 'linux' }),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: {
        showHiddenFiles: false,
        folderSettings: {},
      },
    },
  }),
}));

vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => ({
    tags: [],
    taggedItems: [],
  }),
}));

vi.mock('@/modules/navigator/utils/resolve-navigator-folder-settings', () => ({
  resolveNavigatorFolderSettings: () => ({
    layout: 'list',
    showHiddenFiles: false,
  }),
}));

vi.mock('@/modules/navigator/components/file-browser/utils/file-browser-sort-columns', () => ({
  getNavigatorSortSettingsForLayout: () => ({
    column: 'name',
    direction: 'asc',
  }),
}));

import { useDirectoryTree } from '../use-directory-tree';

function createDirectory(path: string): DirEntry {
  return {
    name: path.split('/').filter(Boolean).pop() ?? path,
    path,
    ext: null,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
  };
}

function getChildNames(tree: ReturnType<typeof useDirectoryTree>, path: string): string[] | undefined {
  return tree.getChildren(path)?.map(entry => entry.name);
}

function readPaths(): string[] {
  return resolveDirectoryContentsMock.mock.calls.map(([path]) => path);
}

function deferRead(path: string): { resolve: (entries: DirEntry[]) => void } {
  let resolveRead: (value: { entries: DirEntry[] }) => void = () => {};

  const fallbackImplementation = resolveDirectoryContentsMock.getMockImplementation();

  resolveDirectoryContentsMock.mockImplementation((requestedPath: string, ...rest: unknown[]) => {
    if (requestedPath !== path) {
      return fallbackImplementation?.(requestedPath, ...rest);
    }

    resolveDirectoryContentsMock.mockImplementation(fallbackImplementation ?? (async () => ({ entries: [] })));
    return new Promise((resolve) => {
      resolveRead = resolve;
    });
  });

  return {
    resolve: entries => resolveRead({ entries }),
  };
}

describe('useDirectoryTree', () => {
  let scope: EffectScope;
  const activePath = ref('/home');
  const updatesPaused = ref(false);

  function createTree() {
    scope = effectScope();
    const tree = scope.run(() => useDirectoryTree({
      activePath: () => activePath.value,
      areUpdatesPaused: () => updatesPaused.value,
    }));

    if (!tree) {
      throw new Error('Directory tree was not created');
    }

    return tree;
  }

  beforeEach(() => {
    activePath.value = '/home';
    updatesPaused.value = false;
    dirChangeHandlers.length = 0;
    directoryEntriesByPath.clear();
    directoryEntriesByPath.set(LOCATIONS_VIRTUAL_PATH, [createDirectory('/')]);
    directoryEntriesByPath.set('/', [createDirectory('/home'), createDirectory('/etc')]);
    directoryEntriesByPath.set('/home', [createDirectory('/home/user')]);
    resolveDirectoryContentsMock.mockReset().mockImplementation(async (path: string) => ({
      entries: directoryEntriesByPath.get(path) ?? [],
    }));
  });

  afterEach(() => {
    scope.stop();
    vi.useRealTimers();
  });

  it('expands the ancestors of the active path without reading the collapsed active directory', async () => {
    const tree = createTree();
    await flushPromises();

    expect(tree.isExpanded(LOCATIONS_VIRTUAL_PATH)).toBe(true);
    expect(tree.isExpanded('/')).toBe(true);
    expect(tree.isExpanded('/home')).toBe(false);
    expect(getChildNames(tree, '/')).toEqual(['etc', 'home']);
    expect(getChildNames(tree, '/home')).toBeUndefined();
    expect(readPaths()).not.toContain('/home');
    expect(resolveDirectoryContentsMock).toHaveBeenCalledWith('/', expect.objectContaining({ directoriesOnly: true }));
    expect(tree.revealVersion.value).toBe(1);
  });

  it('reads the active directory once it is expanded', async () => {
    const tree = createTree();
    await flushPromises();

    tree.setExpanded('/home', true);
    await flushPromises();

    expect(getChildNames(tree, '/home')).toEqual(['user']);
  });

  it('shows cached children at once and refreshes them when a directory is expanded again', async () => {
    directoryEntriesByPath.set('/etc', [createDirectory('/etc/nginx')]);
    const tree = createTree();
    await flushPromises();
    tree.setExpanded('/etc', true);
    await flushPromises();
    tree.setExpanded('/etc', false);

    const pendingRead = deferRead('/etc');
    tree.setExpanded('/etc', true);

    expect(getChildNames(tree, '/etc')).toEqual(['nginx']);

    pendingRead.resolve([createDirectory('/etc/nginx'), createDirectory('/etc/apache')]);
    await flushPromises();

    expect(getChildNames(tree, '/etc')).toEqual(['apache', 'nginx']);
  });

  it('discards a reveal that finishes after navigating to another directory', async () => {
    directoryEntriesByPath.set('/', [createDirectory('/etc'), createDirectory('/srv')]);
    directoryEntriesByPath.set('/srv', [createDirectory('/srv/data')]);
    const tree = createTree();
    await flushPromises();

    const pendingRead = deferRead('/etc');
    activePath.value = '/etc/nginx';
    await flushPromises();
    activePath.value = '/srv/data';
    await flushPromises();

    expect(tree.isExpanded('/srv')).toBe(true);

    pendingRead.resolve([createDirectory('/etc/nginx')]);
    await flushPromises();

    expect(tree.isExpanded('/etc')).toBe(false);
    expect(getChildNames(tree, '/etc')).toBeUndefined();
    expect(tree.isExpanded('/srv')).toBe(true);
  });

  it('publishes the first content while paused, then holds later updates until resumed', async () => {
    updatesPaused.value = true;
    const tree = createTree();
    await flushPromises();

    expect(getChildNames(tree, '/')).toEqual(['etc', 'home']);

    activePath.value = '/home/user';
    await flushPromises();

    expect(tree.isExpanded('/home')).toBe(false);
    expect(tree.revealVersion.value).toBe(1);

    updatesPaused.value = false;
    await flushPromises();

    expect(tree.isExpanded('/home')).toBe(true);
    expect(tree.revealVersion.value).toBe(2);
  });

  it('loads children when a directory is expanded and hides them when collapsed', async () => {
    directoryEntriesByPath.set('/etc', [createDirectory('/etc/nginx')]);
    const tree = createTree();
    await flushPromises();

    tree.toggleExpanded('/etc');
    await flushPromises();

    expect(tree.isExpanded('/etc')).toBe(true);
    expect(getChildNames(tree, '/etc')).toEqual(['nginx']);

    tree.setExpanded('/etc', false);

    expect(tree.isExpanded('/etc')).toBe(false);
  });

  it('reloads a cached directory after a directory change event', async () => {
    vi.useFakeTimers();
    activePath.value = '/home/user';
    const tree = createTree();
    await flushPromises();

    directoryEntriesByPath.set('/home', [createDirectory('/home/user'), createDirectory('/home/guest')]);
    dirChangeHandlers.forEach(handler => handler({
      payload: {
        watchedPath: '/home',
        changedPath: '/home/guest',
        kind: 'create',
      },
    }));
    await vi.advanceTimersByTimeAsync(DIR_WATCHER_DEBOUNCE_MS);
    await flushPromises();

    expect(getChildNames(tree, '/home')).toEqual(['guest', 'user']);
  });

  it('ignores directory change events for directories it has not loaded', async () => {
    vi.useFakeTimers();
    createTree();
    await flushPromises();
    resolveDirectoryContentsMock.mockClear();

    dirChangeHandlers.forEach(handler => handler({
      payload: {
        watchedPath: '/srv',
        changedPath: '/srv/data',
        kind: 'create',
      },
    }));
    await vi.advanceTimersByTimeAsync(DIR_WATCHER_DEBOUNCE_MS);

    expect(resolveDirectoryContentsMock).not.toHaveBeenCalled();
  });

  it('drops an older read that finishes after a newer read of the same directory', async () => {
    activePath.value = '/home/user';
    const tree = createTree();
    await flushPromises();

    let resolveOlderRead: (value: { entries: DirEntry[] }) => void = () => {};

    resolveDirectoryContentsMock.mockImplementationOnce(() => new Promise((resolve) => {
      resolveOlderRead = resolve;
    }));
    tree.refreshDirectory('/home');

    directoryEntriesByPath.set('/home', [createDirectory('/home/newer')]);
    tree.refreshDirectory('/home');
    await flushPromises();

    resolveOlderRead({ entries: [createDirectory('/home/older')] });
    await flushPromises();

    expect(getChildNames(tree, '/home')).toEqual(['newer']);
  });
});
