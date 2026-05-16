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
  createUserDirectoriesSuggestionGroup,
  ensureAddressBarDirectoryQuery,
  getAddressBarRevealTarget,
  resolveAddressBarSuggestions,
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
    expect(state.groups[0].items.map(item => item.path)).toEqual(['C:/Windows']);
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
    expect(state.groups[0].items.map(item => item.path)).toEqual([
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
    expect(getDirEntry).not.toHaveBeenCalled();
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
});
