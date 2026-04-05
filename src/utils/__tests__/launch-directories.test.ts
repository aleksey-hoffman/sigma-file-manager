// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getLaunchDirectoryCandidates,
  resolveLaunchTargetsFromArgs,
  type LaunchContext,
} from '@/utils/launch-directories';

function createDirEntry(path: string, overrides?: Partial<DirEntry>): DirEntry {
  return {
    name: path.split(/[\\/]/).pop() ?? path,
    ext: null,
    path,
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
    ...overrides,
  };
}

describe('launch-directories', () => {
  function createLaunchContext(overrides?: Partial<LaunchContext>): LaunchContext {
    return {
      args: ['C:/Apps/Sigma File Manager.exe'],
      cwd: null,
      executableDir: 'C:/Apps',
      hadAbsorbedShellPaths: false,
      hadDelegatedShellPaths: false,
      ...overrides,
    };
  }

  it('filters out executable paths, flags, empty values, and duplicates', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:/Users/aleks/Documents',
        '',
        '   ',
        '--sigma-autostart',
        'C:/Users/aleks/Documents',
        'C:/Users/aleks/Pictures',
      ],
    }))).toEqual([
      'C:/Users/aleks/Documents',
      'C:/Users/aleks/Pictures',
    ]);
  });

  it('deduplicates Windows paths without regard to case', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:/Users/aleks/Documents',
        'c:/users/aleks/documents',
      ],
    }))).toEqual([
      'C:/Users/aleks/Documents',
    ]);
  });

  it('normalizes bare Windows drive roots from args', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:',
      ],
    }))).toEqual([
      'C:/',
    ]);
  });

  it('normalizes quoted Windows drive roots from args', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:"',
      ],
    }))).toEqual([
      'C:/',
    ]);
  });

  it('normalizes fully quoted paths from args', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        '"C:/Users/aleks/Documents"',
      ],
    }))).toEqual([
      'C:/Users/aleks/Documents',
    ]);
  });

  it('preserves apostrophes in path names', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:/Users/O\'Connor/Documents',
      ],
    }))).toEqual([
      'C:/Users/O\'Connor/Documents',
    ]);
  });

  it('falls back to cwd for absorbed shell launches without path arguments', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      cwd: 'C:/Users/aleks/Documents',
      hadAbsorbedShellPaths: true,
    }))).toEqual([
      'C:/Users/aleks/Documents',
    ]);
  });

  it('does not fall back to cwd during regular startup without absorbed shell paths', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      cwd: 'C:/Users/aleks/Documents',
    }))).toEqual([]);
  });

  it('normalizes cwd fallback paths before returning them', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      cwd: 'C:\\Users\\aleks\\Documents',
      hadAbsorbedShellPaths: true,
    }))).toEqual([
      'C:/Users/aleks/Documents',
    ]);
  });

  it('does not fall back to cwd when cwd matches the executable directory', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      cwd: 'C:/Apps',
      hadAbsorbedShellPaths: true,
    }))).toEqual([]);
  });

  it('does not fall back to Windows shell cwd paths', () => {
    expect(getLaunchDirectoryCandidates(createLaunchContext({
      cwd: 'C:/Windows/System32',
      executableDir: 'C:/Program Files/Sigma File Manager',
      hadAbsorbedShellPaths: true,
    }))).toEqual([]);
  });

  it('keeps only resolved directory entries', async () => {
    const getDirEntry = vi.fn(async (path: string): Promise<DirEntry | null> => {
      if (path === 'C:/Users/aleks/Documents') {
        return createDirEntry(path);
      }

      if (path === 'C:/Users/aleks/file.txt') {
        return createDirEntry(path, {
          is_dir: false,
          is_file: true,
        });
      }

      return null;
    });

    await expect(resolveLaunchTargetsFromArgs(createLaunchContext({
      args: [
        'C:/Apps/Sigma File Manager.exe',
        'C:/Users/aleks/Documents',
        'C:/Users/aleks/file.txt',
        '--sigma-autostart',
        'C:/Users/aleks/missing',
      ],
    }), getDirEntry)).resolves.toEqual([
      {
        directoryPath: 'C:/Users/aleks/Documents',
        focusPath: null,
      },
      {
        directoryPath: 'C:/Users/aleks',
        focusPath: 'C:/Users/aleks/file.txt',
      },
    ]);
  });
});
