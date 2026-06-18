// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import {
  getTopLevelNameConflicts,
  splitTopLevelSamePathSources,
} from '@/utils/top-level-name-conflicts';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

describe('getTopLevelNameConflicts', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns conflicts for existing destination child paths only', async () => {
    invokeMock.mockImplementation(async (commandName, args) => {
      const pathArgument = (args as { path?: string } | undefined)?.path;
      return commandName === 'path_exists' && pathArgument === 'C:/Target/images';
    });

    await expect(getTopLevelNameConflicts([
      'C:/Source/images',
      'C:/Source/readme.txt',
    ], 'C:/Target')).resolves.toEqual([
      {
        sourcePath: 'C:/Source/images',
        destinationPath: 'C:/Target/images',
        name: 'images',
      },
    ]);

    expect(invokeMock).toHaveBeenCalledWith('path_exists', {
      path: 'C:/Target/images',
    });
    expect(invokeMock).toHaveBeenCalledWith('path_exists', {
      path: 'C:/Target/readme.txt',
    });
  });

  it('handles root destinations without adding a duplicate separator', async () => {
    invokeMock.mockResolvedValue(true);

    await expect(getTopLevelNameConflicts(['/tmp/file.txt'], '/')).resolves.toEqual([
      {
        sourcePath: '/tmp/file.txt',
        destinationPath: '/file.txt',
        name: 'file.txt',
      },
    ]);
  });
});

describe('splitTopLevelSamePathSources', () => {
  it('separates sources whose destination child path is the source path', () => {
    expect(splitTopLevelSamePathSources([
      'C:/example',
      'D:/other/example',
      'C:/file.txt',
    ], 'C:/')).toEqual({
      samePathSourcePaths: [
        'C:/example',
        'C:/file.txt',
      ],
      remainingSourcePaths: [
        'D:/other/example',
      ],
    });
  });

  it('does not treat same-name items from another directory as same-path items', () => {
    expect(splitTopLevelSamePathSources([
      'C:/source/images',
    ], 'C:/target')).toEqual({
      samePathSourcePaths: [],
      remainingSourcePaths: [
        'C:/source/images',
      ],
    });
  });
});
