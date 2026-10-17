// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import type { DriveInfo } from '@/types/drive-info';
import {
  addressBarPathHasNoParentDirectory,
  addressBarTrimmedQueryLooksLikeFilesystemPath,
  createRecentSuggestionGroup,
  createTaggedSuggestionGroups,
  createSystemDrivesSuggestionGroup,
  createTargetDirectorySuggestionGroup,
  createUserDirectoriesSuggestionGroup,
  ensureAddressBarDirectoryQuery,
  getAddressBarRevealTarget,
  orderDirectoryEntriesForSuggestionList,
  resolveAddressBarSuggestions,
  resolveAddressBarTypedTarget,
} from '../address-bar-editor-utils';

function entry(path: string, options?: {
  isFile?: boolean;
  name?: string;
}): DirEntry {
  const isFile = options?.isFile ?? false;
  const pathSegments = path.split('/').filter(Boolean);
  const name = options?.name ?? pathSegments[pathSegments.length - 1] ?? path;

  return {
    name,
    path,
    is_file: isFile,
    is_dir: !isFile,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: isFile ? null : 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: isFile && name.includes('.') ? name.split('.').pop() ?? null : null,
    mime: null,
  };
}

function dirContents(path: string, entries: DirEntry[]): DirContents {
  return {
    path,
    entries,
    total_count: entries.length,
    dir_count: entries.filter(item => item.is_dir).length,
    file_count: entries.filter(item => item.is_file).length,
    opened_directory_times: {
      created_time: 0,
      modified_time: 0,
      accessed_time: 0,
    },
  };
}

function searchMatcher(query: string): (entryItem: DirEntry) => boolean {
  const normalizedQuery = query.toLowerCase();
  return entryItem => entryItem.name.toLowerCase().includes(normalizedQuery);
}

describe('address bar path parent detection', () => {
  it('treats windows drive letter roots as having no parent', () => {
    expect(addressBarPathHasNoParentDirectory('C:/')).toBe(true);
    expect(addressBarPathHasNoParentDirectory('C:')).toBe(true);
    expect(addressBarPathHasNoParentDirectory('D:/')).toBe(true);
  });

  it('treats posix root as having no parent', () => {
    expect(addressBarPathHasNoParentDirectory('/')).toBe(true);
  });

  it('reports false when a filesystem parent exists', () => {
    expect(addressBarPathHasNoParentDirectory('/srv')).toBe(false);
    expect(addressBarPathHasNoParentDirectory('/workspace/src')).toBe(false);
    expect(addressBarPathHasNoParentDirectory('C:/Windows')).toBe(false);
  });

  it('reports false for an empty query string', () => {
    expect(addressBarPathHasNoParentDirectory('')).toBe(false);
  });
});

describe('addressBarTrimmedQueryLooksLikeFilesystemPath', () => {
  it('returns false for plain search tokens', () => {
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('Downloads')).toBe(false);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('down')).toBe(false);
  });

  it('returns true when path-shaped', () => {
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('C:/Users')).toBe(true);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('C:\\Users')).toBe(true);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('/workspace/src')).toBe(true);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('//wsl.localhost/Ubuntu')).toBe(true);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('relative/sub')).toBe(true);
    expect(addressBarTrimmedQueryLooksLikeFilesystemPath('C:')).toBe(true);
  });
});

