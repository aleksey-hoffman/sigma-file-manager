// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { isProtectedSystemPath } from '@/utils/is-protected-system-path';
import { isVirtualDirectoryPath } from '@/utils/virtual-path-constants';
import { isRemotePath } from '@/utils/remote-paths';

export type EntryActionPolicy = 'virtual-location' | 'remote' | 'system-mount-root' | 'normal';

const VIRTUAL_LOCATION_BLOCKED_ACTIONS = new Set<ContextMenuAction>([
  'rename',
  'batch-rename',
  'copy',
  'cut',
  'link',
  'paste',
  'delete',
  'delete-permanently',
  'open-with',
  'properties',
  'quick-view',
  'print',
  'share',
]);

const SYSTEM_MOUNT_ROOT_BLOCKED_ACTIONS = new Set<ContextMenuAction>([
  'rename',
  'batch-rename',
  'cut',
  'link',
  'delete',
  'delete-permanently',
]);

/**
 * 远程空间在阶段 0 的门禁：**只放行导航类动作**。
 *
 * 阶段 0 还没有传输与远程写操作，放行它们会让用户点到没接线的按钮。
 * 阶段 3（新建目录 / 重命名 / 删除）与阶段 7（跨边界拖拽 / 复制粘贴）
 * 会**逐条从这里移出去** —— 每移一条，同步更新
 * `entry-action-policy.test.ts` 里那条「阶段 0 只放行导航」的断言。
 *
 * FORK-MODIFICATION 2026-10-20：远程**删除**走的是另一个动作
 * `remote-delete`，它**不在**这个集合里，所以远程条目可以有删除入口。
 * 本地的 `delete` / `delete-permanently` 继续对远程屏蔽 ——
 * 远程没有回收箱，「移至垃圾箱」在远程是假选项。
 *
 * FORK-MODIFICATION 2026-10-20（阶段 3 收尾）：两条改动 ——
 *
 * - **`rename` 移出**：远程重命名已实现（规格 §5「重命名 ✅」）。
 *   `batch-rename` **留在**集合里：批量改名是另一件事，阶段 6/7 再议。
 * - **`create-file` 移入**：规格 §1 把「在远程目录里新建空文件」列为
 *   **永久非目标** —— SFTP 没有 `CREATE`，FTP 的 `STOR` 需要先有本地文件。
 *   所以这一条**不是「暂时没做」，是「永远不做」**。
 *   `create-directory` **不在**这个集合里：阶段 3 已实现远程新建目录。
 */
const REMOTE_PHASE0_BLOCKED_ACTIONS = new Set<ContextMenuAction>([
  'batch-rename',
  'copy',
  'cut',
  'link',
  'paste',
  'delete',
  'delete-permanently',
  'create-file',
  'open-with',
  'properties',
  'quick-view',
  'print',
  'share',
]);

export function getEntryActionPolicy(path: string, platform: string | null): EntryActionPolicy {
  // `remote` 必须排在最前。当前 `sfm://remote/...` 既不匹配 `isVirtualDirectoryPath`
  // 也不匹配 `isProtectedSystemPath`，会一路落到 `normal` —— 那个策略对
  // delete / rename / copy **全部放行**，正是最不能落到的地方。
  // 后续阶段 1 把 `sfm://remote` 接进 `isVirtualDirectoryPath` 之后，
  // 这个顺序也不会打架。
  if (isRemotePath(path)) {
    return 'remote';
  }

  if (isVirtualDirectoryPath(path)) {
    return 'virtual-location';
  }

  if (isProtectedSystemPath(path, platform)) {
    return 'system-mount-root';
  }

  return 'normal';
}

export function isSelectionVirtualLocation(entries: DirEntry[]): boolean {
  return entries.some(entry => isVirtualDirectoryPath(entry.path));
}

export function isActionBlockedByEntryPolicy(
  action: ContextMenuAction,
  entries: DirEntry[],
  platform: string | null,
  options?: {
    disableDestructiveActions?: boolean;
  },
): boolean {
  if (options?.disableDestructiveActions && SYSTEM_MOUNT_ROOT_BLOCKED_ACTIONS.has(action)) {
    return true;
  }

  for (const entry of entries) {
    const policy = getEntryActionPolicy(entry.path, platform);

    if (policy === 'virtual-location' && VIRTUAL_LOCATION_BLOCKED_ACTIONS.has(action)) {
      return true;
    }

    if (policy === 'remote' && REMOTE_PHASE0_BLOCKED_ACTIONS.has(action)) {
      return true;
    }

    if (policy === 'system-mount-root' && SYSTEM_MOUNT_ROOT_BLOCKED_ACTIONS.has(action)) {
      return true;
    }
  }

  return false;
}
