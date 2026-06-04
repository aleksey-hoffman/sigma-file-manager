// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getDirEntryKindKey,
  getDirEntryLinksDisplay,
  getDirEntryLinkStatusKey,
} from '@/utils/dir-entry-link-metadata';

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

describe('dir entry link metadata helpers', () => {
  it('returns normal file and folder kind keys', () => {
    expect(getDirEntryKindKey(createEntry({}))).toBe('fileBrowser.kinds.file');
    expect(getDirEntryKindKey(createEntry({
      is_file: false,
      is_dir: true,
    }))).toBe('fileBrowser.kinds.folder');
  });

  it('prioritizes link kinds over normal file kind', () => {
    expect(getDirEntryKindKey(createEntry({
      link_type: 'symlink',
    }))).toBe('fileBrowser.kinds.symlink');
    expect(getDirEntryKindKey(createEntry({
      link_type: 'hardlink',
      hard_link_count: 2,
    }))).toBe('fileBrowser.kinds.hardlinkedFile');
  });

  it('shows hard link counts only when they are meaningful', () => {
    expect(getDirEntryLinksDisplay(createEntry({
      hard_link_count: 2,
    }))).toBe('2');
    expect(getDirEntryLinksDisplay(createEntry({
      hard_link_count: 1,
    }))).toBe('—');
    expect(getDirEntryLinksDisplay(createEntry({
      is_file: false,
      is_dir: true,
      hard_link_count: null,
    }))).toBe('—');
  });

  it('maps link statuses to localization keys', () => {
    expect(getDirEntryLinkStatusKey(createEntry({
      link_type: 'shortcut',
      link_status: 'broken',
    }))).toBe('fileBrowser.linkStatuses.broken');
    expect(getDirEntryLinkStatusKey(createEntry({}))).toBeNull();
  });
});
