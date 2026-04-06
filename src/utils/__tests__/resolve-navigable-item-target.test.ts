// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn<(command: string, payload: unknown) => Promise<string | null>>(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

import {
  resolveNavigableItemTarget,
  resolveWindowsDirectoryShortcutPath,
} from '@/utils/resolve-navigable-item-target';

describe('resolveNavigableItemTarget', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns directories as navigable directory targets', async () => {
    await expect(resolveNavigableItemTarget('C:/Users/aleks/Documents', false)).resolves.toEqual({
      targetPath: 'C:/Users/aleks/Documents',
      opensAsFile: false,
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('returns regular files as file targets without invoking shortcut resolution', async () => {
    await expect(resolveNavigableItemTarget('C:/Users/aleks/file.txt', true)).resolves.toEqual({
      targetPath: 'C:/Users/aleks/file.txt',
      opensAsFile: true,
    });

    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('resolves Windows directory shortcuts to their target directory', async () => {
    invokeMock.mockResolvedValue('C:/Users/aleks/Projects');

    await expect(resolveNavigableItemTarget('C:/Users/aleks/Desktop/Projects.LNK', true)).resolves.toEqual({
      targetPath: 'C:/Users/aleks/Projects',
      opensAsFile: false,
    });

    expect(invokeMock).toHaveBeenCalledWith('resolve_windows_directory_shortcut', {
      path: 'C:/Users/aleks/Desktop/Projects.LNK',
    });
  });

  it('keeps shortcut files as file targets when they do not resolve to directories', async () => {
    invokeMock.mockResolvedValue(null);

    await expect(resolveNavigableItemTarget('C:/Users/aleks/Desktop/Notes.lnk', true)).resolves.toEqual({
      targetPath: 'C:/Users/aleks/Desktop/Notes.lnk',
      opensAsFile: true,
    });
  });
});

describe('resolveWindowsDirectoryShortcutPath', () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it('returns null when the backend shortcut resolution call fails', async () => {
    invokeMock.mockRejectedValue(new Error('failure'));

    await expect(resolveWindowsDirectoryShortcutPath('C:/Users/aleks/Desktop/Broken.lnk')).resolves.toBeNull();
  });
});
