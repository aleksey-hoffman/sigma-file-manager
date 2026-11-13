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
import type { DirEntry } from '@/types/dir-entry';
import { useOpenCopiedPath } from '../use-open-copied-path';

const invokeMock = vi.hoisted(() => vi.fn());
const userPathsMock = vi.hoisted(() => ({
  homeDir: '/home/user',
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    error: vi.fn(),
  },
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    userPaths: userPathsMock,
  }),
}));

function directoryEntry(path: string): DirEntry {
  return {
    name: 'Desktop',
    ext: null,
    path,
    size: 0,
    item_count: 0,
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

describe('useOpenCopiedPath', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    userPathsMock.homeDir = '/home/user';
  });

  it('expands a quoted tilde path with the current home directory', async () => {
    const openDirectory = vi.fn();
    const openFile = vi.fn();
    const clipboardPath = '"~/Desktop"';

    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        readText: vi.fn().mockResolvedValue(clipboardPath),
      },
    });
    invokeMock.mockResolvedValue(directoryEntry('/home/user/Desktop'));

    const { openCopiedPath } = useOpenCopiedPath({
      openDirectory,
      openFile,
    });
    const opened = await openCopiedPath();

    expect(opened).toBe(true);
    expect(invokeMock).toHaveBeenCalledWith('get_dir_entry_with_timeout', {
      path: '/home/user/Desktop',
      timeoutMs: 750,
    });
    expect(openDirectory).toHaveBeenCalledWith('/home/user/Desktop');
    expect(openFile).not.toHaveBeenCalled();
  });
});
