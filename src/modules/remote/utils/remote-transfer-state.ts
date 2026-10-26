// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 远程传输（上传 / 下载）的对话框状态。
//
// 为什么是模块级而不是 FileBrowser 的 context：
// 触发点有两个 —— 右键菜单（FileBrowser 里）与粘贴（导航器页里），
// 渲染点（对话框）也要在 FileBrowser 里。
// 走 context 要把状态一路穿上去，而这两个对话框**全局只需要一个实例**，
// 放模块级最省事，方向也单一（只有服务层写，只有对话框读）。
//
// 这与 `remote-permissions-dialog-state.ts` 是同一条路子。

import { ref, type Ref } from 'vue';
import type {
  RemoteTransferProgress,
  RemoteTransferReport,
  RemoteTransferSkip,
} from '@/modules/remote/utils/remote-transfer';

/** 传输方向。 */
export type RemoteTransferDirection = 'upload' | 'download';

/** 用户对单个冲突项的决定。 */
export type RemoteTransferConflictDecision = 'overwrite' | 'skip';

/** 一个与远端同名、已经存在的条目。 */
export interface RemoteTransferConflictItem {
  /** 条目标识：上传时是本地路径，下载时是远端路径。 */
  path: string;
  /** 显示用的名字。 */
  name: string;
  isDirectory: boolean;
  /** 大小（拿不到就是 null）。 */
  size: number | null;
}

type PendingConflictResolve = (
  decisions: Map<string, RemoteTransferConflictDecision> | null,
) => void;

interface RemoteTransferConflictDialogState {
  isOpen: boolean;
  direction: RemoteTransferDirection;
  conflicts: RemoteTransferConflictItem[];
  pendingResolve: PendingConflictResolve | null;
}

function createConflictDialogState(): RemoteTransferConflictDialogState {
  return {
    isOpen: false,
    direction: 'upload',
    conflicts: [],
    pendingResolve: null,
  };
}

const conflictDialogState = ref<RemoteTransferConflictDialogState>(createConflictDialogState());

/**
 * 打开覆盖确认对话框。
 *
 * 返回 `null` = 用户取消；返回一张表 = 每个冲突项的决定。
 * **一次只问一次**：整批文件共用这一份决定（用户可以在对话框里逐项调整）。
 */
export function showRemoteTransferConflictDialog(
  direction: RemoteTransferDirection,
  conflicts: RemoteTransferConflictItem[],
): Promise<Map<string, RemoteTransferConflictDecision> | null> {
  if (conflicts.length === 0) {
    return Promise.resolve(new Map());
  }

  return new Promise((resolve) => {
    conflictDialogState.value = {
      isOpen: true,
      direction,
      conflicts,
      pendingResolve: resolve,
    };
  });
}

/** 用户确认了对话框。 */
export function resolveRemoteTransferConflict(
  decisions: Map<string, RemoteTransferConflictDecision>,
): void {
  const { pendingResolve } = conflictDialogState.value;

  if (pendingResolve) {
    pendingResolve(decisions);
  }

  conflictDialogState.value = createConflictDialogState();
}

/** 用户取消了对话框。 */
export function cancelRemoteTransferConflict(): void {
  const { pendingResolve } = conflictDialogState.value;

  if (pendingResolve) {
    pendingResolve(null);
  }

  conflictDialogState.value = createConflictDialogState();
}

// ---------------------------------------------------------------------------
// 进度 / 结果对话框
// ---------------------------------------------------------------------------

interface RemoteTransferProgressDialogState {
  isOpen: boolean;
  direction: RemoteTransferDirection;
  /** `running` = 还在传；`finished` = 传完了（对话框转成结果视图）。 */
  phase: 'running' | 'finished';
  progress: RemoteTransferProgress;
  /** 传完之后的后端报告。 */
  report: RemoteTransferReport | null;
  /** 用户在冲突对话框里主动跳过的条目（后端不知道它们）。 */
  skippedByUser: RemoteTransferSkip[];
}

function emptyProgress(jobId: string): RemoteTransferProgress {
  return {
    jobId,
    filesDone: 0,
    filesTotal: 0,
    bytesDone: 0,
    bytesTotal: 0,
    currentPath: '',
  };
}

function createProgressDialogState(): RemoteTransferProgressDialogState {
  return {
    isOpen: false,
    direction: 'upload',
    phase: 'running',
    progress: emptyProgress(''),
    report: null,
    skippedByUser: [],
  };
}

const progressDialogState = ref<RemoteTransferProgressDialogState>(createProgressDialogState());

/** 传输开始：打开进度对话框。 */
export function openRemoteTransferProgress(
  direction: RemoteTransferDirection,
  jobId: string,
): void {
  progressDialogState.value = {
    ...createProgressDialogState(),
    isOpen: true,
    direction,
    progress: emptyProgress(jobId),
  };
}

/**
 * 收到一条进度事件。
 *
 * **只认自己的 `jobId`** —— 同时有两条传输在跑时，别人的进度不能串进来。
 */
export function updateRemoteTransferProgress(progress: RemoteTransferProgress): void {
  const state = progressDialogState.value;

  if (state.progress.jobId && progress.jobId !== state.progress.jobId) {
    return;
  }

  progressDialogState.value = {
    ...state,
    progress,
  };
}

/** 传输结束：把对话框转成结果视图。 */
export function finishRemoteTransferProgress(
  report: RemoteTransferReport,
  skippedByUser: RemoteTransferSkip[],
): void {
  const state = progressDialogState.value;

  progressDialogState.value = {
    ...state,
    phase: 'finished',
    report,
    skippedByUser,
    progress: {
      ...state.progress,
      filesDone: report.transferred_files + skippedByUser.length,
      bytesDone: report.total_bytes,
    },
  };
}

/** 传输整体失败（连报告都没拿到）：把错误显示在对话框里。 */
export function failRemoteTransferProgress(message: string): void {
  const state = progressDialogState.value;

  progressDialogState.value = {
    ...state,
    phase: 'finished',
    report: {
      transferred_files: 0,
      transferred_dirs: 0,
      total_bytes: 0,
      skipped: [],
      failures: [{
        path: '',
        message,
      }],
    },
  };
}

/** 关闭进度 / 结果对话框。 */
export function closeRemoteTransferProgress(): void {
  progressDialogState.value = createProgressDialogState();
}

export interface RemoteTransferDialogStates {
  conflictDialogState: Ref<RemoteTransferConflictDialogState>;
  progressDialogState: Ref<RemoteTransferProgressDialogState>;
}

export function useRemoteTransferDialogStates(): RemoteTransferDialogStates {
  return {
    conflictDialogState,
    progressDialogState,
  };
}
