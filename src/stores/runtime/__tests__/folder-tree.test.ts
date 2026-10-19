// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: test for folder-tree store (tree sync v6).
// Tracking issue: aleksey-hoffman/sigma-file-manager#499

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  computeAncestorPaths,
  parentDirectoryPath,
  useFolderTreeStore,
} from '@/stores/runtime/folder-tree';

describe('computeAncestorPaths', () => {
  it('returns empty for root or empty', () => {
    expect(computeAncestorPaths('')).toEqual([]);
    expect(computeAncestorPaths('/')).toEqual([]);
    expect(computeAncestorPaths('C:/')).toEqual([]);
    expect(computeAncestorPaths('C:\\')).toEqual([]);
  });

  it('expands POSIX absolute path', () => {
    expect(computeAncestorPaths('/usr/local/bin'))
      .toEqual(['/usr', '/usr/local']);
  });

  it('expands POSIX absolute path with trailing slash', () => {
    expect(computeAncestorPaths('/usr/local/bin/'))
      .toEqual(['/usr', '/usr/local']);
  });

  it('expands Windows drive path with forward slashes', () => {
    expect(computeAncestorPaths('C:/Users/foo'))
      .toEqual(['C:/', 'C:/Users']);
  });

  it('expands Windows drive path with backslashes', () => {
    expect(computeAncestorPaths('C:\\Users\\foo\\bar'))
      .toEqual(['C:/', 'C:/Users', 'C:/Users/foo']);
  });

  it('expands single-segment relative path to nothing', () => {
    expect(computeAncestorPaths('foo')).toEqual([]);
  });

  it('expands multi-segment relative path', () => {
    expect(computeAncestorPaths('foo/bar/baz'))
      .toEqual(['foo', 'foo/bar']);
  });

  // FORK-MODIFICATION 2026-10-19：远程连接根就是根。
  // 用户实测：树根切到「速豹堂」了，但永远展不开 —— 祖先链爬到了
  // `sfm://remote` 和 `sfm:` 这些树里根本不存在的路径上。
  it('expands remote path down to the connection root, and stops there', () => {
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';

    expect(computeAncestorPaths(`sfm://remote/${CONN}/vol1/@team/study_platform`))
      .toEqual([
        `sfm://remote/${CONN}`,
        `sfm://remote/${CONN}/vol1`,
        `sfm://remote/${CONN}/vol1/@team`,
      ]);
  });

  it('never emits `sfm:` or `sfm://remote` as an ancestor', () => {
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
    const ancestors = computeAncestorPaths(`sfm://remote/${CONN}/vol1`);

    expect(ancestors).not.toContain('sfm:');
    expect(ancestors).not.toContain('sfm://remote');
    expect(ancestors).not.toContain('sfm://');
  });

  it('connection root itself has no ancestors', () => {
    const CONN = 'e2b24ab525544dc7adeb5cedb192179b';

    expect(computeAncestorPaths(`sfm://remote/${CONN}`)).toEqual([]);
    expect(computeAncestorPaths(`sfm://remote/${CONN}/`)).toEqual([]);
  });
});

describe('parentDirectoryPath · 远程', () => {
  const CONN = 'e2b24ab525544dc7adeb5cedb192179b';

  it('到连接根就停', () => {
    expect(parentDirectoryPath(`sfm://remote/${CONN}/vol1/@team`))
      .toBe(`sfm://remote/${CONN}/vol1`);
    expect(parentDirectoryPath(`sfm://remote/${CONN}/vol1`))
      .toBe(`sfm://remote/${CONN}`);
  });

  it('连接根没有父级', () => {
    expect(parentDirectoryPath(`sfm://remote/${CONN}`)).toBeNull();
  });
});

