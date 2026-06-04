// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { getAvailableLinkCreationOptions } from '@/utils/link-operations';

function createEntry(overrides: Partial<DirEntry>): DirEntry {
  return {
    name: 'item',
    ext: null,
    path: '/item',
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

function optionKinds(entries: DirEntry[], platform: 'windows' | 'macos' | 'linux') {
  return getAvailableLinkCreationOptions(entries, platform).map(option => option.kind);
}

function optionLabelKeys(entries: DirEntry[], platform: 'windows' | 'macos' | 'linux') {
  return getAvailableLinkCreationOptions(entries, platform).map(option => option.labelKey);
}

describe('getAvailableLinkCreationOptions', () => {
  it('returns no options for an empty selection', () => {
    expect(optionKinds([], 'windows')).toEqual([]);
  });

  it('allows hardlinks for file-only selections', () => {
    expect(optionKinds([
      createEntry({
        name: 'a.txt',
        path: '/a.txt',
      }),
      createEntry({
        name: 'b.txt',
        path: '/b.txt',
      }),
    ], 'linux')).toEqual(['shortcut', 'symlink', 'hardlink']);
  });

  it('uses platform-specific shortcut labels', () => {
    const entries = [
      createEntry({
        name: 'a.txt',
        path: '/a.txt',
      }),
    ];

    expect(optionLabelKeys(entries, 'windows')[0]).toBe('fileBrowser.linkTypes.shortcutWindows');
    expect(optionLabelKeys(entries, 'macos')[0]).toBe('fileBrowser.linkTypes.shortcutMacos');
    expect(optionLabelKeys(entries, 'linux')[0]).toBe('fileBrowser.linkTypes.shortcutLinux');
  });

  it('allows junctions for folder-only selections on Windows', () => {
    expect(optionKinds([
      createEntry({
        name: 'folder',
        path: '/folder',
        is_file: false,
        is_dir: true,
      }),
    ], 'windows')).toEqual(['shortcut', 'symlink', 'junction']);
  });

  it('does not allow hardlinks or junctions for mixed selections', () => {
    expect(optionKinds([
      createEntry({
        name: 'file.txt',
        path: '/file.txt',
      }),
      createEntry({
        name: 'folder',
        path: '/folder',
        is_file: false,
        is_dir: true,
      }),
    ], 'windows')).toEqual(['shortcut', 'symlink']);
  });

  it('uses the resolved entry kind for symlink-to-file selections', () => {
    expect(optionKinds([
      createEntry({
        name: 'linked-file.txt',
        path: '/linked-file.txt',
        is_symlink: true,
        link_type: 'symlink',
      }),
    ], 'windows')).toEqual(['shortcut', 'symlink', 'hardlink']);
  });

  it('uses the resolved entry kind for symlink-to-directory selections', () => {
    expect(optionKinds([
      createEntry({
        name: 'linked-folder',
        path: '/linked-folder',
        is_file: false,
        is_dir: true,
        is_symlink: true,
        link_type: 'symlink',
      }),
    ], 'windows')).toEqual(['shortcut', 'symlink', 'junction']);
  });
});
