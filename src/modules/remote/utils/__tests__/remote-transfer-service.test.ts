// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-26：远程传输**编排层**的行为门禁。
//
// 这道门禁盯的是 2026-10-26 真机验收发现的三个缺陷：
//
// 1. **失败没有原因** —— 后端一直带着 `failures`，界面上只显示
//    「上传了 0 个文件」。现在失败条目必须被逐条取出来（路径 + 原因）。
//
// 2. **远端同名文件被静默跳过** —— 旧策略是「目标已存在就不传」。
//    现在先问一句「要不要覆盖」，而且这一次问的决定对**整批**生效。
//
// 3. **粘到远程面板报 `Destination path does not exist`** ——
//    旧实现把 `sfm://remote/...` 丢给本地复制引擎。
//    现在这一趟必须由远程通道自己吃掉，**绝不能落回本地复制**。
//
// 每条用例都带**阴性对照**：不满足条件时，确认那一侧**没有**被调用，
// 否则「什么都没发生」和「正确地跳过了」会长得一模一样。
//

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

const {
  invokeMock,
  listenMock,
  showConflictMock,
  openProgressMock,
  finishProgressMock,
  failProgressMock,
  updateProgressMock,
  notifyMock,
  toastCustomMock,
  toastSuccessMock,
} = vi.hoisted(() => {
  return {
    invokeMock: vi.fn<(command: string, payload?: unknown) => Promise<unknown>>(),
    listenMock: vi.fn(),
    showConflictMock: vi.fn(),
    openProgressMock: vi.fn(),
    finishProgressMock: vi.fn(),
    failProgressMock: vi.fn(),
    updateProgressMock: vi.fn(),
    notifyMock: vi.fn(),
    toastCustomMock: vi.fn(),
    toastSuccessMock: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

vi.mock('@/utils/unique-id', () => ({
  default: () => 'job-1',
}));

vi.mock('@/utils/remote-directory', () => ({
  describeRemoteError: (error: unknown) => String(error),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
    success: toastSuccessMock,
    custom: toastCustomMock,
  },
  ToastStatic: class ToastStatic {},
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

vi.mock('@/modules/remote/utils/remote-transfer-state', async () => {
  const actual = await vi.importActual<typeof import('@/modules/remote/utils/remote-transfer-state')>(
    '@/modules/remote/utils/remote-transfer-state',
  );

  return {
    ...actual,
    showRemoteTransferConflictDialog: showConflictMock,
    openRemoteTransferProgress: openProgressMock,
    finishRemoteTransferProgress: finishProgressMock,
    failRemoteTransferProgress: failProgressMock,
    updateRemoteTransferProgress: updateProgressMock,
  };
});

const {
  handleRemotePaste,
  uploadItemsToRemote,
  downloadItemsFromRemote,
  remoteTransferItemsFromPaths,
  toRemoteTransferItems,
} = await import('../remote-transfer-service');

const REMOTE_DIR = 'sfm://remote/conn-1/var/www/wordpress';

interface InvokeCall {
  command: string;
  payload: Record<string, unknown>;
}

function callsTo(command: string): InvokeCall[] {
  return invokeMock.mock.calls
    .filter(call => call[0] === command)
    .map(call => ({
      command: call[0],
      payload: (call[1] ?? {}) as Record<string, unknown>,
    }));
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

/** 远端目录里已经有的名字。 */
function remoteDirWith(names: string[]) {
  invokeMock.mockImplementation(async (command: string) => {
    if (command === 'remote_read_dir') {
      return {
        path: REMOTE_DIR,
        entries: names.map(name => ({
          name,
          ext: null,
          path: `${REMOTE_DIR}/${name}`,
          size: 1,
          item_count: null,
          modified_time: 0,
          accessed_time: 0,
          created_time: 0,
          mime: null,
          is_file: true,
          is_dir: false,
          is_symlink: false,
          is_hidden: false,
        })),
        total_count: names.length,
        dir_count: 0,
        file_count: names.length,
        opened_directory_times: {
          modified_time: 0,
          accessed_time: 0,
          created_time: 0,
        },
      };
    }

    return emptyReport();
  });
}

function localDirWith(names: string[]) {
  invokeMock.mockImplementation(async (command: string) => {
    if (command === 'read_dir') {
      return {
        path: 'C:/target',
        entries: names.map(name => ({
          name,
          ext: null,
          path: `C:/target/${name}`,
          size: 1,
          item_count: null,
          modified_time: 0,
          accessed_time: 0,
          created_time: 0,
          mime: null,
          is_file: true,
          is_dir: false,
          is_symlink: false,
          is_hidden: false,
        })),
        total_count: names.length,
        dir_count: 0,
        file_count: names.length,
        opened_directory_times: {
          modified_time: 0,
          accessed_time: 0,
          created_time: 0,
        },
      };
    }

    return emptyReport();
  });
}

function uploadItem(path: string, name: string) {
  return {
    path,
    name,
    isDirectory: false,
    size: 10,
  };
}

describe('远程传输编排层', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invokeMock.mockResolvedValue(emptyReport());
    listenMock.mockResolvedValue(() => {});
    showConflictMock.mockResolvedValue(new Map());
  });

  // -------------------------------------------------------------------------
  // 1. 冲突确认：覆盖名单怎么算出来的
  // -------------------------------------------------------------------------

  it('远端已有同名文件 → 先问用户，覆盖名单只装「用户点头要覆盖」的那些', async () => {
    remoteDirWith(['index.html']);

    showConflictMock.mockResolvedValue(new Map([
      ['C:/local/index.html', 'overwrite'],
    ]));

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    expect(showConflictMock).toHaveBeenCalledTimes(1);

    const [direction, conflicts] = showConflictMock.mock.calls[0];

    expect(direction).toBe('upload');
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].name).toBe('index.html');

    const uploads = callsTo('remote_upload_paths');

    expect(uploads).toHaveLength(1);
    expect(uploads[0].payload.overwritePaths).toEqual(['C:/local/index.html']);
  });

  it('用户选择跳过 → 覆盖名单是空的，而且这次跳过要出现在结果里', async () => {
    remoteDirWith(['index.html']);

    showConflictMock.mockResolvedValue(new Map([
      ['C:/local/index.html', 'skip'],
    ]));

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    const uploads = callsTo('remote_upload_paths');

    expect(uploads[0].payload.overwritePaths).toEqual([]);
    // 用户主动跳过的条目必须出现在结果视图里，否则用户不知道自己跳过了什么。
    expect(finishProgressMock).toHaveBeenCalledTimes(1);
    expect(finishProgressMock.mock.calls[0][1]).toEqual([
      {
        path: 'C:/local/index.html',
        reason: 'user_skipped',
      },
    ]);
  });

  it('用户跳过的条目根本不发到后端 —— 否则同一个文件会在结果里出现两次', async () => {
    remoteDirWith(['index.html']);

    showConflictMock.mockResolvedValue(new Map([
      ['C:/local/index.html', 'skip'],
    ]));

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    const uploads = callsTo('remote_upload_paths');

    // 发过去的话后端会看到「远端已存在同名项」，再记一条 already_exists 的跳过，
    // 结果里同一个文件就会列两遍（「你选择了跳过」+「目标已存在，未覆盖」）。
    expect(uploads[0].payload.localPaths).toEqual([]);

    // 跳过的总数也必须只有 1，而不是「后端 1 + 前端 1」。
    const report = finishProgressMock.mock.calls[0][0];
    const skippedByUser = finishProgressMock.mock.calls[0][1];

    expect(report.skipped.length + skippedByUser.length).toBe(1);
  });

  it('一部分跳过一部分覆盖 → 只有没跳过的那些会发过去', async () => {
    remoteDirWith(['a.txt', 'b.txt']);

    showConflictMock.mockResolvedValue(new Map([
      ['C:/local/a.txt', 'overwrite'],
      ['C:/local/b.txt', 'skip'],
    ]));

    await uploadItemsToRemote([
      uploadItem('C:/local/a.txt', 'a.txt'),
      uploadItem('C:/local/b.txt', 'b.txt'),
    ], REMOTE_DIR);

    const uploads = callsTo('remote_upload_paths');

    expect(uploads[0].payload.localPaths).toEqual(['C:/local/a.txt']);
    expect(uploads[0].payload.overwritePaths).toEqual(['C:/local/a.txt']);
  });

  it('用户取消对话框 → 一个字节都不传（阴性对照：后端完全没被叫到）', async () => {
    remoteDirWith(['index.html']);

    showConflictMock.mockResolvedValue(null);

    const handled = await uploadItemsToRemote(
      [uploadItem('C:/local/index.html', 'index.html')],
      REMOTE_DIR,
    );

    expect(handled).toBe(false);
    expect(callsTo('remote_upload_paths')).toHaveLength(0);
  });

  it('远端没有同名文件 → 不弹对话框，直接传', async () => {
    remoteDirWith(['other.txt']);

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    expect(showConflictMock).not.toHaveBeenCalled();
    expect(callsTo('remote_upload_paths')).toHaveLength(1);
  });

  it('一批文件共用一次表态 —— 只弹一次框（阴性对照：弹框次数不是文件数）', async () => {
    remoteDirWith(['a.txt', 'b.txt', 'c.txt']);

    showConflictMock.mockResolvedValue(new Map([
      ['C:/local/a.txt', 'overwrite'],
      ['C:/local/b.txt', 'overwrite'],
      ['C:/local/c.txt', 'overwrite'],
    ]));

    await uploadItemsToRemote([
      uploadItem('C:/local/a.txt', 'a.txt'),
      uploadItem('C:/local/b.txt', 'b.txt'),
      uploadItem('C:/local/c.txt', 'c.txt'),
    ], REMOTE_DIR);

    expect(showConflictMock).toHaveBeenCalledTimes(1);
    expect(showConflictMock.mock.calls[0][1]).toHaveLength(3);

    const uploads = callsTo('remote_upload_paths');

    expect(uploads[0].payload.overwritePaths).toEqual([
      'C:/local/a.txt',
      'C:/local/b.txt',
      'C:/local/c.txt',
    ]);
  });

  // -------------------------------------------------------------------------
  // 2. 失败原因
  // -------------------------------------------------------------------------

  it('后端报失败 → 失败条目（路径 + 原因）出现在结果里，并且弹了失败提示', async () => {
    remoteDirWith([]);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_read_dir') {
        return {
          path: REMOTE_DIR,
          entries: [],
          total_count: 0,
          dir_count: 0,
          file_count: 0,
          opened_directory_times: {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
          },
        };
      }

      if (command === 'remote_upload_paths') {
        return emptyReport({
          failures: [{
            path: '/var/www/wordpress/index.html',
            message: 'Permission denied',
          }],
        });
      }

      return emptyReport();
    });

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    expect(finishProgressMock).toHaveBeenCalledTimes(1);

    const report = finishProgressMock.mock.calls[0][0];

    expect(report.failures).toEqual([
      {
        path: '/var/www/wordpress/index.html',
        message: 'Permission denied',
      },
    ]);

    // 界面必须弹一条**带原因**的提示，而不是干巴巴一句「0 个文件上传成功」。
    expect(toastCustomMock).toHaveBeenCalledTimes(1);

    // toast.custom(组件, 选项) —— 选项里的 componentProps.data 才是文案。
    const props = toastCustomMock.mock.calls[0][1].componentProps.data;

    expect(props.description).toContain('Permission denied');
    expect(props.description).toContain('/var/www/wordpress/index.html');
  });

  // -------------------------------------------------------------------------
  // 3. 进度
  // -------------------------------------------------------------------------

  it('传输期间开着进度框，并且按 jobId 订阅进度事件', async () => {
    remoteDirWith([]);

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    expect(openProgressMock).toHaveBeenCalledWith('upload', 'job-1');
    expect(listenMock).toHaveBeenCalledWith('remote-transfer-progress', expect.any(Function));
    expect(updateProgressMock).not.toHaveBeenCalled();
  });

  it('收到的进度事件里 jobId 对不上 → 不转给对话框（阴性对照）', async () => {
    remoteDirWith([]);

    let capturedListener: ((event: { payload: unknown }) => void) | undefined;

    listenMock.mockImplementation(async (_event: string, listener: (event: { payload: unknown }) => void) => {
      capturedListener = listener;

      return () => {};
    });

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    capturedListener?.({
      payload: {
        jobId: 'other-job',
        filesDone: 1,
      },
    });

    expect(updateProgressMock).not.toHaveBeenCalled();
  });

  it('jobId 对得上的进度事件 → 转给对话框', async () => {
    remoteDirWith([]);

    let capturedListener: ((event: { payload: unknown }) => void) | undefined;

    listenMock.mockImplementation(async (_event: string, listener: (event: { payload: unknown }) => void) => {
      capturedListener = listener;

      return () => {};
    });

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    capturedListener?.({
      payload: {
        jobId: 'job-1',
        filesDone: 1,
        filesTotal: 2,
      },
    });

    expect(updateProgressMock).toHaveBeenCalledWith({
      jobId: 'job-1',
      filesDone: 1,
      filesTotal: 2,
    });
  });

  // -------------------------------------------------------------------------
  // 4. 传输完通知对面那一格刷新
  // -------------------------------------------------------------------------

  it('上传成功 → 通知**远程**那一格刷新', async () => {
    remoteDirWith([]);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'remote_read_dir') {
        return {
          path: REMOTE_DIR,
          entries: [],
          total_count: 0,
          dir_count: 0,
          file_count: 0,
          opened_directory_times: {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
          },
        };
      }

      if (command === 'remote_upload_paths') {
        return emptyReport({ transferred_files: 1 });
      }

      return emptyReport();
    });

    await uploadItemsToRemote([uploadItem('C:/local/index.html', 'index.html')], REMOTE_DIR);

    expect(notifyMock).toHaveBeenCalledWith(REMOTE_DIR);
  });

  it('下载成功 → 通知**本地**那一格刷新', async () => {
    localDirWith([]);

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'read_dir') {
        return {
          path: 'C:/target',
          entries: [],
          total_count: 0,
          dir_count: 0,
          file_count: 0,
          opened_directory_times: {
            modified_time: 0,
            accessed_time: 0,
            created_time: 0,
          },
        };
      }

      if (command === 'remote_download_paths') {
        return emptyReport({ transferred_files: 1 });
      }

      return emptyReport();
    });

    await downloadItemsFromRemote(
      [{
        path: `${REMOTE_DIR}/a.txt`,
        name: 'a.txt',
        isDirectory: false,
        size: 10,
      }],
      'C:/target',
    );

    expect(notifyMock).toHaveBeenCalledWith('C:/target');
  });

  // -------------------------------------------------------------------------
  // 5. 路由：这一趟归谁管
  // -------------------------------------------------------------------------

  it('本地 → 本地 → 不归远程管（返回 null，调用方照旧走本地复制）', async () => {
    const outcome = await handleRemotePaste(
      [uploadItem('C:/local/a.txt', 'a.txt')],
      'C:/other',
    );

    expect(outcome).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('本地 → 远程 → 走上传通道，**不会**落回本地复制', async () => {
    remoteDirWith([]);

    const outcome = await handleRemotePaste(
      [uploadItem('C:/local/a.txt', 'a.txt')],
      REMOTE_DIR,
    );

    expect(outcome).toBe(true);
    expect(callsTo('remote_upload_paths')).toHaveLength(1);
  });

  it('远程 → 本地 → 走下载通道', async () => {
    localDirWith([]);

    const outcome = await handleRemotePaste(
      [{
        path: `${REMOTE_DIR}/a.txt`,
        name: 'a.txt',
        isDirectory: false,
        size: 10,
      }],
      'C:/target',
    );

    expect(outcome).toBe(true);
    expect(callsTo('remote_download_paths')).toHaveLength(1);
  });

  it('远程 → 远程 → 明确报「不支持」，**不**落回本地复制（阴性对照）', async () => {
    const outcome = await handleRemotePaste(
      [{
        path: `${REMOTE_DIR}/a.txt`,
        name: 'a.txt',
        isDirectory: false,
        size: 10,
      }],
      'sfm://remote/conn-2/var/www',
    );

    expect(outcome).toBe(false);
    expect(callsTo('remote_upload_paths')).toHaveLength(0);
    expect(callsTo('remote_download_paths')).toHaveLength(0);
    expect(toastCustomMock).toHaveBeenCalledTimes(1);
  });

  it('一个条目都没有 → 不归远程管（返回 null，不是「失败了 0 个文件」）', async () => {
    const outcome = await handleRemotePaste([], REMOTE_DIR);

    expect(outcome).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // 6. 条目映射
  // -------------------------------------------------------------------------

  it('目录条目 → 传输条目：名字用条目自己的 name，不用路径末段', () => {
    const items = toRemoteTransferItems([
      {
        name: 'index.html',
        ext: null,
        path: 'C:/local/index.html',
        size: 42,
        item_count: null,
        modified_time: 0,
        accessed_time: 0,
        created_time: 0,
        mime: null,
        is_file: true,
        is_dir: false,
        is_symlink: false,
        is_hidden: false,
      },
    ]);

    expect(items).toEqual([
      {
        path: 'C:/local/index.html',
        name: 'index.html',
        isDirectory: false,
        size: 42,
      },
    ]);
  });

  it('只有路径时 → 名字取路径末段（远程路径也成立）', () => {
    expect(remoteTransferItemsFromPaths(['sfm://remote/conn-1/var/www/index.html'])).toEqual([
      {
        path: 'sfm://remote/conn-1/var/www/index.html',
        name: 'index.html',
        isDirectory: false,
        size: null,
      },
    ]);
  });
});
