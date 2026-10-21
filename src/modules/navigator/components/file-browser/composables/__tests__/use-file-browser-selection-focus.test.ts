// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：连选（Shift+方向键）落地的第三层。
//
// 上游 588165e6 给「连选」加了三层：
//   1) shortcuts store：Shift+方向键仍匹配 navigateUp/Down/Left/Right，并把 event 传给 handler；
//   2) keyboard-navigation：navigateDown(true) 用锚点调用 selectRange；
//   3) selection composable：selectRange 真正算出区间，并维护「锚点 / 键盘光标」两个位置。
//
// 上游自己的测试只覆盖了 1) 和 2) —— 第 2) 层的测试用的是**自己实现的 selectRange 假身**，
// 所以第 3) 层（也就是我们真正写的那部分）在上游是零覆盖的。
// 而第 3) 层是承重的：focusedEntry 不更新的话，Shift+↓ 之后按普通 ↓ 会从锚点而不是
// 从当前光标位置继续跳，用户看到的是「跳回去了」。
// 这个文件补第 3) 层的回归。

import { ref } from 'vue';
import { describe, expect, it, vi } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';

// vue-i18n 要部分 mock：`src/localization/index.ts` 在模块顶层就用了 createI18n，
// 把整个模块换掉会在导入期炸掉，所以只换掉 useI18n。
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

function createEntry(name: string, overrides: Partial<DirEntry> = {}): DirEntry {
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
    ...overrides,
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

  return {
    selection,
    onSelect,
    entriesRef,
  };
}

// jsdom 不保证支持 `:focus-visible` 选择器，这里直接桩掉 matches，
// 只保留 composable 真正关心的那一件事：目标是不是一个 HTMLElement。
function createFocusEvent(): FocusEvent {
  const element = document.createElement('div');
  // `matches` 的标准签名带类型谓词重载，桩函数不满足 —— 这里只需要「是元素、
  // 且 :focus-visible 匹配」这一件事，所以整体断言成原签名。
  element.matches = vi.fn(() => true) as unknown as typeof element.matches;

  return { currentTarget: element } as unknown as FocusEvent & { entry: DirEntry };
}

describe('useFileBrowserSelection 的锚点与键盘光标', () => {
  it('连选把区间内的条目全部选中，并把键盘光标停在区间末尾', () => {
    const first = createEntry('alpha.txt');
    const second = createEntry('beta.png');
    const third = createEntry('gamma.md');
    const { selection } = createHarness([first, second, third]);

    selection.replaceSelection(first);
    selection.selectRange(first, third);

    expect(selection.selectedEntries.value.map(entry => entry.name)).toEqual([
      'alpha.txt',
      'beta.png',
      'gamma.md',
    ]);
    expect(selection.focusedEntry.value?.name).toBe('gamma.md');
  });

  it('连选不会挪走锚点，连按 Shift+方向键才能一直往后扩', () => {
    const first = createEntry('alpha.txt');
    const second = createEntry('beta.png');
    const third = createEntry('gamma.md');
    const { selection } = createHarness([first, second, third]);

    selection.replaceSelection(first);
    selection.selectRange(first, second);
    expect(selection.lastSelectedEntry.value?.name).toBe('alpha.txt');

    selection.selectRange(first, third);
    expect(selection.selectedEntries.value.map(entry => entry.name)).toEqual([
      'alpha.txt',
      'beta.png',
      'gamma.md',
    ]);
    expect(selection.lastSelectedEntry.value?.name).toBe('alpha.txt');
    expect(selection.focusedEntry.value?.name).toBe('gamma.md');
  });

  it('还没有锚点时，连选把起点记成锚点', () => {
    const first = createEntry('alpha.txt');
    const second = createEntry('beta.png');
    const { selection } = createHarness([first, second]);

    selection.selectRange(first, second);

    expect(selection.lastSelectedEntry.value?.name).toBe('alpha.txt');
    expect(selection.focusedEntry.value?.name).toBe('beta.png');
  });

  it('焦点落在已选中的条目上时只挪光标，不清掉已有的选择', () => {
    const first = createEntry('alpha.txt');
    const second = createEntry('beta.png');
    const { selection } = createHarness([first, second]);

    selection.replaceSelection(first);
    selection.selectRange(first, second);
    expect(selection.selectedEntries.value).toHaveLength(2);

    selection.handleEntryFocus(second, createFocusEvent());

    expect(selection.selectedEntries.value.map(entry => entry.name)).toEqual([
      'alpha.txt',
      'beta.png',
    ]);
    expect(selection.focusedEntry.value?.name).toBe('beta.png');
  });

  it('取消选中的正是光标所在条目时，光标退回锚点', () => {
    const first = createEntry('alpha.txt');
    const second = createEntry('beta.png');
    const { selection } = createHarness([first, second]);

    selection.replaceSelection(first);
    selection.selectRange(first, second);
    expect(selection.focusedEntry.value?.name).toBe('beta.png');

    selection.removeFromSelection(second);

    expect(selection.focusedEntry.value?.name).toBe('alpha.txt');
  });

  it('清空选择时锚点与光标一起清掉', () => {
    const first = createEntry('alpha.txt');
    const { selection } = createHarness([first]);

    selection.replaceSelection(first);
    selection.clearSelection();

    expect(selection.selectedEntries.value).toEqual([]);
    expect(selection.lastSelectedEntry.value).toBeNull();
    expect(selection.focusedEntry.value).toBeNull();
  });
});
