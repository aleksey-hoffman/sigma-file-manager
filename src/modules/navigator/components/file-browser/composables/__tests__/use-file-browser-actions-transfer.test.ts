// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-26：右键「上传到远程 / 下载到本地」的**接线**。
//
// 2026-10-20 那一版的接线测的是「传输完通知对面那一格刷新」；
// 2026-10-26 起，传输逻辑整体搬进了 `remote-transfer-service`
// （冲突确认 + 进度条 + 失败/跳过原因），通知也归它管。
// 于是分工变成：
//
// - **这里**：右键菜单项 → 服务层的**参数**对不对（目标目录、条目列表）。
// - `remote-transfer-service.test.ts`：服务层自己的行为
//   （冲突预检、覆盖名单、进度、通知、失败原因）。
//
// 「传输完通知对面那一格刷新」的语义本身在
// `remote-transfer-refresh.test.ts` 里测。
//

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { computed, ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

const {
  downloadItemsFromRemoteMock,
  uploadItemsToRemoteMock,
} = vi.hoisted(() => {
  return {
    downloadItemsFromRemoteMock: vi.fn(),
    uploadItemsToRemoteMock: vi.fn(),
  };
});

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => ({
    currentPlatform: 'windows',
    isWindows: true,
  }),
}));

vi.mock('@/stores/runtime/quick-view', () => ({
  quickViewSupportedPathsFromVisibleEntries: () => [],
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: vi.fn(),
    custom: vi.fn(),
  },
  ToastStatic: class ToastStatic {},
}));

vi.mock('@/utils/open-native-properties', () => ({
  openNativeProperties: vi.fn(),
}));

vi.mock('@/utils/open-in-explorer', () => ({
  revealInExplorer: vi.fn(),
}));

vi.mock('@/utils/open-navigator-directory', () => ({
  openNavigatorRevealEntry: vi.fn(),
}));

vi.mock('@/modules/remote/utils/remote-permissions-dialog-state', () => ({
  openRemotePermissionsDialog: vi.fn(),
}));

vi.mock('@/modules/remote/utils/remote-transfer-service', () => ({
  uploadItemsToRemote: uploadItemsToRemoteMock,
  downloadItemsFromRemote: downloadItemsFromRemoteMock,
}));

const { useFileBrowserActions } = await import('../use-file-browser-actions');
const { setRemoteTransferTargets } = await import('@/modules/remote/utils/remote-transfer-targets');

const LOCAL_DIR = 'C:/Users/Duanyi/afm-acceptance';
const REMOTE_DIR = 'sfm://remote/conn-1/vol1/team/upgrade';

function makeEntry(path: string, name: string, isDir: boolean): DirEntry {
  return {
    name,
    ext: null,
    path,
    size: 12,
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

function createActions(selectedEntries: DirEntry[]) {
  const contextMenu = ref({
    targetEntry: selectedEntries[0] ?? null,
    selectedEntries,
  });
  const selected = ref<DirEntry[]>(selectedEntries);

  const actions = useFileBrowserActions({
    contextMenu,
    selectedEntries: selected,
    visibleEntries: computed(() => selectedEntries),
    quickViewStore: {
      toggleQuickView: vi.fn(),
      openPrintViewFromMainWindow: vi.fn(),
    },
    handleContextMenuAction: vi.fn(),
    openOpenWithDialog: vi.fn(),
    handleEntryMouseDown: vi.fn(),
    handleEntryMouseUp: vi.fn(),
  });

  return actions;
}

describe('右键「上传到远程 / 下载到本地」的接线', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadItemsToRemoteMock.mockResolvedValue(true);
    downloadItemsFromRemoteMock.mockResolvedValue(true);
    // 左本地、右远程 —— 与导航器分屏时登记的顺序一致。
    setRemoteTransferTargets([LOCAL_DIR, REMOTE_DIR]);
  });

  it('上传到远程 → 目标是**远程**那一格当前所在的目录', async () => {
    const actions = createActions([
      makeEntry(`${LOCAL_DIR}/b.txt`, 'b.txt', false),
    ]);

    actions.onContextMenuAction('upload-to-remote');

    await vi.waitFor(() => {
      expect(uploadItemsToRemoteMock).toHaveBeenCalled();
    });

    const [items, target] = uploadItemsToRemoteMock.mock.calls[0];

    expect(target).toBe(REMOTE_DIR);
    expect(items).toEqual([
      {
        path: `${LOCAL_DIR}/b.txt`,
        name: 'b.txt',
        isDirectory: false,
        size: 12,
      },
    ]);
  });

  it('下载到本地 → 目标是**本地**那一格当前所在的目录', async () => {
    const actions = createActions([
      makeEntry(`${REMOTE_DIR}/a.txt`, 'a.txt', false),
    ]);

    actions.onContextMenuAction('download-to-local');

    await vi.waitFor(() => {
      expect(downloadItemsFromRemoteMock).toHaveBeenCalled();
    });

    const [items, target] = downloadItemsFromRemoteMock.mock.calls[0];

    expect(target).toBe(LOCAL_DIR);
    expect(items).toEqual([
      {
        path: `${REMOTE_DIR}/a.txt`,
        name: 'a.txt',
        isDirectory: false,
        size: 12,
      },
    ]);
  });

  it('多选时整批一次交给服务层（不是逐个调用）', async () => {
    const actions = createActions([
      makeEntry(`${LOCAL_DIR}/b.txt`, 'b.txt', false),
      makeEntry(`${LOCAL_DIR}/dir`, 'dir', true),
    ]);

    actions.onContextMenuAction('upload-to-remote');

    await vi.waitFor(() => {
      expect(uploadItemsToRemoteMock).toHaveBeenCalledTimes(1);
    });

    expect(uploadItemsToRemoteMock.mock.calls[0][0]).toHaveLength(2);
  });

  it('没有对面那一格 → 什么都不做（菜单项压根不该出现）', async () => {
    setRemoteTransferTargets([]);

    const actions = createActions([
      makeEntry(`${LOCAL_DIR}/b.txt`, 'b.txt', false),
    ]);

    actions.onContextMenuAction('upload-to-remote');

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(uploadItemsToRemoteMock).not.toHaveBeenCalled();
  });
});
