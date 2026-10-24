// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-24：「解除文件锁定 / 彻底删除」的可见性门禁。
//
// 这两个动作的危险性比普通删除更高（标记删除 ⇒ 占用者一放手文件就没了；
// 彻底删除 ⇒ 连兜底路径都没有），所以可见性判定必须**逐条钉死**：
// ① 只在 Windows 上出现；
// ② 只对**单个**条目出现（后端签名就是单路径）；
// ③ 虚拟位置 / 盘根 / 远程条目上**一律不出现**。

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { isContextMenuActionVisible } from '@/modules/navigator/components/file-browser/utils/context-menu-action-visibility';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

function createEntry(path: string, isDirectory = true): DirEntry {
  return {
    name: path,
    path,
    is_file: !isDirectory,
    is_dir: isDirectory,
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

describe('file lock actions visibility', () => {
  it('shows both actions for a single local entry on windows', () => {
    const entries = [createEntry('C:/Users/Duanyi/locked.txt', false)];

    expect(isContextMenuActionVisible('unlock', entries, { platform: 'windows' })).toBe(true);
    expect(isContextMenuActionVisible('force-delete', entries, { platform: 'windows' })).toBe(true);
  });

  it('hides both actions on non-windows platforms', () => {
    const entries = [createEntry('/home/user/locked.txt', false)];

    for (const platform of ['linux', 'macos', null]) {
      expect(isContextMenuActionVisible('unlock', entries, { platform })).toBe(false);
      expect(isContextMenuActionVisible('force-delete', entries, { platform })).toBe(false);
    }
  });

  it('hides both actions for a multi-selection', () => {
    const entries = [
      createEntry('C:/Users/Duanyi/a.txt', false),
      createEntry('C:/Users/Duanyi/b.txt', false),
    ];

    expect(isContextMenuActionVisible('unlock', entries, { platform: 'windows' })).toBe(false);
    expect(isContextMenuActionVisible('force-delete', entries, { platform: 'windows' })).toBe(false);
  });

  it('hides both actions for the virtual locations path', () => {
    const entries = [createEntry(LOCATIONS_VIRTUAL_PATH)];

    expect(isContextMenuActionVisible('unlock', entries, { platform: 'windows' })).toBe(false);
    expect(isContextMenuActionVisible('force-delete', entries, { platform: 'windows' })).toBe(false);
  });

  it('hides both actions for a windows drive root', () => {
    const entries = [createEntry('D:/')];

    expect(isContextMenuActionVisible('unlock', entries, { platform: 'windows' })).toBe(false);
    expect(isContextMenuActionVisible('force-delete', entries, { platform: 'windows' })).toBe(false);
  });

  it('hides both actions for remote entries', () => {
    const entries = [createEntry('sfm://remote/conn-a/pub/file.txt', false)];

    expect(isContextMenuActionVisible('unlock', entries, { platform: 'windows' })).toBe(false);
    expect(isContextMenuActionVisible('force-delete', entries, { platform: 'windows' })).toBe(false);
  });

  it('hides both actions when destructive actions are disabled', () => {
    const entries = [createEntry('C:/Users/Duanyi/locked.txt', false)];

    expect(isContextMenuActionVisible('unlock', entries, {
      platform: 'windows',
      disableDestructiveActions: true,
    })).toBe(false);
    expect(isContextMenuActionVisible('force-delete', entries, {
      platform: 'windows',
      disableDestructiveActions: true,
    })).toBe(false);
  });

  it('does not affect the ordinary delete actions', () => {
    const entries = [createEntry('C:/Users/Duanyi/locked.txt', false)];

    expect(isContextMenuActionVisible('delete', entries, { platform: 'windows' })).toBe(true);
    expect(isContextMenuActionVisible('delete-permanently', entries, { platform: 'windows' })).toBe(true);
  });
});
