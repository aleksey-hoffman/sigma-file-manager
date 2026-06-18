// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';

export type LinkedPaneSyncQueueState = {
  pendingPath: string | null;
  isSyncing: boolean;
};

export function createLinkedPaneSyncQueueState(): LinkedPaneSyncQueueState {
  return {
    pendingPath: null,
    isSyncing: false,
  };
}

export function getLinkedPaneNavigationTarget(
  entries: DirEntry[],
  tabId: string,
  leftPaneTabId: string | null,
  tabGroupLength: number,
): string | null {
  if (tabGroupLength < 2 || !leftPaneTabId) {
    return null;
  }

  if (tabId !== leftPaneTabId) {
    return null;
  }

  if (entries.length !== 1 || !entries[0].is_dir) {
    return null;
  }

  return entries[0].path;
}

export async function drainLinkedPaneSyncQueue(
  queue: LinkedPaneSyncQueueState,
  getTabGroupLength: () => number,
  getRightPaneNavigate: () => ((path: string) => Promise<void>) | undefined,
): Promise<void> {
  if (queue.isSyncing) {
    return;
  }

  queue.isSyncing = true;

  try {
    while (queue.pendingPath) {
      if (getTabGroupLength() < 2) {
        return;
      }

      const navigateToPath = getRightPaneNavigate();

      if (!navigateToPath) {
        return;
      }

      const targetPath = queue.pendingPath;
      queue.pendingPath = null;
      await navigateToPath(targetPath);
    }
  }
  finally {
    queue.isSyncing = false;
  }
}

export function queueLinkedPaneNavigation(
  queue: LinkedPaneSyncQueueState,
  targetPath: string,
  drainQueue: () => Promise<void>,
): void {
  queue.pendingPath = targetPath;

  if (queue.isSyncing) {
    return;
  }

  void drainQueue();
}