describe('useFolderTreeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts with empty state', () => {
    const store = useFolderTreeStore();
    expect(store.selectedPath).toBeNull();
    expect(store.expandedPaths.size).toBe(0);
    expect(store.loadingPaths.size).toBe(0);
    expect(store.loadErrorPaths.size).toBe(0);
  });

  it('setSelectedPath stores the path and auto-expands the full chain', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/Users/foo');
    expect(store.selectedPath).toBe('C:/Users/foo');
    // v6.2 policy: chain from drive root down to (and including) selected path
    expect(store.isExpanded('C:/')).toBe(true);
    expect(store.isExpanded('C:/Users')).toBe(true);
    expect(store.isExpanded('C:/Users/foo')).toBe(true);
  });

  it('setSelectedPath(null) clears the path AND drops the expanded set', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/Users/foo');
    store.setSelectedPath(null);
    expect(store.selectedPath).toBeNull();
    expect(store.expandedPaths.size).toBe(0);
  });

  it('setSelectedPath replaces expanded set — unrelated branches collapse (single-active-path policy)', () => {
    const store = useFolderTreeStore();
    store.expandPath('D:/other');
    store.setSelectedPath('C:/Users/foo');
    // D:/other is NOT preserved — only the new chain stays expanded
    expect(store.isExpanded('D:/other')).toBe(false);
    expect(store.isExpanded('C:/')).toBe(true);
    expect(store.isExpanded('C:/Users')).toBe(true);
    expect(store.isExpanded('C:/Users/foo')).toBe(true);
  });

  it('toggleExpanded adds and removes paths', () => {
    const store = useFolderTreeStore();
    store.toggleExpanded('C:/Users');
    expect(store.isExpanded('C:/Users')).toBe(true);
    store.toggleExpanded('C:/Users');
    expect(store.isExpanded('C:/Users')).toBe(false);
  });

  it('expandPath is idempotent', () => {
    const store = useFolderTreeStore();
    store.expandPath('C:/Users');
    store.expandPath('C:/Users');
    expect(store.expandedPaths.size).toBe(1);
  });

  it('collapsePath only removes when present', () => {
    const store = useFolderTreeStore();
    store.collapsePath('C:/Users'); // not present, no-op
    expect(store.expandedPaths.size).toBe(0);
    store.expandPath('C:/Users');
    store.collapsePath('C:/Users');
    expect(store.expandedPaths.size).toBe(0);
  });

  it('markLoading toggles loading flag', () => {
    const store = useFolderTreeStore();
    expect(store.isLoading('C:/Users')).toBe(false);
    store.markLoading('C:/Users', true);
    expect(store.isLoading('C:/Users')).toBe(true);
    store.markLoading('C:/Users', false);
    expect(store.isLoading('C:/Users')).toBe(false);
  });

  it('markLoadError toggles error flag', () => {
    const store = useFolderTreeStore();
    store.markLoadError('E:/virtual', true);
    expect(store.hasLoadError('E:/virtual')).toBe(true);
    store.markLoadError('E:/virtual', false);
    expect(store.hasLoadError('E:/virtual')).toBe(false);
  });

  it('expandedPaths / loadingPaths / loadErrorPaths use new-Set replacement (Vue reactivity)', () => {
    // This pins the root cause from v5: ref(new Map()).set() did NOT trigger
    // reactivity. For Sets in store, we replace the ref on every mutation
    // (same fix). Verify: store.expandedPaths.value is a NEW Set reference
    // after every mutation.
    const store = useFolderTreeStore();
    const before = store.expandedPaths;
    store.toggleExpanded('C:/Users');
    expect(store.expandedPaths).not.toBe(before);
  });

  it('reset clears all state', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/Users/foo');
    store.markLoading('C:/Users', true);
    store.markLoadError('C:/Users', true);
    store.reset();
    expect(store.selectedPath).toBeNull();
    expect(store.expandedPaths.size).toBe(0);
    expect(store.loadingPaths.size).toBe(0);
    expect(store.loadErrorPaths.size).toBe(0);
  });

  it('ancestor load failure is observable: markLoadError does not throw and does not clobber expanded set', () => {
    // Per handoff §8.3: ancestor load failures must not break the UI. The store
    // simply records the error flag; the tree-view can keep showing the entry.
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/Users/foo');
    store.markLoadError('C:/Users', true);
    expect(store.isExpanded('C:/Users')).toBe(true);
    expect(store.hasLoadError('C:/Users')).toBe(true);
  });
});