describe('address bar editor utils', () => {
  it('lists a Windows drive root using a trailing separator path, not a bare drive letter', async () => {
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === 'C:/') {
        return dirContents('C:/', [
          entry('C:/Windows'),
        ]);
      }

      throw new Error('unexpected readDir path');
    });

    const state = await resolveAddressBarSuggestions({
      query: 'C:/',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('directory');
    expect(readDir).toHaveBeenCalledWith('C:/');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['C:/']);
    expect(state.groups[1].items.map(item => item.path)).toEqual(['C:/Windows']);
  });

  it('lists a WSL UNC directory when the path has no trailing separator', async () => {
    const distroContents = [
      entry('//wsl.localhost/Ubuntu-24.04/home'),
    ];
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === '//wsl.localhost/Ubuntu-24.04/') {
        return dirContents('//wsl.localhost/Ubuntu-24.04', distroContents);
      }

      throw new Error('unexpected readDir path');
    });

    const state = await resolveAddressBarSuggestions({
      query: '//wsl.localhost/Ubuntu-24.04',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('directory');
    expect(readDir).toHaveBeenCalledWith('//wsl.localhost/Ubuntu-24.04/');
    expect(state.groups[0].items.map(item => item.path)).toEqual([
      '//wsl.localhost/Ubuntu-24.04',
    ]);
    expect(state.groups[1].items.map(item => item.path)).toEqual([
      '//wsl.localhost/Ubuntu-24.04/home',
    ]);
  });

  it('does not substitute current directory listings when a UNC parent listing fails', async () => {
    const readDir = vi.fn().mockRejectedValue(new Error('missing'));

    const state = await resolveAddressBarSuggestions({
      query: '//wsl.localhost/Ubuntu-24.04/missing',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn().mockRejectedValue(new Error('missing')),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
    expect(readDir.mock.calls.every(call => call[0] !== '/workspace')).toBe(true);
    expect(state.groups[0].items).toHaveLength(0);
  });

  it('returns directory entries when the path ends with a directory separator', async () => {
    const childEntries = [
      entry('/workspace/src'),
      entry('/workspace/readme.md', {
        isFile: true,
        name: 'readme.md',
      }),
    ];
    const readDir = vi.fn().mockResolvedValue(dirContents('/workspace', childEntries));
    const getDirEntry = vi.fn();

    const state = await resolveAddressBarSuggestions({
      query: '/workspace/',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry,
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('directory');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['/workspace']);
    expect(state.groups[1].items.map(item => item.path)).toEqual([
      '/workspace/src',
      '/workspace/readme.md',
    ]);
    expect(getDirEntry).not.toHaveBeenCalled();
  });

  it('filters parent entries when the typed path matches a directory name without a trailing separator', async () => {
    const parentEntries = [
      entry('/workspace/test', { name: 'test' }),
      entry('/workspace/test.txt', {
        isFile: true,
        name: 'test.txt',
      }),
    ];
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === '/workspace') {
        return dirContents('/workspace', parentEntries);
      }

      throw new Error('missing');
    });

    const state = await resolveAddressBarSuggestions({
      query: '/workspace/test',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
    expect(readDir).toHaveBeenCalledWith('/workspace');
    expect(state.groups[0].items.map(item => item.path)).toEqual([
      '/workspace/test',
      '/workspace/test.txt',
    ]);
  });

  it('filters to a concrete file entry when its full path is typed without a trailing separator', async () => {
    const fileEntry = entry('/workspace/readme.md', {
      isFile: true,
      name: 'readme.md',
    });
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === '/workspace') {
        return dirContents('/workspace', [fileEntry]);
      }

      throw new Error('not a directory');
    });
    const getDirEntry = vi.fn();

    const state = await resolveAddressBarSuggestions({
      query: '/workspace/readme.md',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry,
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
    expect(readDir).toHaveBeenCalledWith('/workspace');
    // 无结尾斜杠的绝对路径现在会先被当作目录探测一次，探测落空才回落搜索。
    expect(getDirEntry).toHaveBeenCalledWith('/workspace/readme.md');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['/workspace/readme.md']);
    expect(state.groups[0].items[0].isFile).toBe(true);
  });

  it('quick-searches parent directory entries when the typed path does not exist', async () => {
    const parentEntries = [
      entry('/workspace/report.txt', {
        isFile: true,
        name: 'report.txt',
      }),
      entry('/workspace/photos'),
    ];
    const readDir = vi.fn(async (path: string) => {
      if (path === '/workspace') {
        return dirContents('/workspace', parentEntries);
      }

      throw new Error('missing');
    });
    const getDirEntry = vi.fn().mockRejectedValue(new Error('missing'));

    const state = await resolveAddressBarSuggestions({
      query: '/workspace/rep',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry,
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['/workspace/report.txt']);
  });

  it('builds a system drives suggestion group from DriveInfo payloads', () => {
    const drivePayloads: DriveInfo[] = [
      {
        name: 'Disk C',
        path: 'C:\\',
        mount_point: 'C:',
        file_system: 'NTFS',
        drive_type: 'Fixed',
        total_space: 1,
        available_space: 1,
        used_space: 0,
        percent_used: 0,
        is_removable: false,
        is_read_only: false,
        is_mounted: true,
        device_path: '',
      },
      {
        name: 'Ubuntu',
        path: '//wsl.localhost/Ubuntu',
        mount_point: '',
        file_system: '',
        drive_type: 'WSL',
        total_space: 0,
        available_space: 0,
        used_space: 0,
        percent_used: 0,
        is_removable: false,
        is_read_only: false,
        is_mounted: true,
        device_path: '',
      },
    ];

    const group = createSystemDrivesSuggestionGroup(drivePayloads, 'Drives');

    expect(group.id).toBe('systemDrives');
    expect(group.items.map(item => item.name)).toEqual(['Disk C', 'Ubuntu']);
    expect(group.items.every(item => item.source === 'systemDrive')).toBe(true);
    expect(group.items.every(item => item.isDirectory)).toBe(true);
  });

  it('builds a user directories suggestion group with display names', () => {
    const group = createUserDirectoriesSuggestionGroup(
      [
        {
          path: '/home/user/docs',
          displayName: 'Documents',
        },
        {
          path: '/media/usb',
          displayName: 'USB',
        },
      ],
      'User locations',
    );

    expect(group.id).toBe('userDirectories');
    expect(group.items.map(item => item.name)).toEqual(['Documents', 'USB']);
    expect(group.items.map(item => item.path)).toEqual(['/home/user/docs', '/media/usb']);
    expect(group.items.every(item => item.isDirectory)).toBe(true);
    expect(group.items.every(item => item.source === 'userDirectory')).toBe(true);
  });

  it('returns recent and tagged groups for empty entry mode input', async () => {
    const recentGroup = createRecentSuggestionGroup([
      {
        path: '/workspace/recent.txt',
        openedAt: 1,
        isFile: true,
      },
    ], 'Recent', 10);
    expect(recentGroup.items[0]?.historyOpenedAt).toBe(1);
    const taggedGroups = createTaggedSuggestionGroups([
      {
        path: '/workspace/tagged',
        tagIds: ['tag-work'],
        addedAt: 1,
        isFile: false,
      },
    ], [
      {
        id: 'tag-work',
        name: 'Work',
        color: '#3b82f6',
      },
    ], 'Unknown tag');

    const state = await resolveAddressBarSuggestions({
      query: '',
      mode: 'entry',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [recentGroup, ...taggedGroups],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn(),
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('empty');
    expect(state.groups.map(group => group.id)).toEqual(['recent', 'tag:tag-work']);
    expect(state.groups.flatMap(group => group.items).map(item => item.path)).toEqual([
      '/workspace/recent.txt',
      '/workspace/tagged',
    ]);
  });

  it('deduplicates entry-mode search results that share the same normalized path', async () => {
    const sharedDownloadsPath = '/home/user/Downloads';
    const recentGroup = createRecentSuggestionGroup([
      {
        path: sharedDownloadsPath,
        openedAt: 1,
        isFile: false,
      },
    ], 'Recent', 10);
    const userDirsGroup = createUserDirectoriesSuggestionGroup(
      [{
        path: sharedDownloadsPath,
        displayName: 'Downloads',
      }],
      'Locations',
    );

    const state = await resolveAddressBarSuggestions({
      query: 'down',
      mode: 'entry',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [recentGroup, userDirsGroup],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn(),
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
    expect(state.groups[0].items.map(item => item.path)).toEqual([sharedDownloadsPath]);
  });

  it('builds expansion and reveal targets', () => {
    expect(ensureAddressBarDirectoryQuery('/workspace/src')).toBe('/workspace/src/');
    expect(ensureAddressBarDirectoryQuery('/workspace/src/')).toBe('/workspace/src/');
    expect(getAddressBarRevealTarget('/workspace/src/file.txt')).toEqual({
      parentPath: '/workspace/src',
      entryPath: '/workspace/src/file.txt',
    });
  });

  it('browses a typed absolute directory path without a trailing separator', async () => {
    const readDir = vi.fn(async (pathArg: string) => {
      if (pathArg === 'F:/soft/00selfmade/filemanager/sigma-file-manager') {
        return dirContents('F:/soft/00selfmade/filemanager/sigma-file-manager', [
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/src'),
        ]);
      }

      throw new Error('unexpected readDir path');
    });

    const state = await resolveAddressBarSuggestions({
      query: 'F:/soft/00selfmade/filemanager/sigma-file-manager',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('directory');
    expect(readDir).toHaveBeenCalledWith('F:/soft/00selfmade/filemanager/sigma-file-manager');
    expect(state.directoryPath).toBe('F:/soft/00selfmade/filemanager/sigma-file-manager');
  });

  it('keeps a bare name as a search term rather than a directory path', async () => {
    const state = await resolveAddressBarSuggestions({
      query: 'nsis',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn().mockRejectedValue(new Error('missing')),
        getDirEntry: vi.fn().mockRejectedValue(new Error('missing')),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
  });

  it('survives a lookup that resolves to undefined instead of throwing', async () => {
    const state = await resolveAddressBarSuggestions({
      query: '/workspace/gone',
      mode: 'path',
      currentPath: '/workspace',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir: vi.fn().mockRejectedValue(new Error('missing')),
        getDirEntry: vi.fn().mockResolvedValue(undefined),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.kind).toBe('search');
  });

  it('resolves a typed directory path into a navigate target', async () => {
    const target = await resolveAddressBarTypedTarget(
      'F:/soft/00selfmade/filemanager/sigma-file-manager/src/',
      {
        readDir: vi.fn(),
        getDirEntry: vi.fn().mockResolvedValue(
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/src'),
        ),
      },
    );

    expect(target).toEqual({
      kind: 'directory',
      path: 'F:/soft/00selfmade/filemanager/sigma-file-manager/src',
    });
  });

  it('resolves a typed file path into an open target', async () => {
    const target = await resolveAddressBarTypedTarget(
      'F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md',
      {
        readDir: vi.fn(),
        getDirEntry: vi.fn().mockResolvedValue(
          entry('F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md', {
            isFile: true,
            name: 'readme.md',
          }),
        ),
      },
    );

    expect(target).toEqual({
      kind: 'file',
      path: 'F:/soft/00selfmade/filemanager/sigma-file-manager/readme.md',
    });
  });

  it('reports no target for an empty or unresolvable query', async () => {
    await expect(resolveAddressBarTypedTarget('', {
      readDir: vi.fn(),
      getDirEntry: vi.fn(),
    })).resolves.toEqual({ kind: 'none' });

    await expect(resolveAddressBarTypedTarget('F:/nowhere', {
      readDir: vi.fn(),
      getDirEntry: vi.fn().mockRejectedValue(new Error('missing')),
    })).resolves.toEqual({ kind: 'none' });
  });

  it('puts the target directory first, then subdirectories, then files', async () => {
    const readDir = vi.fn().mockResolvedValue(dirContents('F:/target', [
      entry('F:/target/zeta.txt', {
        isFile: true,
        name: 'zeta.txt',
      }),
      entry('F:/target/beta'),
      entry('F:/target/alpha'),
      entry('F:/target/beta.txt', {
        isFile: true,
        name: 'beta.txt',
      }),
    ]));

    const state = await resolveAddressBarSuggestions({
      query: 'F:/target/',
      mode: 'path',
      currentPath: 'C:/Folder',
      directoryGroupLabel: 'Directory entries',
      exactGroupLabel: 'Exact match',
      resultsGroupLabel: 'Results',
      entryModeGroups: [],
      lastDirectoryEntries: [],
      lookup: {
        readDir,
        getDirEntry: vi.fn(),
      },
      createSearchMatcher: searchMatcher,
    });

    expect(state.groups[0].id).toBe('targetDirectory');
    expect(state.groups[0].items.map(item => item.path)).toEqual(['F:/target']);
    expect(state.groups[0].items[0].depth).toBe(0);

    expect(state.groups[1].items.map(item => item.path)).toEqual([
      'F:/target/alpha',
      'F:/target/beta',
      'F:/target/beta.txt',
      'F:/target/zeta.txt',
    ]);
    // 子目录与文件齐平缩进一格，靠图标而不是缩进区分两者。
    expect(state.groups[1].items.map(item => item.depth)).toEqual([1, 1, 1, 1]);
  });

  it('builds a target group that holds exactly the directory itself', () => {
    const group = createTargetDirectorySuggestionGroup('F:/target');

    expect(group.id).toBe('targetDirectory');
    expect(group.label).toBe('');
    expect(group.collapsible).toBe(false);
    expect(group.items).toHaveLength(1);
    expect(group.items[0].path).toBe('F:/target');
    expect(group.items[0].isDirectory).toBe(true);
  });

  it('orders subdirectories before files and sorts each bucket by name', () => {
    const ordered = orderDirectoryEntriesForSuggestionList([
      entry('F:/target/b.txt', {
        isFile: true,
        name: 'b.txt',
      }),
      entry('F:/target/z'),
      entry('F:/target/a'),
      entry('F:/target/a.txt', {
        isFile: true,
        name: 'a.txt',
      }),
    ]);

    expect(ordered.map(item => item.name)).toEqual(['a', 'z', 'a.txt', 'b.txt']);
  });
});
