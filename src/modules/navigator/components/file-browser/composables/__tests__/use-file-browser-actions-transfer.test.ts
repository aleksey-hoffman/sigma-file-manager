// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-20：传输结束后通知「目标那一格」刷新。
//
// 用户反馈：远程文件点「下载到本地」之后，本地那一格没有立刻出现新下载的文件；
// 上传同理。
//
// 这条用例盯的是**接线**：动作执行完，通知发出去，且路径是**对面那一格**
// 当前所在的目录（下载 → 本地目录；上传 → 远程目录）。
// 通知本身的语义在 `remote-transfer-refresh.test.ts` 里测；
// 「这一格收到通知之后刷新自己」在 `use-remote-transfer-refresh.test.ts` 里测。
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
  downloadFromRemoteMock,
  uploadToRemoteMock,
  notifyMock,
} = vi.hoisted(() => {
  return {
    downloadFromRemoteMock: vi.fn(),
    uploadToRemoteMock: vi.fn(),
    notifyMock: vi.fn(),
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

vi.mock('@/utils/remote-directory', () => ({
  describeRemoteError: (error: unknown) => String(error),
}));

vi.mock('@/modules/remote/utils/remote-transfer', () => ({
  downloadFromRemote: downloadFromRemoteMock,
  uploadToRemote: uploadToRemoteMock,
}));

vi.mock('@/modules/remote/utils/remote-transfer-refresh', async () => {
  const actual = await vi.importActual<typeof import('@/modules/remote/utils/remote-transfer-refresh')>(
    '@/modules/remote/utils/remote-transfer-refresh',
  );

  return {
    ...actual,
    notifyRemoteTransferCompleted: notifyMock,
  };
});

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

function emptyReport(overrides: Record<string, unknown> = {}) {
  return {
    transferred_files: 0,
    transferred_dirs: 0,
    total_bytes: 0,
    skipped: [],
    failures: [],
    ...overrides,
  };
}

describe('传输结束后通知目标那一格刷新', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 左本地、右远程 —— 与导航器分屏时登记的顺序一致。
    setRemoteTransferTargets([LOCAL_DIR, REMOTE_DIR]);
  });

  it('下载到本地 → 通知的是**本地**那一格当前所在的目录', async () => {
    downloadFromRemoteMock.mockResolvedValue(emptyReport({ transferred_files: 1 }));

    const actions = createActions([
      makeEntry(`${REMOTE_DIR}/a.txt`, 'a.txt', false),
    ]);

    actions.onContextMenuAction('download-to-local');

    await vi.waitFor(() => {
      expect(downloadFromRemoteMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(LOCAL_DIR);
    });

    expect(downloadFromRemoteMock).toHaveBeenCalledWith(`${REMOTE_DIR}/a.txt`, LOCAL_DIR);
  });

  it('上传到远程 → 通知的是**远程**那一格当前所在的目录', async () => {
    uploadToRemoteMock.mockResolvedValue(emptyReport({ transferred_files: 1 }));

    const actions = createActions([
      makeEntry(`${LOCAL_DIR}/b.txt`, 'b.txt', false),
    ]);

    actions.onContextMenuAction('upload-to-remote');

    await vi.waitFor(() => {
      expect(uploadToRemoteMock).toHaveBeenCalled();
    });
    await vi.waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(REMOTE_DIR);
    });

    expect(uploadToRemoteMock).toHaveBeenCalledWith(`${LOCAL_DIR}/b.txt`, REMOTE_DIR);
  });

  it('下载目录同样通知（目录是递归传的，落地后目标目录内容变了）', async () => {
    downloadFromRemoteMock.mockResolvedValue(emptyReport({ transferred_dirs: 3 }));

    const actions = createActions([
      makeEntry(`${REMOTE_DIR}/dir`, 'dir', true),
    ]);

    actions.onContextMenuAction('download-to-local');

    await vi.waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(LOCAL_DIR);
    });
  });

  it('目标已存在而跳过 → 不通知（目录内容没变，刷新只是白读一次盘）', async () => {
    downloadFromRemoteMock.mockResolvedValue(emptyReport({ skipped: ['a.txt'] }));

    const actions = createActions([
      makeEntry(`${REMOTE_DIR}/a.txt`, 'a.txt', false),
    ]);

    actions.onContextMenuAction('download-to-local');

    await vi.waitFor(() => {
      expect(downloadFromRemoteMock).toHaveBeenCalled();
    });
    // 等一轮微任务，确认没有迟到的通知
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('传输失败 → 仍然通知（目录上传是递归的，可能已经写进去一部分）', async () => {
    downloadFromRemoteMock.mockRejectedValue({
      kind: 'permission',
      message: '拒绝',
    });

    const actions = createActions([
      makeEntry(`${REMOTE_DIR}/a.txt`, 'a.txt', false),
    ]);

    actions.onContextMenuAction('download-to-local');

    await vi.waitFor(() => {
      expect(notifyMock).toHaveBeenCalledWith(LOCAL_DIR);
    });
  });
});
