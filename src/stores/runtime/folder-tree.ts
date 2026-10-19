// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: new store (tree sync v6). Keep during upstream sync.
// Tracking issue: aleksey-hoffman/sigma-file-manager#499
//
// Replaces the imperative "parent holds child ref + calls expandToPath" chain
// (broken in v0..v5, see handoff-2026-09-26-tree-sync-retro.md) with reactive
// shared state. Parent writes `selectedPath`; child (tree-view) reads it and
// reactively expands ancestors. No template ref, no async silent-fail.

import { defineStore } from 'pinia';
import { ref } from 'vue';
// FORK-MODIFICATION 2026-10-19：祖先链要认得 `sfm://remote/<id>` 这个根。
import {
  getRemoteParentPath,
  isRemoteConnectionRootPath,
  isRemotePath,
} from '@/utils/remote-paths';

/**
 * Pure helper: return all ancestor directories of `path`, root-most first,
 * excluding the path itself.
 *
 * Examples (separator-agnostic: both `\` and `/` accepted; trailing slash
 * is normalized away):
 *   'C:/Users/foo'        → ['C:/', 'C:/Users']
 *   'C:\\Users\\foo'      → ['C:/', 'C:/Users']
 *   '/usr/local/bin'      → ['/usr', '/usr/local']
 *   'foo/bar/baz'         → ['foo', 'foo/bar']
 *   '/'                   → []
 *   ''                    → []
 */
export function computeAncestorPaths(path: string): string[] {
  if (!path) return [];
  const trimmed = path.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!trimmed) return [];

  const ancestors: string[] = [];
  let current = trimmed;
  while (true) {
    const parent = parentDirectoryPath(current);
    if (parent === null || parent === current) break;
    // POSIX root '/' is not an "ancestor" to expand (no useful UI state).
    if (parent === '/') break;
    ancestors.unshift(parent);
    // Windows drive root 'C:/' is the last ancestor to add; stop after it.
    if (/^[A-Z]:\/$/i.test(parent)) break;
    current = parent;
  }
  return ancestors;
}

/** Return parent directory of `path`, or null if path is a root.
 *  Pure / path-string only — no FS access. Exported so callers that mutate
 *  the filesystem can name the directory whose cached children went stale. */
export function parentDirectoryPath(path: string): string | null {
  if (!path) return null;
  if (path === '/') return null;
  // Windows drive root: 'C:/', 'C:'
  if (/^[A-Z]:\/?$/i.test(path)) return null;

  // FORK-MODIFICATION 2026-10-19：远程连接根 `sfm://remote/<id>` 就是根。
  //
  // 不认它的话，祖先链会一路爬到 `sfm://remote`、`sfm:` —— 这些路径树里根本没有，
  // `expandedPaths` 装进去之后 `useFileTree` 一个都匹配不上，结果就是
  // 「根出现了但永远展不开」（用户 2026-10-19 实测）。
  if (isRemotePath(path)) {
    return isRemoteConnectionRootPath(path) ? null : getRemoteParentPath(path);
  }

  const lastSlash = path.lastIndexOf('/');
  if (lastSlash === -1) return null;
  if (lastSlash === 0) return '/';

  let parent = path.substring(0, lastSlash);
  // Normalize Windows drive bare 'C:' to 'C:/' so equality checks line up
  if (/^[A-Z]:$/i.test(parent)) parent = `${parent}/`;
  return parent;
}

