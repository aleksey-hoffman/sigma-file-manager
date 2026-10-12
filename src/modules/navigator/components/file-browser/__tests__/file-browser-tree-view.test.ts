// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: integration test for file-browser-tree-view + folder-tree store.
// Tracking issue: aleksey-hoffman/sigma-file-manager#499
//
// Replaces the v5 `use-file-tree-prop-sync.test.ts` which tested an
// imperative "parent calls child.expandToPath" chain that was unfixable in
// v0..v5 (see handoff-2026-09-26-tree-sync-retro.md). The new architecture is
// store-driven: navigator writes `selectedPath`, tree-view subscribes via
// `storeToRefs`, useFileTree's watch on `expandedPaths` lazy-loads. No
// template ref, no parent→child imperative call.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  flushPromises,
  mount,
  type VueWrapper,
} from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import FileBrowserTreeView from '@/modules/navigator/components/file-browser/file-browser-tree-view.vue';
import {
  computeAncestorPaths,
  useFolderTreeStore,
} from '@/stores/runtime/folder-tree';
import { resolveDirectoryContents } from '@/utils/virtual-locations';
import type { DirContents, DirEntry } from '@/types/dir-entry';

vi.mock('@/utils/virtual-locations', () => ({
  resolveDirectoryContents: vi.fn(),
}));

// Stub the Tauri IPC entry that resolveDirectoryContents uses in production.
// In jsdom there is no window.__TAURI__ so reading `.invoke` throws — we
// surface that as a controlled "permission denied" so we can assert the
// store's loadErrorPaths handling without spinning up Tauri.
beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // FORK-MODIFICATION: tree-view 引入 useClipboardStore → user-settings → useTheme.init()
  // 会调 window.matchMedia。jsdom 没默认实现，按项目惯例（见 user-settings.test.ts）补桩。
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
});

describe('FileBrowserTreeView (store-driven sync)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the initial root path row', async () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/work');

    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/work'] },
    });
    await nextTick();

    const rows = wrapper.findAll('[data-tree-path]');
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].attributes('data-tree-path')).toBe('C:/work');
    wrapper.unmount();
  });

  it('store.setSelectedPath auto-expands the full chain (drive → selectedPath)', () => {
    const store = useFolderTreeStore();
    store.setSelectedPath('C:/Users/foo');

    expect(computeAncestorPaths('C:/Users/foo')).toEqual(['C:/', 'C:/Users']);
    // v6.2 policy: chain from drive root down to AND INCLUDING selectedPath.
    expect(store.isExpanded('C:/')).toBe(true);
    expect(store.isExpanded('C:/Users')).toBe(true);
    expect(store.isExpanded('C:/Users/foo')).toBe(true);
  });

  it('clicking a directory row emits `activate` (name click → navigate only)', async () => {
    // v6.3 contract: clicking the row body (or name) emits `activate` so
    // the parent navigates. It does NOT toggle expansion directly —
    // setSelectedPath's replace-ancestors policy handles expansion.
    const store = useFolderTreeStore();
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/work'] },
    });
    await nextTick();

    const row = wrapper.find('[data-tree-path="C:/work"]');
    expect(row.exists()).toBe(true);

    await row.trigger('click');

    expect(wrapper.emitted('activate')?.[0]).toEqual(['C:/work']);
    expect(store.isExpanded('C:/work')).toBe(false);

    wrapper.unmount();
  });

  it('clicking the chevron toggles expandedPaths without emitting `activate`', async () => {
    // v6.3: the chevron is a dedicated expand/collapse affordance — clicking
    // it expands/collapses without changing the current path.
    const store = useFolderTreeStore();
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/work'] },
    });
    await nextTick();

    const chevron = wrapper.find('.file-tree-row__chevron');
    expect(chevron.exists()).toBe(true);

    await chevron.trigger('click');
    expect(store.isExpanded('C:/work')).toBe(true);
    expect(wrapper.emitted('activate')).toBeUndefined();

    // Collapse
    await chevron.trigger('click');
    expect(store.isExpanded('C:/work')).toBe(false);
    expect(wrapper.emitted('activate')).toBeUndefined();

    wrapper.unmount();
  });

  it('selected path renders with the `selected` class (highlight)', async () => {
    const store = useFolderTreeStore();
    store.expandPath('C:/work');

    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/work'] },
    });
    store.setSelectedPath('C:/work');
    await nextTick();
    await nextTick();

    const row = wrapper.find('[data-tree-path="C:/work"]');
    expect(row.exists()).toBe(true);
    expect(row.classes()).toContain('file-tree-row--selected');
    expect(row.attributes('data-selected')).toBe('true');

    wrapper.unmount();
  });

  it('load failure marks the row as error (UI still renders the row)', async () => {
    // Regression guard for handoff §8.3: when a directory's children fail
    // to load, the row stays visible with an error marker (not just an
    // empty row). Mark the error on the store AFTER mount so the watch's
    // onLoadStart (which clears loadErrorPaths) doesn't overwrite it, then
    // verify the row class binding reacts.
    const store = useFolderTreeStore();
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/locked'] },
    });
    await nextTick();
    await nextTick();
    // Wait for any post-mount ensureLoaded to settle, then mark the error.
    store.markLoadError('C:/locked', true);
    await nextTick();
    await nextTick();

    expect(store.hasLoadError('C:/locked')).toBe(true);

    const row = wrapper.find('[data-tree-path="C:/locked"]');
    expect(row.exists()).toBe(true);
    expect(row.classes()).toContain('file-tree-row--error');

    wrapper.unmount();
  });
});

