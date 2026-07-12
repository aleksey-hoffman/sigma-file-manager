// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  applyBackgroundContextMenu,
  createBackgroundContextMenuState,
  createCurrentDirectoryContextMenuEntry,
} from '../file-browser-background-context-menu';

describe('file-browser-background-context-menu', () => {
  it('builds a directory entry for the current path', () => {
    expect(createCurrentDirectoryContextMenuEntry('/tmp/photos')).toMatchObject({
      name: 'photos',
      path: '/tmp/photos',
      is_dir: true,
      is_file: false,
    });
  });

  it('clears file selection and opens the directory context menu', () => {
    const clearFileSelection = vi.fn();
    const contextMenu = applyBackgroundContextMenu({
      clearFileSelection,
      currentPath: '/tmp/photos',
    });

    expect(clearFileSelection).toHaveBeenCalledOnce();
    expect(contextMenu).toEqual(createBackgroundContextMenuState('/tmp/photos'));
    expect(contextMenu.selectedEntries).toEqual([
      expect.objectContaining({
        path: '/tmp/photos',
        is_dir: true,
      }),
    ]);
    expect(contextMenu.targetEntry?.path).toBe('/tmp/photos');
  });
});
