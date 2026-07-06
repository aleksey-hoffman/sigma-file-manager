// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { isProtectedSystemPath } from '@/utils/is-protected-system-path';
import { isVirtualDirectoryPath } from '@/utils/virtual-path-constants';

export type EntryActionPolicy = 'virtual-location' | 'system-mount-root' | 'normal';

const VIRTUAL_LOCATION_BLOCKED_ACTIONS = new Set<ContextMenuAction>([
  'rename',
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
  'cut',
  'link',
  'delete',
  'delete-permanently',
]);

export function getEntryActionPolicy(path: string, platform: string | null): EntryActionPolicy {
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

    if (policy === 'system-mount-root' && SYSTEM_MOUNT_ROOT_BLOCKED_ACTIONS.has(action)) {
      return true;
    }
  }

  return false;
}
