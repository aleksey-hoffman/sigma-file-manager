// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getEntryActionPolicy,
  isActionBlockedByEntryPolicy,
  isSelectionVirtualLocation,
} from '@/utils/entry-action-policy';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

function createEntry(path: string): DirEntry {
  return {
    name: path,
    path,
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
  };
}

describe('entry-action-policy', () => {
  describe('getEntryActionPolicy', () => {
    it('classifies virtual, mount-root, and normal paths', () => {
      expect(getEntryActionPolicy(LOCATIONS_VIRTUAL_PATH, 'windows')).toBe('virtual-location');
      expect(getEntryActionPolicy('C:/', 'windows')).toBe('system-mount-root');
      expect(getEntryActionPolicy('C:/Users', 'windows')).toBe('normal');
      expect(getEntryActionPolicy('//wsl.localhost/Ubuntu-24.04', 'windows')).toBe('system-mount-root');
    });
  });

  describe('isSelectionVirtualLocation', () => {
    it('detects when any selected entry is the virtual locations path', () => {
      expect(isSelectionVirtualLocation([createEntry(LOCATIONS_VIRTUAL_PATH)])).toBe(true);
      expect(isSelectionVirtualLocation([createEntry('C:/Users')])).toBe(false);
    });
  });

  describe('isActionBlockedByEntryPolicy', () => {
    it('blocks destructive actions on mount roots but keeps copy available', () => {
      const entries = [createEntry('D:/')];

      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('link', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', entries, 'windows')).toBe(false);
      expect(isActionBlockedByEntryPolicy('open-in-new-tab', entries, 'windows')).toBe(false);
    });

    it('blocks most actions for the virtual locations path itself', () => {
      const entries = [createEntry(LOCATIONS_VIRTUAL_PATH)];

      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('toggle-favorite', entries, 'windows')).toBe(false);
    });

    it('honors disableDestructiveActions for mount-root entries', () => {
      const entries = [createEntry('D:/')];

      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows', {
        disableDestructiveActions: true,
      })).toBe(true);
    });
  });
});
