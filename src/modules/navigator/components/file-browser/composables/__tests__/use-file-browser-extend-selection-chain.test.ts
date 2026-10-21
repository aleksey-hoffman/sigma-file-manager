// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-21：连选（Shift+方向键）的**整链**回归。
//
// 上一轮真机验收的现象：点中 a-alpha.txt 后连按 Shift+↓ 两次，
// 结果选中的是 {a, c} —— 既不是 {a, b, c}（连选生效），
// 也不是 {c}（连选没触发）。这个组合是「连选触发了，但区间算错了」。
//
// 这个文件把**真实的两层**串起来跑：
//   useFileBrowserSelection（真的 selectRange / focusedEntry / lastSelectedEntry）
//     + useFileBrowserKeyboardNavigation（真的 navigateDown(true)）
// 上游 588165e6 的测试只跑第 2 层，而且第 2 层用的是**假 selectRange**，
// 所以「锚点 → 区间」这一段在上游是零覆盖的。

import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

vi.mock('vue-i18n', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-i18n')>();

  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    openNewTabGroup: vi.fn(),
    handleDirectoryContentsChanged: vi.fn(),
    handlePathRenamed: vi.fn(),
    handlePathsDeleted: vi.fn(),
  }),
}));

vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => ({
    isFavorite: vi.fn(() => false),
    removeFromFavorites: vi.fn(),
    handlePathRenamed: vi.fn(),
    handlePathsDeleted: vi.fn(),
  }),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    handlePathRenamed: vi.fn(),
    handlePathsDeleted: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/clipboard', () => ({
  useClipboardStore: () => ({
    setClipboard: vi.fn(),
    readSystemClipboardFiles: vi.fn(),
    pasteSystemClipboardImage: vi.fn(),
    discardClipboard: vi.fn(),
    hasFileItems: false,
    clipboardItems: [],
    isCopyOperation: true,
  }),
}));

