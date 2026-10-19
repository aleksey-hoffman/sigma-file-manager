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

// FORK-MODIFICATION: 验收反馈 2026-10-13 — tree-view 加"重命名"后挂载
// FileBrowserRenameDialog，它内部 useI18n() 但本测试没装 vue-i18n plugin。
// stub RenameDialog 掉，避免为一个弹窗把整条 i18n 链拉进来。
vi.mock('../file-browser-rename-dialog.vue', () => ({
  default: {
    name: 'FileBrowserRenameDialog',
    props: ['open', 'entry'],
    emits: ['update:open', 'confirm', 'cancel'],
    template: '<div class="stub-rename-dialog" />',
  },
}));

// FORK-MODIFICATION: 验收反馈 2026-10-13 — tree-view 加"重命名"后引入
// useDirEntryActions，它内部会拉 clipboard / userSettings / Tauri IPC 一整条链。
// 本测试只关心树的渲染 / 点击 / 展开行为，所以整体 mock 掉，只保留 renameItem 形状。
vi.mock('@/composables/use-dir-entry-actions', () => ({
  useDirEntryActions: () => ({
    renameItem: vi.fn().mockResolvedValue(true),
    openEntriesInNewTabs: vi.fn(),
    createNewItem: vi.fn().mockResolvedValue(true),
    pasteItems: vi.fn(),
    conflictDialogState: { isOpen: false, conflicts: [] },
    handleConflictResolution: vi.fn(),
    handleConflictCancel: vi.fn(),
    topLevelNameConflictDialogState: { isOpen: false, conflicts: [] },
    handleTopLevelNameConflictRename: vi.fn(),
    handleTopLevelNameConflictMerge: vi.fn(),
    handleTopLevelNameConflictCancel: vi.fn(),
    permanentDeleteConfirm: {
      isOpen: false,
      pendingEntries: [],
      handleOpenChange: vi.fn(),
      handleConfirm: vi.fn(),
    },
  }),
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

// FORK-MODIFICATION 2026-10-19：目录树「定位到当前目录」的组件层验收。
//
// 用户真机原话：「点击可以展开，但不会定位到当前打开的目录」。
// 渲染出来 ≠ 用户看得到 —— 远程树的深度远大于本地，
// 当前目录往往落在折叠区之外。
//
// jsdom 里 `getBoundingClientRect()` 一律返回全 0，
// 所以这里给 `.file-tree-view` 与每一行**造出真实的坐标**，
// 再断言「滚动容器被滚到了该滚的位置」。
// 滚动量本身的算术在 `tree-reveal.test.ts` 里单独钉住，
// 这里钉的是**接线**：找没找对行、滚没滚对容器、该不该滚。
describe('FileBrowserTreeView — 定位到当前目录（高亮 + 滚动）', () => {
  const CONN = 'e2b24ab525544dc7adeb5cedb192179b';
  const REMOTE_ROOT = `sfm://remote/${CONN}/vol1/@team/study_platform/wp_root`;
  const REMOTE_CWD = `${REMOTE_ROOT}/wp-content`;

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

  /**
   * 给「滚动容器」与「每一行」造出坐标。
   *
   * @param viewportHeight 可视区高度
   * @param rowSpacing     相邻两行的顶边间距（行高固定 24）
   */
  function stubRects(viewportHeight: number, rowSpacing: number): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: Element) {
        // 滚动容器是 `.file-tree-view__scroll`（不是 trigger 的直接子元素，
        // 那个位置上的模板 ref 会被 reka-ui 的 Slot 删掉）。
        if (this.classList.contains('file-tree-view__scroll')) {
          return {
            top: 0,
            left: 0,
            right: 200,
            bottom: viewportHeight,
            width: 200,
            height: viewportHeight,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          } as DOMRect;
        }

        const parent = this.parentElement;
        const index = parent ? Array.from(parent.children).indexOf(this) : 0;
        // ⭐ 行的位置必须**跟着滚动走**：真实浏览器里，容器滚了之后
        // `getBoundingClientRect().top` 减去容器顶边就是「行在可视区里的偏移」。
        // 桩若返回固定值，第二次定位会拿同一个偏移再加一次 —— 滚动量被叠加
        // （124 → 248），测出来的是假象。
        const scrolled = parent ? parent.scrollTop : 0;
        const top = index * rowSpacing - scrolled;

        return {
          top,
          left: 0,
          right: 200,
          bottom: top + 24,
          width: 200,
          height: 24,
          x: 0,
          y: top,
          toJSON: () => ({}),
        } as DOMRect;
      },
    );
  }

  /**
   * jsdom 没有布局，`scrollTop` 写进去读出来还是 0。
   * 这里在元素**上**挂一个自己的属性，把赋值记下来。
   */
  function trackScrollTop(viewport: HTMLElement): { value: number } {
    const tracker = { value: 0 };

    Object.defineProperty(viewport, 'scrollTop', {
      configurable: true,
      get: () => tracker.value,
      set: (v: number) => { tracker.value = v; },
    });

    return tracker;
  }

  async function mountRemoteTree(viewportHeight: number, rowSpacing: number) {
    vi.mocked(resolveDirectoryContents).mockImplementation(async (path: string) => {
      if (path === REMOTE_ROOT) {
        return dirContents(REMOTE_ROOT, [
          entry(REMOTE_CWD, 'wp-content', true),
          entry(`${REMOTE_ROOT}/wp-admin`, 'wp-admin', true),
        ]);
      }

      if (path === REMOTE_CWD) {
        return dirContents(REMOTE_CWD, [
          entry(`${REMOTE_CWD}/mu-plugins`, 'mu-plugins', true),
        ]);
      }

      return dirContents(path, []);
    });

    stubRects(viewportHeight, rowSpacing);

    const store = useFolderTreeStore();
    store.setSelectedPath(REMOTE_CWD);

    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: [REMOTE_ROOT] },
    });

    // ⚠️ 必须在 mount 之后**同步**装上：定位是在异步加载完之后才做的，
    // 而这里要赶在那之前把 scrollTop 的记录器装好。
    const viewport = wrapper.find('.file-tree-view__scroll').element as HTMLElement;
    const scroll = trackScrollTop(viewport);

    await flushPromises();
    await nextTick();

    return {
      store,
      wrapper,
      scroll,
    };
  }

  it('当前目录那一行被高亮（渲染出来 + 选中态）', async () => {
    const { wrapper } = await mountRemoteTree(100, 200);

    const row = wrapper.find(`[data-tree-path="${REMOTE_CWD}"]`);

    expect(row.exists(), '当前目录这一行根本没渲染出来').toBe(true);
    expect(row.classes()).toContain('file-tree-row--selected');

    wrapper.unmount();
  });

  it('当前目录落在可视区之外时，滚动容器被滚到刚好露出它', async () => {
    // 视口高 100、行距 200：当前目录在第 2 行（顶边 200），
    // 底边 224 超出 100 —— 必须滚 224-100=124 才能看见底边。
    const { wrapper, scroll } = await mountRemoteTree(100, 200);

    expect(scroll.value, '当前目录在可视区外，却没有滚动定位').toBe(124);

    wrapper.unmount();
  });

  it('当前目录已经在可视区里时**不滚**（不冲掉用户手动展开的位置）', async () => {
    const { wrapper, scroll } = await mountRemoteTree(400, 100);

    expect(scroll.value, '当前目录本来就在可视区里，不该滚动').toBe(0);

    wrapper.unmount();
  });

  // FORK-MODIFICATION 2026-10-19：定位必须发生在「目标行已经出现」之后。
  //
  // 真实时序（真机装包实测）：焦点刚切到远程格时，树的**根**还停在本地盘符，
  // 远程那一行此刻不在树上；等根切过去、目录读完，行才重新出现。
  // 上一版的定位跑在切根之前 —— 那一刻目标行要么不存在、要么是被临时立起来的
  // 并列根，于是「展开到了当前目录，却没滚过去」。
  it('目标行晚出现时也要再定位一次（根晚一步切到远程树）', async () => {
    vi.mocked(resolveDirectoryContents).mockImplementation(async (path: string) => {
      if (path === REMOTE_ROOT) {
        return dirContents(REMOTE_ROOT, [
          entry(REMOTE_CWD, 'wp-content', true),
        ]);
      }

      if (path === REMOTE_CWD) {
        return dirContents(REMOTE_CWD, [
          entry(`${REMOTE_CWD}/mu-plugins`, 'mu-plugins', true),
        ]);
      }

      return dirContents(path, []);
    });

    stubRects(100, 200);

    const store = useFolderTreeStore();

    store.setSelectedPath(REMOTE_CWD);

    // 先用**两个**本地盘符当根：远程那一行此刻被临时立成并列的根，
    // 落在下标 2 —— 与它后来在远程树里的下标 1 不同。
    // 这样「定位过一次」和「定位到了正确的那一行」就能被区分开。
    const wrapper = mount(FileBrowserTreeView, {
      props: { rootPaths: ['C:/', 'D:/'] },
    });
    const viewport = wrapper.find('.file-tree-view__scroll').element as HTMLElement;
    const scroll = trackScrollTop(viewport);

    await flushPromises();
    await nextTick();

    // 根切到远程树：并列的根被丢掉，远程那一行要重新读出来才会再出现。
    await wrapper.setProps({ rootPaths: [REMOTE_ROOT] });
    await flushPromises();
    await nextTick();

    // 远程树里：速豹堂(0) / wp-content(1) / mu-plugins(2)。
    // wp-content 在下标 1 → 绝对位置 200、行高 24、视口高 100 →
    // 它完全可见的滚动区间是 [200+24-100, 200] = [124, 200]。
    //
    // 修好之前：定位停在「并列根」那次的旧值 324（那一行早就不在树上了），
    // 落在区间外 → 树展开到了当前目录，却没滚过去。
    expect(
      scroll.value,
      '目标行晚出现时没有重新定位 —— 树展开到了当前目录，却没滚过去',
    ).toBeGreaterThanOrEqual(124);
    expect(scroll.value).toBeLessThanOrEqual(200);

    wrapper.unmount();
  });
});
