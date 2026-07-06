// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getActionTargetEntries,
  getDirectoryPathFromEntry,
  getVirtualLocationActionContext,
  isBrowsingVirtualLocations,
  resolveActionDirectoryPath,
} from '@/utils/virtual-location-action-target';
import { LOCATIONS_VIRTUAL_PATH, WSL_HOST_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

function createEntry(overrides: Partial<DirEntry> & Pick<DirEntry, 'path'>): DirEntry {
  return {
    name: overrides.path,
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

describe('virtual-location-action-target', () => {
  describe('isBrowsingVirtualLocations', () => {
    it('detects the locations virtual path', () => {
      expect(isBrowsingVirtualLocations(LOCATIONS_VIRTUAL_PATH)).toBe(true);
      expect(isBrowsingVirtualLocations(WSL_HOST_VIRTUAL_PATH)).toBe(true);
      expect(isBrowsingVirtualLocations('C:/Users')).toBe(false);
    });
  });

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

  describe('resolveActionDirectoryPath', () => {
    it('uses the current directory for normal paths when nothing is selected', () => {
      expect(resolveActionDirectoryPath([], 'C:/Users')).toBe('C:/Users');
    });

    it('uses the selected directory for normal paths', () => {
      const selectedEntries = [createEntry({ path: 'C:/Users/Projects' })];

      expect(resolveActionDirectoryPath(selectedEntries, 'C:/Users')).toBe('C:/Users/Projects');
    });

    it('uses the parent directory when a file is selected', () => {
      const selectedEntries = [createEntry({
        path: 'C:/Users/file.txt',
        is_file: true,
        is_dir: false,
      })];

      expect(resolveActionDirectoryPath(selectedEntries, 'C:/')).toBe('C:/Users');
    });

    it('treats missing selection as empty', () => {
      expect(resolveActionDirectoryPath(undefined, 'C:/Users')).toBe('C:/Users');
    });

    it('uses the selected directory when browsing the wsl host virtual path', () => {
      const selectedEntries = [createEntry({ path: '//wsl.localhost/docker-desktop' })];

      expect(resolveActionDirectoryPath(selectedEntries, WSL_HOST_VIRTUAL_PATH))
        .toBe('//wsl.localhost/docker-desktop');
    });

    it('uses the selected directory when browsing virtual locations', () => {
      const selectedEntries = [createEntry({ path: '//wsl.localhost/docker-desktop' })];

      expect(resolveActionDirectoryPath(selectedEntries, LOCATIONS_VIRTUAL_PATH))
        .toBe('//wsl.localhost/docker-desktop');
    });

    it('returns null when browsing virtual locations without a valid selection', () => {
      expect(resolveActionDirectoryPath([], LOCATIONS_VIRTUAL_PATH)).toBeNull();
      expect(resolveActionDirectoryPath(
        [createEntry({ path: LOCATIONS_VIRTUAL_PATH })],
        LOCATIONS_VIRTUAL_PATH,
      )).toBeNull();
    });
  });

  describe('getVirtualLocationActionContext', () => {
    it('returns a full action context for virtual locations', () => {
      const selectedEntries = [
        createEntry({ path: '//wsl.localhost/docker-desktop' }),
        createEntry({ path: '//wsl.localhost/Ubuntu-24.04' }),
      ];

      expect(getVirtualLocationActionContext(selectedEntries, LOCATIONS_VIRTUAL_PATH)).toEqual({
        isBrowsingVirtualLocations: true,
        actionDirectoryPath: '//wsl.localhost/docker-desktop',
        actionTargetEntries: selectedEntries,
        actionTargetPathsText: '//wsl.localhost/docker-desktop\n//wsl.localhost/Ubuntu-24.04',
      });
    });

    it('returns the selected directory context for normal paths', () => {
      const selectedEntries = [createEntry({ path: 'C:/Users/Projects' })];

      expect(getVirtualLocationActionContext(selectedEntries, 'C:/Users')).toEqual({
        isBrowsingVirtualLocations: false,
        actionDirectoryPath: 'C:/Users/Projects',
        actionTargetEntries: selectedEntries,
        actionTargetPathsText: 'C:/Users/Projects',
      });
    });

    it('returns the current directory context when nothing is selected', () => {
      expect(getVirtualLocationActionContext([], 'C:/Users')).toEqual({
        isBrowsingVirtualLocations: false,
        actionDirectoryPath: 'C:/Users',
        actionTargetEntries: [],
        actionTargetPathsText: '',
      });
    });
  });
});
