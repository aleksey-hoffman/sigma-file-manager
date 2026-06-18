// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  createLinkedPaneSyncQueueState,
  drainLinkedPaneSyncQueue,
  getLinkedPaneNavigationTarget,
  queueLinkedPaneNavigation,
} from '../linked-split-sync';

function createEntry(overrides: Partial<DirEntry> = {}): DirEntry {
  return {
    name: 'folder',
    ext: null,
    path: 'C:/Dir/folder',
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
    ...overrides,
  };
}

describe('getLinkedPaneNavigationTarget', () => {
  it('returns folder path for a single folder selection on the left pane', () => {
    const folder = createEntry({ path: 'C:/Projects/demo' });

    expect(getLinkedPaneNavigationTarget([folder], 'left-tab', 'left-tab', 2)).toBe('C:/Projects/demo');
  });

  it('returns null for right pane selections', () => {
    const folder = createEntry();

    expect(getLinkedPaneNavigationTarget([folder], 'right-tab', 'left-tab', 2)).toBeNull();
  });

  it('returns null for multi-selection', () => {
    const firstFolder = createEntry({ path: 'C:/Dir/a' });
    const secondFolder = createEntry({ path: 'C:/Dir/b' });

    expect(getLinkedPaneNavigationTarget([firstFolder, secondFolder], 'left-tab', 'left-tab', 2)).toBeNull();
  });

  it('returns null for file selections', () => {
    const file = createEntry({
      name: 'file.txt',
      ext: 'txt',
      path: 'C:/Dir/file.txt',
      is_file: true,
      is_dir: false,
      mime: 'text/plain',
    });

    expect(getLinkedPaneNavigationTarget([file], 'left-tab', 'left-tab', 2)).toBeNull();
  });

  it('returns null when split view has fewer than two panes', () => {
    const folder = createEntry();

    expect(getLinkedPaneNavigationTarget([folder], 'left-tab', 'left-tab', 1)).toBeNull();
  });
});

describe('linked pane sync queue', () => {
  it('navigates the right pane to the queued folder path', async () => {
    const queue = createLinkedPaneSyncQueueState();
    const navigateToPath = vi.fn(async () => {});

    queue.pendingPath = 'C:/Projects/demo';
    await drainLinkedPaneSyncQueue(queue, () => 2, () => navigateToPath);

    expect(navigateToPath).toHaveBeenCalledWith('C:/Projects/demo');
    expect(queue.pendingPath).toBeNull();
    expect(queue.isSyncing).toBe(false);
  });

  it('processes only the latest path when selection changes during navigation', async () => {
    const queue = createLinkedPaneSyncQueueState();
    const navigationOrder: string[] = [];

    let resolveFirstNavigation: () => void = () => {};

    const firstNavigation = new Promise<void>((resolve) => {
      resolveFirstNavigation = resolve;
    });
    const navigateToPath = vi.fn(async (path: string) => {
      navigationOrder.push(path);

      if (path === 'C:/Dir/first') {
        await firstNavigation;
      }
    });

    queue.pendingPath = 'C:/Dir/first';
    const drainPromise = drainLinkedPaneSyncQueue(queue, () => 2, () => navigateToPath);
    queue.pendingPath = 'C:/Dir/second';

    resolveFirstNavigation();
    await drainPromise;

    expect(navigationOrder).toEqual(['C:/Dir/first', 'C:/Dir/second']);
    expect(queue.pendingPath).toBeNull();
    expect(queue.isSyncing).toBe(false);
  });

  it('queues navigation without starting a second drain while sync is active', async () => {
    const queue = createLinkedPaneSyncQueueState();
    const navigateToPath = vi.fn(async () => {});
    const drainQueue = vi.fn(async () => {
      await drainLinkedPaneSyncQueue(queue, () => 2, () => navigateToPath);
    });

    queueLinkedPaneNavigation(queue, 'C:/Dir/first', drainQueue);
    queueLinkedPaneNavigation(queue, 'C:/Dir/second', drainQueue);

    await drainQueue.mock.results[0]?.value;

    expect(drainQueue).toHaveBeenCalledTimes(1);
    expect(navigateToPath).toHaveBeenCalledTimes(2);
    expect(navigateToPath).toHaveBeenNthCalledWith(1, 'C:/Dir/first');
    expect(navigateToPath).toHaveBeenNthCalledWith(2, 'C:/Dir/second');
  });
});