describe('FileBrowserTreeView — filesystem mutation reaches the tree (v6.5)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.mocked(resolveDirectoryContents).mockReset();
  });

  function entry(path: string, name: string, isDir: boolean): DirEntry {
    return {
      name,
      ext: null,
      path,
      size: 0,
      item_count: null,
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
      mime: null,
      is_file: !isDir,
      is_dir: isDir,
      is_symlink: false,
      is_hidden: false,
    };
  }

  function dirContents(path: string, entries: DirEntry[]): DirContents {
    return {
      path,
      entries,
      total_count: entries.length,
      dir_count: entries.filter(e => e.is_dir).length,
      file_count: entries.filter(e => !e.is_dir).length,
      opened_directory_times: {
        modified_time: 0,
        accessed_time: 0,
        created_time: 0,
      },
    };
  }

  /** Mount with the given roots, backed by a mutable fake filesystem. */
  async function mountWithFakeFs(rootPaths: string[], contents: Record<string, DirEntry[]>) {
    vi.mocked(resolveDirectoryContents).mockImplementation(async (path: string) => {
      return dirContents(path, contents[path] ?? []);
    });

    const store = useFolderTreeStore();
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths },
    });
    await flushPromises();

    return {
      store,
      wrapper,
    };
  }

  function renderedPaths(wrapper: VueWrapper): (string | undefined)[] {
    return wrapper.findAll('[data-tree-path]').map(r => r.attributes('data-tree-path'));
  }

  it('a folder created inside an expanded directory appears without re-expanding', async () => {
    // The reported bug, end to end: create a folder in an expanded directory
    // and the tree never showed it, because nothing could invalidate the
    // tree's per-directory children cache.
    const contents: Record<string, DirEntry[]> = {
      'C:/work': [entry('C:/work/a.md', 'a.md', false)],
    };
    const { store, wrapper } = await mountWithFakeFs(['C:/work'], contents);

    store.expandPath('C:/work');
    await flushPromises();
    expect(renderedPaths(wrapper)).toEqual(['C:/work', 'C:/work/a.md']);

    // A file browser pane creates a folder, then publishes the changed dir.
    contents['C:/work'].push(entry('C:/work/fresh', 'fresh', true));
    store.markTreeStale(['C:/work']);
    await flushPromises();

    // Never collapsed, never re-expanded by hand.
    expect(store.isExpanded('C:/work')).toBe(true);
    expect(renderedPaths(wrapper)).toEqual(['C:/work', 'C:/work/a.md', 'C:/work/fresh']);

    wrapper.unmount();
  });

  it('a deleted folder disappears from the expanded directory', async () => {
    // The same dead cache also pinned deleted entries on screen.
    const contents: Record<string, DirEntry[]> = {
      'C:/work': [entry('C:/work/doomed', 'doomed', true)],
    };
    const { store, wrapper } = await mountWithFakeFs(['C:/work'], contents);

    store.expandPath('C:/work');
    await flushPromises();
    expect(renderedPaths(wrapper)).toEqual(['C:/work', 'C:/work/doomed']);

    contents['C:/work'] = [];
    store.markTreeStale(['C:/work']);
    await flushPromises();

    expect(renderedPaths(wrapper)).toEqual(['C:/work']);

    wrapper.unmount();
  });

  it('picks up an invalidation published while the tree panel was unmounted', async () => {
    // navigator.vue mounts the tree under v-if="showFolderTree", so an
    // invalidation can be published with no consumer listening.
    const contents: Record<string, DirEntry[]> = {
      'C:/work': [entry('C:/work/seen.txt', 'seen.txt', false)],
    };
    vi.mocked(resolveDirectoryContents).mockImplementation(async (path: string) => {
      return dirContents(path, contents[path] ?? []);
    });

    const store = useFolderTreeStore();
    store.markTreeStale(['C:/work']); // nothing is mounted yet
    expect(store.staleTreePaths.size).toBe(1);

    store.expandPath('C:/work');
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/work'] },
    });
    await flushPromises();

    // The mount consumed it, and the directory really was re-read.
    expect(store.consumeStaleTreePaths()).toEqual([]);
    expect(vi.mocked(resolveDirectoryContents).mock.calls.map(c => c[0])).toContain('C:/work');
    expect(renderedPaths(wrapper)).toEqual(['C:/work', 'C:/work/seen.txt']);
    // Two reads here, and that is deliberate: the immediate expansion watcher
    // starts a read on mount, and that read may have started *before* the
    // mutation the pending invalidation represents — so it must be re-read
    // rather than trusted. Collapse-and-re-expand does NOT have this problem,
    // which is why the two tests above see exactly one extra read.

    wrapper.unmount();
  });
});
