// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  hasSameFileClipboardContent,
  shouldShowClipboardUi,
} from '@/stores/runtime/clipboard-visibility';

function createEntry(path: string): DirEntry {
  return {
    name: path.split(/[/\\]/).pop() || path,
    ext: 'txt',
    path,
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
  };
}

const defaultSettings = {
  showToolbarForExternalImages: true,
  showToolbarForExternalPaths: true,
};

describe('clipboard visibility', () => {
  it('matches file clipboard content regardless of path casing', () => {
    expect(hasSameFileClipboardContent(
      [createEntry('C:/Source/file.txt')],
      'copy',
      ['c:/source/file.txt'],
      'copy',
    )).toBe(true);
  });

  it('does not match when operations differ', () => {
    expect(hasSameFileClipboardContent(
      [createEntry('C:/Source/file.txt')],
      'copy',
      ['C:/Source/file.txt'],
      'move',
    )).toBe(false);
  });

  it('shows internal clipboard UI regardless of external settings', () => {
    expect(shouldShowClipboardUi({
      hasItems: true,
      origin: 'internal',
      hasImageContent: false,
      hasFileItems: true,
      settings: {
        showToolbarForExternalImages: false,
        showToolbarForExternalPaths: false,
      },
    })).toBe(true);
  });

  it('hides external file clipboard UI when the paths setting is disabled', () => {
    expect(shouldShowClipboardUi({
      hasItems: true,
      origin: 'external',
      hasImageContent: false,
      hasFileItems: true,
      settings: {
        ...defaultSettings,
        showToolbarForExternalPaths: false,
      },
    })).toBe(false);
  });

  it('hides external image clipboard UI when the images setting is disabled', () => {
    expect(shouldShowClipboardUi({
      hasItems: true,
      origin: 'external',
      hasImageContent: true,
      hasFileItems: false,
      settings: {
        ...defaultSettings,
        showToolbarForExternalImages: false,
      },
    })).toBe(false);
  });
});