vi.mock('@/stores/runtime/dir-sizes', () => ({
  useDirSizesStore: () => ({
    invalidate: vi.fn(),
    refreshSizesAfterCopyMove: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/link-metadata', () => ({
  useLinkMetadataStore: () => ({
    invalidate: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/delete-jobs', () => ({
  useDeleteJobsStore: () => ({
    startJob: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/folder-tree', () => ({
  useFolderTreeStore: () => ({
    markTreeStale: vi.fn(),
    handlePathRenamed: vi.fn(),
  }),
  parentDirectoryPath: (path: string) => path,
}));

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => ({
    currentPlatform: 'windows',
    isWindows: true,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }),
  ToastProgress: class {},
  ToastStatic: class {},
}));

vi.mock('@/composables/use-lan-share', () => ({
  useLanShare: () => ({ startShare: vi.fn() }),
}));

vi.mock('@/composables/use-copy-move-with-conflicts', () => ({
  useCopyMoveWithConflicts: () => ({
    performCopyMoveWithConflicts: vi.fn(),
    conflictDialogState: ref(null),
    handleConflictResolution: vi.fn(),
    handleConflictCancel: vi.fn(),
    topLevelNameConflictDialogState: ref(null),
    handleTopLevelNameConflictRename: vi.fn(),
    handleTopLevelNameConflictMerge: vi.fn(),
    handleTopLevelNameConflictCancel: vi.fn(),
  }),
}));

vi.mock('@/composables/use-permanent-delete-confirm', () => ({
  usePermanentDeleteConfirm: () => ({
    requestConfirm: vi.fn(),
  }),
}));

vi.mock('@/modules/remote/utils/remote-delete-confirm', () => ({
  useRemoteDeleteConfirm: () => ({
    requestConfirm: vi.fn(),
  }),
}));

vi.mock('@/modules/remote/utils/remote-delete', () => ({
  deleteRemoteEntries: vi.fn(),
}));

vi.mock('@/modules/remote/utils/remote-write', () => ({
  createRemoteDirectory: vi.fn(),
  hasRemoteTarget: vi.fn(() => false),
  renameRemoteEntry: vi.fn(),
}));

vi.mock('@/utils/disconnect-drive', () => ({
  disconnectDriveForEntry: vi.fn(),
}));

vi.mock('@/modules/home/composables/use-drives', () => ({
  refreshDrives: vi.fn(),
}));

import { useFileBrowserSelection } from '../use-file-browser-selection';
import { useFileBrowserKeyboardNavigation } from '../use-file-browser-keyboard-navigation';

function createEntry(name: string): DirEntry {
  return {
    name,
    ext: name.split('.').pop() ?? '',
    path: `C:/Dir/${name}`,
    size: 10,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: 'text/plain',
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    link_type: null,
    link_target: null,
    link_status: null,
    hard_link_count: null,
  };
}

function createHarness(entries: DirEntry[]) {
  const entriesRef = ref<DirEntry[]>(entries);
  const currentPathRef = ref('C:/Dir');
  const onSelect = vi.fn();

  const selection = useFileBrowserSelection(
    entriesRef,
    currentPathRef,
    onSelect,
    vi.fn(),
    vi.fn(),
    vi.fn(),
    vi.fn(),
    () => 'list',
  );

  const keyboardNav = useFileBrowserKeyboardNavigation({
    entries: entriesRef,
    selectedEntries: selection.selectedEntries,
    lastSelectedEntry: selection.lastSelectedEntry,
    focusedEntry: selection.focusedEntry,
    layout: () => 'list',
    selectEntryByPath: selection.selectEntryByPath,
    selectRange: selection.selectRange,
    goBack: vi.fn(),
    openEntry: vi.fn(),
    entriesContainerRef: ref(null),
  });

  return {
    selection,
    keyboardNav,
    entriesRef,
    onSelect,
  };
}

/**
 * 把条目变成真的 DOM 行，并让焦点事件走回 selection 的 handleEntryFocus。
 *
 * 真机上 Shift+↓ 之后会调用 element.focus()，焦点事件随即打到那一行上；
 * jsdom 里没有这一步，所以「连选 → 焦点事件 → 选择被改写」这条链在
 * 只做纯函数调用的测试里根本不会出现。
 */
function mountRows(entries: DirEntry[], selection: ReturnType<typeof useFileBrowserSelection>) {
  const container = document.createElement('div');
  document.body.appendChild(container);

  const elements = new Map<string, HTMLElement>();

  for (const entry of entries) {
    const element = document.createElement('div');
    element.setAttribute('data-entry-path', entry.path);
    element.tabIndex = 0;
    // jsdom 不支持 :focus-visible，这里桩成「匹配」。
    element.matches = vi.fn(() => true) as unknown as typeof element.matches;
    element.addEventListener('focus', () => {
      selection.handleEntryFocus(entry, { currentTarget: element } as unknown as FocusEvent);
    });
    container.appendChild(element);
    elements.set(entry.path, element);
  }

  return {
    container,
    getEntryElement: (path: string) => elements.get(path) ?? null,
  };
}

function names(entries: DirEntry[]): string[] {
  return entries.map(entry => entry.name);
}

describe('连选的整链：selection + keyboard navigation', () => {
  it('点中第一条之后连按两次 Shift+↓，选中的是区间内的三条', () => {
    const a = createEntry('a-alpha.txt');
    const b = createEntry('b-beta.txt');
    const c = createEntry('c-gamma.txt');
    const { selection, keyboardNav } = createHarness([a, b, c]);

    // 点击 a-alpha.txt（真机上的那一步）
    selection.replaceSelection(a);
    expect(names(selection.selectedEntries.value)).toEqual(['a-alpha.txt']);

    // Shift+↓ 两次
    keyboardNav.navigateDown(true);
    keyboardNav.navigateDown(true);

    expect(names(selection.selectedEntries.value)).toEqual([
      'a-alpha.txt',
      'b-beta.txt',
      'c-gamma.txt',
    ]);
  });

  it('不按 Shift 的方向键是「替换选择」', () => {
    const a = createEntry('a-alpha.txt');
    const b = createEntry('b-beta.txt');
    const c = createEntry('c-gamma.txt');
    const { selection, keyboardNav } = createHarness([a, b, c]);

    selection.replaceSelection(a);
    keyboardNav.navigateDown(false);

    expect(names(selection.selectedEntries.value)).toEqual(['b-beta.txt']);
  });

  it('带真实 DOM 行时，连选后焦点事件不会把选择改掉', async () => {
    const a = createEntry('a-alpha.txt');
    const b = createEntry('b-beta.txt');
    const c = createEntry('c-gamma.txt');
    const entries = [a, b, c];
    const { selection } = createHarness(entries);
    const rows = mountRows(entries, selection);

    // 用带真实 DOM 行的 keyboard nav 重跑一遍
    const domNav = useFileBrowserKeyboardNavigation({
      entries: ref(entries),
      selectedEntries: selection.selectedEntries,
      lastSelectedEntry: selection.lastSelectedEntry,
      focusedEntry: selection.focusedEntry,
      layout: () => 'list',
      selectEntryByPath: selection.selectEntryByPath,
      selectRange: selection.selectRange,
      goBack: vi.fn(),
      openEntry: vi.fn(),
      scrollToPath: async () => true,
      getEntryElement: rows.getEntryElement,
      entriesContainerRef: ref(null),
    });

    selection.replaceSelection(a);
    domNav.navigateDown(true);
    await new Promise(resolve => setTimeout(resolve, 0));
    domNav.navigateDown(true);
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(names(selection.selectedEntries.value)).toEqual([
      'a-alpha.txt',
      'b-beta.txt',
      'c-gamma.txt',
    ]);
  });
});