describe('folderTree store — stale-path channel (v6.5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('markTreeStale normalizes separators and drops descendants of a stale ancestor', () => {
    // Invalidating an ancestor already re-reads everything beneath it, so
    // keeping the descendant would only cost a second, redundant disk read.
    const store = useFolderTreeStore();
    store.markTreeStale(['C:\\work', 'C:/work/sub', 'C:/work/sub/deeper', 'D:/other']);

    expect([...store.staleTreePaths].sort()).toEqual(['C:/work', 'D:/other']);
  });

  it('markTreeStale handles drive roots and trailing slashes', () => {
    const store = useFolderTreeStore();
    store.markTreeStale(['C:/', 'C:/Users/', 'E:/']);
    expect([...store.staleTreePaths].sort()).toEqual(['C:/', 'E:/']);
  });

  it('markTreeStale ignores empty input and bumps the revision', () => {
    // The revision is what makes a watcher fire: the stale Set dedupes, so
    // invalidating the same path twice is otherwise invisible to a watcher
    // that only tracks the Set.
    const store = useFolderTreeStore();
    const before = store.staleTreeRevision;

    store.markTreeStale(['C:/work']);
    const afterFirst = store.staleTreeRevision;
    expect(afterFirst).toBeGreaterThan(before);

    store.markTreeStale(['C:/work']);
    expect(store.staleTreeRevision).toBeGreaterThan(afterFirst);
    expect([...store.staleTreePaths]).toEqual(['C:/work']);

    store.markTreeStale(['', '   ']);
    expect([...store.staleTreePaths]).toEqual(['C:/work']);
  });

  it('consumeStaleTreePaths hands over the paths and clears them', () => {
    const store = useFolderTreeStore();
    store.markTreeStale(['C:/work']);

    expect(store.consumeStaleTreePaths()).toEqual(['C:/work']);
    expect(store.consumeStaleTreePaths()).toEqual([]);
    expect(store.staleTreePaths.size).toBe(0);
  });

  it('consumeStaleTreePaths preserves paths published while the tree panel is hidden', () => {
    // navigator.vue mounts FileBrowserTreeView under v-if="showFolderTree".
    // Invalidation published while it is unmounted must survive until the
    // tree comes back — the consumer only reads on mount/r revision change.
    const store = useFolderTreeStore();
    store.markTreeStale(['C:/work']);
    expect(store.consumeStaleTreePaths()).toEqual(['C:/work']);

    store.markTreeStale(['C:/work']);
    expect(store.consumeStaleTreePaths()).toEqual(['C:/work']);
  });

  it('handlePathRenamed moves expansion and selection onto the new path', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/work/sub');
    store.expandPath('C:/work');

    store.handlePathRenamed('C:/work/sub', 'C:/work/renamed');

    expect(store.isExpanded('C:/work/renamed')).toBe(true);
    expect(store.isExpanded('C:/work/sub')).toBe(false);
    expect(store.selectedPath).toBe('C:/work/renamed');
  });

  it('handlePathRenamed is a no-op for unchanged or empty paths', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/work/sub');

    store.handlePathRenamed('C:/work/sub', 'C:/work/sub');
    expect(store.selectedPath).toBe('C:/work/sub');

    store.handlePathRenamed('', 'C:/x');
    store.handlePathRenamed('C:/a', '');
    expect(store.selectedPath).toBe('C:/work/sub');
  });

  it('reset clears pending stale paths', () => {
    const store = useFolderTreeStore();
    store.markTreeStale(['C:/work']);
    store.reset();
    expect(store.staleTreePaths.size).toBe(0);
    expect(store.consumeStaleTreePaths()).toEqual([]);
  });
});

describe('parentDirectoryPath', () => {
  it('returns the parent for nested paths', () => {
    expect(parentDirectoryPath('C:/Users/foo')).toBe('C:/Users');
    expect(parentDirectoryPath('C:/Users/foo/bar.txt')).toBe('C:/Users/foo');
    expect(parentDirectoryPath('/usr/local/bin')).toBe('/usr/local');
  });

  it('returns null for roots and non-paths', () => {
    expect(parentDirectoryPath('')).toBeNull();
    expect(parentDirectoryPath('/')).toBeNull();
    expect(parentDirectoryPath('C:/')).toBeNull();
    expect(parentDirectoryPath('C:')).toBeNull();
    expect(parentDirectoryPath('foo')).toBeNull();
  });
});
