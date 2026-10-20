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
      expect(getEntryActionPolicy('//wsl.localhost', 'windows')).toBe('virtual-location');
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

  describe('remote policy', () => {
    it('classifies remote paths as remote, not as virtual or mount root', () => {
      expect(getEntryActionPolicy('sfm://remote/conn-a', 'windows')).toBe('remote');
      expect(getEntryActionPolicy('sfm://remote/conn-a/pub', 'windows')).toBe('remote');
      expect(getEntryActionPolicy('sfm://remote', 'windows')).toBe('remote');
    });

    it('blocks every non-navigation action on remote paths in phase 0', () => {
      const entries = [createEntry('sfm://remote/conn-a/pub')];

      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('rename', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('paste', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('properties', entries, 'windows')).toBe(true);
      // 导航类必须放行，否则远程路径根本点不进去
      expect(isActionBlockedByEntryPolicy('open-in-new-tab', entries, 'windows')).toBe(false);
      expect(isActionBlockedByEntryPolicy('toggle-favorite', entries, 'windows')).toBe(false);
    });

    it('takes the strictest policy when a selection mixes remote and normal entries', () => {
      const mixed = [createEntry('C:/Users'), createEntry('sfm://remote/conn-a/pub')];

      expect(isActionBlockedByEntryPolicy('delete', mixed, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('copy', mixed, 'windows')).toBe(true);
    });

    it('leaves local paths on the normal policy', () => {
      expect(getEntryActionPolicy('C:/Users', 'windows')).toBe('normal');
      expect(isActionBlockedByEntryPolicy('copy', [createEntry('C:/Users')], 'windows')).toBe(false);
    });

    /**
     * FORK-MODIFICATION 2026-10-20：远程删除走独立动作 `remote-delete`，
     * **不在**阶段 0 的屏蔽集合里，所以远程条目可以有删除入口。
     *
     * 上面那条用例断言本地的 `delete` 仍然对远程屏蔽 —— 两条合起来才是
     * 完整的事实：**远程能删，但走的不是「移至垃圾箱」那条路**。
     */
    it('lets the dedicated remote-delete action through on remote paths', () => {
      const entries = [createEntry('sfm://remote/conn-a/pub')];

      expect(isActionBlockedByEntryPolicy('remote-delete', entries, 'windows')).toBe(false);
      // 本地的两个删除动作仍然屏蔽：远程没有回收箱。
      expect(isActionBlockedByEntryPolicy('delete', entries, 'windows')).toBe(true);
      expect(isActionBlockedByEntryPolicy('delete-permanently', entries, 'windows')).toBe(true);
    });
  });
});
