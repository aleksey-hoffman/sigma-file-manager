// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

//
// FORK-MODIFICATION 2026-10-26：远程传输对话框的**状态机**门禁。
//
// 两个对话框都是**模块级单例**（`remote-permissions-dialog-state.ts` 同路子），
// 所以状态机本身就是对外契约：
//
// - 覆盖确认框：确认 → resolve 一张决定表；取消 → resolve `null`。
// - 进度框：只认**自己那次传输**的 jobId —— 两条传输同时在跑时，
//   别人的进度不能串进来（串进来就是进度条乱跳）。
//
// 每条用例都带阴性对照。
//

import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import {
  cancelRemoteTransferConflict,
  closeRemoteTransferProgress,
  failRemoteTransferProgress,
  finishRemoteTransferProgress,
  openRemoteTransferProgress,
  resolveRemoteTransferConflict,
  showRemoteTransferConflictDialog,
  updateRemoteTransferProgress,
  useRemoteTransferDialogStates,
} from '../remote-transfer-state';

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

describe('远程传输对话框状态机', () => {
  beforeEach(() => {
    const { conflictDialogState, progressDialogState } = useRemoteTransferDialogStates();

    conflictDialogState.value.isOpen = false;
    conflictDialogState.value.conflicts = [];
    conflictDialogState.value.pendingResolve = null;

    progressDialogState.value.isOpen = false;
    progressDialogState.value.phase = 'running';
    progressDialogState.value.report = null;
    progressDialogState.value.skippedByUser = [];
    progressDialogState.value.progress.jobId = '';
  });

  describe('覆盖确认框', () => {
    it('确认 → resolve 一张逐项决定表', async () => {
      const promise = showRemoteTransferConflictDialog('upload', [
        {
          path: 'C:/a.txt',
          name: 'a.txt',
          isDirectory: false,
          size: 1,
        },
      ]);

      resolveRemoteTransferConflict(new Map([['C:/a.txt', 'overwrite']]));

      const decisions = await promise;

      expect(decisions).not.toBeNull();
      expect(decisions!.get('C:/a.txt')).toBe('overwrite');
    });

    it('取消 → resolve null（调用方据此「什么都不传」）', async () => {
      const promise = showRemoteTransferConflictDialog('upload', [
        {
          path: 'C:/a.txt',
          name: 'a.txt',
          isDirectory: false,
          size: 1,
        },
      ]);

      cancelRemoteTransferConflict();

      expect(await promise).toBeNull();
    });

    it('关掉之后状态归零（阴性对照：下一次打开不带着上一次的冲突列表）', async () => {
      const { conflictDialogState } = useRemoteTransferDialogStates();

      showRemoteTransferConflictDialog('upload', [
        {
          path: 'C:/a.txt',
          name: 'a.txt',
          isDirectory: false,
          size: 1,
        },
      ]);

      expect(conflictDialogState.value.isOpen).toBe(true);

      cancelRemoteTransferConflict();

      expect(conflictDialogState.value.isOpen).toBe(false);
      expect(conflictDialogState.value.conflicts).toEqual([]);
    });

    it('一个冲突都没有 → 立刻 resolve 空表，不弹框', async () => {
      const { conflictDialogState } = useRemoteTransferDialogStates();

      const decisions = await showRemoteTransferConflictDialog('upload', []);

      expect(decisions!.size).toBe(0);
      expect(conflictDialogState.value.isOpen).toBe(false);
    });
  });

  describe('进度框', () => {
    it('jobId 对得上 → 进度被采纳', () => {
      const { progressDialogState } = useRemoteTransferDialogStates();

      openRemoteTransferProgress('upload', 'job-1');

      updateRemoteTransferProgress({
        jobId: 'job-1',
        filesDone: 3,
        filesTotal: 10,
        bytesDone: 30,
        bytesTotal: 100,
        currentPath: 'C:/a.txt',
      });

      expect(progressDialogState.value.progress.filesDone).toBe(3);
      expect(progressDialogState.value.progress.bytesDone).toBe(30);
    });

    it('jobId 对不上 → 进度被丢掉（阴性对照：别人的进度不能串进来）', () => {
      const { progressDialogState } = useRemoteTransferDialogStates();

      openRemoteTransferProgress('upload', 'job-1');

      updateRemoteTransferProgress({
        jobId: 'job-2',
        filesDone: 3,
        filesTotal: 10,
        bytesDone: 30,
        bytesTotal: 100,
        currentPath: 'C:/a.txt',
      });

      expect(progressDialogState.value.progress.filesDone).toBe(0);
      expect(progressDialogState.value.progress.currentPath).toBe('');
    });

    it('传完之后转成结果视图，带上报告与用户主动跳过的条目', () => {
      const { progressDialogState } = useRemoteTransferDialogStates();

      openRemoteTransferProgress('upload', 'job-1');

      finishRemoteTransferProgress(
        emptyReport({ transferred_files: 2 }) as never,
        [{
          path: 'C:/b.txt',
          reason: 'user_skipped',
        }],
      );

      expect(progressDialogState.value.phase).toBe('finished');
      expect(progressDialogState.value.report?.transferred_files).toBe(2);
      expect(progressDialogState.value.skippedByUser).toHaveLength(1);
      expect(progressDialogState.value.isOpen).toBe(true);
    });

    it('整体失败 → 结果视图里有一条失败记录（路径为空串，消息是错误文本）', () => {
      const { progressDialogState } = useRemoteTransferDialogStates();

      openRemoteTransferProgress('upload', 'job-1');

      failRemoteTransferProgress('连不上服务器');

      expect(progressDialogState.value.phase).toBe('finished');
      expect(progressDialogState.value.report?.failures).toEqual([
        {
          path: '',
          message: '连不上服务器',
        },
      ]);
    });

    it('关掉之后状态归零（阴性对照：下一次传输不带着上一次的进度）', () => {
      const { progressDialogState } = useRemoteTransferDialogStates();

      openRemoteTransferProgress('upload', 'job-1');

      closeRemoteTransferProgress();

      expect(progressDialogState.value.isOpen).toBe(false);
      expect(progressDialogState.value.phase).toBe('running');
      expect(progressDialogState.value.report).toBeNull();
      expect(progressDialogState.value.progress.jobId).toBe('');
    });
  });
});
