// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getActionTargetEntries,
  getDirectoryPathFromEntry,
  resolveTerminalDirectoryPath,
} from '@/utils/terminal-directory-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

function createEntry(overrides: Partial<DirEntry> & Pick<DirEntry, 'path'>): DirEntry {
  return {
    name: overrides.path,
    path: overrides.path,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
    ...overrides,
  };
}

describe('terminal-directory-path', () => {
  describe('getDirectoryPathFromEntry', () => {
    it('returns directory paths unchanged', () => {
      expect(getDirectoryPathFromEntry(createEntry({ path: 'C:/Users' }))).toBe('C:/Users');
    });

    it('returns the parent directory for files', () => {
      expect(getDirectoryPathFromEntry(createEntry({
        path: 'C:/Users/file.txt',
        is_file: true,
        is_dir: false,
      }))).toBe('C:/Users');
    });
  });

  describe('getActionTargetEntries', () => {
    it('filters virtual entries when browsing virtual locations', () => {
      const selectedEntries = [
        createEntry({ path: '//wsl.localhost/docker-desktop' }),
        createEntry({ path: LOCATIONS_VIRTUAL_PATH }),
      ];

      expect(getActionTargetEntries(selectedEntries, LOCATIONS_VIRTUAL_PATH)).toEqual([
        selectedEntries[0],
      ]);
    });

    it('returns all entries for normal directories', () => {
      const selectedEntries = [createEntry({ path: 'C:/Users' })];

      expect(getActionTargetEntries(selectedEntries, 'C:/')).toEqual(selectedEntries);
    });
  });

  describe('resolveTerminalDirectoryPath', () => {
    it('uses the current directory for normal paths', () => {
      expect(resolveTerminalDirectoryPath([], 'C:/Users')).toBe('C:/Users');
    });

    it('uses the selected directory when browsing virtual locations', () => {
      const selectedEntries = [createEntry({ path: '//wsl.localhost/docker-desktop' })];

      expect(resolveTerminalDirectoryPath(selectedEntries, LOCATIONS_VIRTUAL_PATH))
        .toBe('//wsl.localhost/docker-desktop');
    });

    it('returns null when browsing virtual locations without a valid selection', () => {
      expect(resolveTerminalDirectoryPath([], LOCATIONS_VIRTUAL_PATH)).toBeNull();
      expect(resolveTerminalDirectoryPath(
        [createEntry({ path: LOCATIONS_VIRTUAL_PATH })],
        LOCATIONS_VIRTUAL_PATH,
      )).toBeNull();
    });
  });
});