export const useFolderTreeStore = defineStore('folderTree', () => {
  /** Currently selected path (drives tree-view highlight + ancestor expansion). */
  const selectedPath = ref<string | null>(null);
  /** Set of directory paths the user has expanded in the tree. */
  const expandedPaths = ref<Set<string>>(new Set());
  /** Set of paths whose children are currently being loaded. */
  const loadingPaths = ref<Set<string>>(new Set());
  /** Set of paths whose children failed to load (permission denied, etc.). */
  const loadErrorPaths = ref<Set<string>>(new Set());
  /**
   * v6.5: directories whose *cached* children are stale because something
   * outside the tree changed them (create / rename / delete in a file browser
   * pane). The tree-view consumes these and re-reads; nothing else should.
   */
  const staleTreePaths = ref<Set<string>>(new Set());
  /**
   * Bumped by `markTreeStale`. Needed because the stale set dedupes, so
   * invalidating the same path twice is not otherwise observable by a
   * watcher that only tracks the set.
   */
  const staleTreeRevision = ref(0);

  function isExpanded(path: string): boolean {
    return expandedPaths.value.has(path);
  }

  function isLoading(path: string): boolean {
    return loadingPaths.value.has(path);
  }

  function hasLoadError(path: string): boolean {
    return loadErrorPaths.value.has(path);
  }

  /**
   * Set the selected path. Side effect: replace `expandedPaths` with the
   * chain from the drive/root down to (and including) the selected path so
   * the tree reveals the selection while everything else collapses back to
   * drive level. This is the v6.2 "single-active-path" policy — see
   * handoff-2026-09-26-tree-sync-v6-2.md. Manual expansions of unrelated
   * branches are cleared on every navigation.
   */
  function setSelectedPath(path: string | null): void {
    selectedPath.value = path;
    if (!path) {
      expandedPaths.value = new Set();
      return;
    }
    const ancestors = computeAncestorPaths(path);
    const next = new Set<string>(ancestors);
    next.add(path);
    expandedPaths.value = next;
  }

  function toggleExpanded(path: string): void {
    const next = new Set(expandedPaths.value);
    if (next.has(path)) {
      next.delete(path);
    }
    else {
      next.add(path);
    }
    expandedPaths.value = next;
  }

  function expandPath(path: string): void {
    if (expandedPaths.value.has(path)) return;
    const next = new Set(expandedPaths.value);
    next.add(path);
    expandedPaths.value = next;
  }

  function collapsePath(path: string): void {
    if (!expandedPaths.value.has(path)) return;
    const next = new Set(expandedPaths.value);
    next.delete(path);
    expandedPaths.value = next;
  }

  function markLoading(path: string, on: boolean): void {
    const next = new Set(loadingPaths.value);
    if (on) next.add(path);
    else next.delete(path);
    loadingPaths.value = next;
  }

  function markLoadError(path: string, on: boolean): void {
    const next = new Set(loadErrorPaths.value);
    if (on) next.add(path);
    else next.delete(path);
    loadErrorPaths.value = next;
  }

  /**
   * v6.5: publish directories whose cached children are stale. Called by the
   * filesystem mutations; consumed by `file-browser-tree-view`, which turns
   * each path into a real re-read.
   *
   * Only the shallowest paths survive: invalidating an ancestor already
   * clears and re-reads everything beneath it, so keeping a descendant would
   * just cost a second, redundant disk read.
   */
  function markTreeStale(paths: string[]): void {
    // Merge into whatever is still pending, never replace: the consumer reads
    // on the next flush, so a later call must not discard an earlier one.
    const merged = new Set<string>(staleTreePaths.value);

    for (const p of paths) {
      // DirEntry.path is already '/'-normalized by the Rust layer
      // (src-tauri/src/utils.rs::normalize_path); normalize anyway so a
      // hand-built or stale path still matches a tree node. Note the stored
      // key is NOT trimmed — only rejected when blank — because a real path
      // must be reproduced exactly to match a tree node.
      const key = p ? p.replace(/\\/g, '/') : '';
      if (key.trim()) merged.add(key);
    }

    // Keep only the shallowest paths: invalidating an ancestor already
    // clears and re-reads everything beneath it, so keeping a descendant would
    // just cost a second, redundant disk read.
    const shallowest = [...merged].filter(
      p => ![...merged].some(q => q !== p && p.startsWith(`${q.replace(/\/+$/, '')}/`)),
    );
    staleTreePaths.value = new Set(shallowest);
    staleTreeRevision.value += 1;
  }

  /** Take the pending stale paths and clear them. Exactly one consumer
   *  (the mounted tree view) is expected to call this. */
  function consumeStaleTreePaths(): string[] {
    const out = [...staleTreePaths.value];
    staleTreePaths.value = new Set();
    return out;
  }

  /**
   * v6.5: a rename moves a directory, so the tree's per-path state has to
   * follow it — otherwise the tree shows the old name expanded while the
   * browser shows the new one. Mirrors the `handlePathRenamed` shape already
   * used by the workspaces / stats / settings stores.
   */
  function handlePathRenamed(oldPath: string, newPath: string): void {
    if (!oldPath || !newPath || oldPath === newPath) return;

    if (expandedPaths.value.has(oldPath)) {
      const next = new Set(expandedPaths.value);
      next.delete(oldPath);
      next.add(newPath);
      expandedPaths.value = next;
    }

    if (selectedPath.value === oldPath) {
      selectedPath.value = newPath;
    }

    // A pending invalidation filed under the old name has to follow the rename,
    // or the tree would re-read the directory that no longer exists.
    const stale: string[] = [];

    if (staleTreePaths.value.has(oldPath)) {
      stale.push(newPath);
    }

    if (loadErrorPaths.value.has(oldPath)) {
      const next = new Set(loadErrorPaths.value);
      next.delete(oldPath);
      next.add(newPath);
      loadErrorPaths.value = next;
    }

    if (stale.length > 0) {
      staleTreePaths.value = new Set(stale);
    }
  }

  function reset(): void {
    selectedPath.value = null;
    expandedPaths.value = new Set();
    loadingPaths.value = new Set();
    loadErrorPaths.value = new Set();
    staleTreePaths.value = new Set();
  }

  return {
    // state
    selectedPath,
    expandedPaths,
    loadingPaths,
    loadErrorPaths,
    staleTreePaths,
    staleTreeRevision,
    // queries
    isExpanded,
    isLoading,
    hasLoadError,
    // mutations
    setSelectedPath,
    toggleExpanded,
    expandPath,
    collapsePath,
    markLoading,
    markLoadError,
    markTreeStale,
    consumeStaleTreePaths,
    handlePathRenamed,
    reset,
  };
});
