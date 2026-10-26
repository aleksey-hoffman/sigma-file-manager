// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-26：本地 ↔ 远程传输的**编排层**。
//
// 真机验收发现的三件事都在这里收口：
//
// 1. **失败没有原因**：后端其实一直带着 `failures` / `skipped`，
//    但界面上只显示「上传了 0 个文件」—— 用户完全不知道为什么。
//    现在失败与跳过都逐条列出来（路径 + 原因）。
//
// 2. **没有进度**：大文件上传期间界面上一动不动。
//    现在传输期间开着进度对话框（进度条 + 计数 + 当前文件）。
//
// 3. **远端同名文件被静默跳过**：旧策略是「目标已存在就不传」，
//    于是用户传新版本时看到「0 个成功」。
//    现在先问一句：**要不要覆盖？** —— 而且这一次问的
//    决定对**整批文件**生效（也可以逐项调整）。

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { markRaw } from 'vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import uniqueId from '@/utils/unique-id';
import { describeRemoteError } from '@/utils/remote-directory';
import { isRemotePath } from '@/utils/remote-paths';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import { basenameFromPath } from '@/utils/source-display-name';
import {
  downloadPathsFromRemote,
  uploadPathsToRemote,
  type RemoteTransferProgress,
  type RemoteTransferReport,
  type RemoteTransferSkip,
} from '@/modules/remote/utils/remote-transfer';
import {
  failRemoteTransferProgress,
  finishRemoteTransferProgress,
  openRemoteTransferProgress,
  showRemoteTransferConflictDialog,
  updateRemoteTransferProgress,
  type RemoteTransferConflictDecision,
  type RemoteTransferConflictItem,
  type RemoteTransferDirection,
} from '@/modules/remote/utils/remote-transfer-state';
import {
  notifyRemoteTransferCompleted,
  shouldRefreshTargetPane,
} from '@/modules/remote/utils/remote-transfer-refresh';

/** 参与传输的一个条目。 */
export interface RemoteTransferItem {
  /** 完整路径：上传时是本地路径，下载时是 `sfm://remote/...`。 */
  path: string;
  /** 显示用的名字。 */
  name: string;
  isDirectory: boolean;
  size: number | null;
}

const READ_DIR_OPTIONS = {
  includeShortcutTargets: false,
  includeHardLinkCounts: false,
  includeItemCounts: false,
};

/**
 * 把目录条目映射成传输条目。
 *
 * 名字**用条目自带的 `name`**，不用路径末段 —— 远端路径
 * `sfm://remote/<id>/var/www/x` 的末段是 `x`，但那只是路径的巧合，
 * 条目名才是用户看到、也正是远端目录里那个名字。
 */
export function toRemoteTransferItems(entries: DirEntry[]): RemoteTransferItem[] {
  return entries.map(entry => ({
    path: entry.path,
    name: entry.name,
    isDirectory: entry.is_dir,
    size: entry.size,
  }));
}

/**
 * 只知道路径时的降级映射。
 *
 * 名字取路径末段（`basenameFromPath` 对 `sfm://remote/...` 与本地路径都成立）；
 * 类型未知，按文件算 —— 这个字段**只用于对话框里的图标**，
 * 不参与任何判定（后端自己扫目录树，名字才是判定的依据）。
 */
export function remoteTransferItemsFromPaths(paths: string[]): RemoteTransferItem[] {
  return paths.map(path => ({
    path,
    name: basenameFromPath(path),
    isDirectory: false,
    size: null,
  }));
}

/** 远端目录里已经有的名字。 */
async function listRemoteNames(remoteDir: string): Promise<Set<string>> {
  const contents = await invoke<DirContents>('remote_read_dir', { path: remoteDir });

  return new Set(contents.entries.map(entry => entry.name));
}

/** 本地目录里已经有的名字。 */
async function listLocalNames(localDir: string): Promise<Set<string>> {
  const contents = await invoke<DirContents>('read_dir', {
    path: localDir,
    options: READ_DIR_OPTIONS,
  });

  return new Set(contents.entries.map(entry => entry.name));
}

/**
 * 把「已经存在的同名项」挑出来，交给用户表态。
 *
 * 返回 `null` = 用户取消（什么都不该传）。
 */
async function resolveConflicts(
  direction: RemoteTransferDirection,
  items: RemoteTransferItem[],
  existingNames: Set<string>,
): Promise<Map<string, RemoteTransferConflictDecision> | null> {
  const conflicts: RemoteTransferConflictItem[] = items
    .filter(item => existingNames.has(item.name))
    .map(item => ({
      path: item.path,
      name: item.name,
      isDirectory: item.isDirectory,
      size: item.size,
    }));

  if (conflicts.length === 0) {
    return new Map();
  }

  return showRemoteTransferConflictDialog(direction, conflicts);
}

/** 把决定拆成「要覆盖的路径」与「用户主动跳过的条目」。 */
function splitDecisions(
  items: RemoteTransferItem[],
  decisions: Map<string, RemoteTransferConflictDecision>,
): {
  overwritePaths: string[];
  skippedByUser: RemoteTransferSkip[];
  /** 用户选择跳过的条目**不参与传输**。 */
  skippedPaths: Set<string>;
} {
  const overwritePaths: string[] = [];
  const skippedByUser: RemoteTransferSkip[] = [];
  const skippedPaths = new Set<string>();

  for (const item of items) {
    const decision = decisions.get(item.path);

    if (decision === 'overwrite') {
      overwritePaths.push(item.path);
    }
    else if (decision === 'skip') {
      skippedByUser.push({
        path: item.path,
        reason: 'user_skipped',
      });
      skippedPaths.add(item.path);
    }
  }

  return {
    overwritePaths,
    skippedByUser,
    skippedPaths,
  };
}

/** 订阅进度事件，并把属于这一次传输的事件转给对话框。 */
async function watchProgress(jobId: string): Promise<() => void> {
  const unlisten = await listen<RemoteTransferProgress>('remote-transfer-progress', (event) => {
    if (event.payload.jobId !== jobId) {
      return;
    }

    updateRemoteTransferProgress(event.payload);
  });

  return unlisten;
}

/** 传输结束后提示一句，并让目标那一格刷新。 */
function reportOutcome(
  direction: RemoteTransferDirection,
  report: RemoteTransferReport,
  skippedByUser: RemoteTransferSkip[],
  targetPath: string,
): void {
  const skippedCount = report.skipped.length + skippedByUser.length;
  const failedCount = report.failures.length;

  if (failedCount > 0) {
    const firstFailure = report.failures[0];

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t(
            direction === 'upload'
              ? 'remote.transfer.uploadFailedTitle'
              : 'remote.transfer.downloadFailedTitle',
          ),
          description: firstFailure
            ? `${firstFailure.path}：${firstFailure.message}`
            : '',
        },
      },
      duration: 6000,
    });
  }
  else if (skippedCount > 0) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t(
            direction === 'upload'
              ? 'remote.transfer.uploadFailed'
              : 'remote.transfer.downloadFailed',
            {
              files: report.transferred_files,
              skipped: skippedCount,
              failed: 0,
            },
          ),
          description: '',
        },
      },
      duration: 5000,
    });
  }
  else {
    toast.success(
      i18n.global.t(
        direction === 'upload'
          ? 'remote.transfer.uploadSucceeded'
          : 'remote.transfer.downloadSucceeded',
        { files: report.transferred_files },
      ),
    );
  }

  const shouldRefresh = shouldRefreshTargetPane({
    transferredFiles: report.transferred_files,
    transferredDirs: report.transferred_dirs,
    skippedCount,
    failureCount: failedCount,
  });

  if (shouldRefresh) {
    notifyRemoteTransferCompleted(targetPath);
  }
}

/**
 * 上传：本地条目 → 远端目录。
 *
 * 返回 `true` = 这一趟由远程通道处理完了（调用方不要再走本地复制）。
 */
export async function uploadItemsToRemote(
  items: RemoteTransferItem[],
  remoteDir: string,
): Promise<boolean> {
  if (items.length === 0) {
    return false;
  }

  let existingNames: Set<string>;

  try {
    existingNames = await listRemoteNames(remoteDir);
  }
  catch (error) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('remote.transfer.uploadFailedTitle'),
          description: describeRemoteError(error),
        },
      },
      duration: 6000,
    });

    return false;
  }

  const decisions = await resolveConflicts('upload', items, existingNames);

  if (!decisions) {
    return false;
  }

  const { overwritePaths, skippedByUser, skippedPaths } = splitDecisions(items, decisions);
  const jobId = uniqueId();

  openRemoteTransferProgress('upload', jobId);

  const unlisten = await watchProgress(jobId);

  let report: RemoteTransferReport;

  try {
    report = await uploadPathsToRemote(
      // 用户选择跳过的条目**根本不发过去**。
      //
      // 发过去的话后端会看到「远端已存在同名项」并再记一条
      // `already_exists` 的跳过 —— 同一个文件在结果里就会出现两次
      // （一次「你选择了跳过」，一次「目标已存在，未覆盖」），
      // 用户会以为传了两次。
      items
        .map(item => item.path)
        .filter(path => !skippedPaths.has(path)),
      remoteDir,
      overwritePaths,
      jobId,
    );
  }
  catch (error) {
    unlisten();
    failRemoteTransferProgress(describeRemoteError(error));

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('remote.transfer.uploadFailedTitle'),
          description: describeRemoteError(error),
        },
      },
      duration: 6000,
    });

    return false;
  }

  unlisten();

  finishRemoteTransferProgress(report, skippedByUser);
  reportOutcome('upload', report, skippedByUser, remoteDir);

  return true;
}

/**
 * 粘贴到远程目录（或从远程目录粘出来）。
 *
 * - `null` = 这一趟与远程无关，调用方走本地复制；
 * - `true` = 远程通道处理完了，而且**成功了**；
 * - `false` = 远程通道处理了，但**没成功**（用户取消、权限不足、传输失败）。
 *
 * **返回 `false` 时绝不能落回本地复制** —— 本地复制引擎拿到
 * `sfm://remote/...` 只会问文件系统「这个目录在不在」，
 * 然后报一句毫无意义的 `Destination path does not exist`。
 */
export async function handleRemotePaste(
  items: RemoteTransferItem[],
  destinationPath: string,
): Promise<boolean | null> {
  // 一个条目都没有 ⇒ 这一趟没有东西可传，**不是**远程的活。
  //
  // 不加这一条的话，「剪贴板里有远程条目但本次是空」会被当成
  // 「上传了 0 个文件」并判成失败 —— 那是假的失败。
  if (items.length === 0) {
    return null;
  }

  const destinationIsRemote = isRemotePath(destinationPath);
  const sourcesAreRemote = items.some(item => isRemotePath(item.path));

  if (!destinationIsRemote && !sourcesAreRemote) {
    // 本地 → 本地：老老实实走本地复制。
    return null;
  }

  if (destinationIsRemote && !sourcesAreRemote) {
    return uploadItemsToRemote(items, destinationPath);
  }

  if (!destinationIsRemote && sourcesAreRemote) {
    return downloadItemsFromRemote(items, destinationPath);
  }

  toast.custom(markRaw(ToastStatic), {
    componentProps: {
      data: {
        title: i18n.global.t('remote.transfer.pasteToRemoteFailed'),
        description: i18n.global.t('remote.transfer.remoteToRemoteNotSupported'),
      },
    },
    duration: 6000,
  });

  return false;
}

/**
 * 下载：远端条目 → 本地目录。
 *
 * 返回 `true` = 这一趟由远程通道处理完了。
 */
export async function downloadItemsFromRemote(
  items: RemoteTransferItem[],
  localDir: string,
): Promise<boolean> {
  if (items.length === 0) {
    return false;
  }

  let existingNames: Set<string>;

  try {
    existingNames = await listLocalNames(localDir);
  }
  catch (error) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('remote.transfer.downloadFailedTitle'),
          description: describeRemoteError(error),
        },
      },
      duration: 6000,
    });

    return false;
  }

  const decisions = await resolveConflicts('download', items, existingNames);

  if (!decisions) {
    return false;
  }

  const { overwritePaths, skippedByUser, skippedPaths } = splitDecisions(items, decisions);
  const jobId = uniqueId();

  openRemoteTransferProgress('download', jobId);

  const unlisten = await watchProgress(jobId);

  let report: RemoteTransferReport;

  try {
    report = await downloadPathsFromRemote(
      // 用户选择跳过的条目根本不发过去（理由同上传侧）。
      items
        .map(item => item.path)
        .filter(path => !skippedPaths.has(path)),
      localDir,
      overwritePaths,
      jobId,
    );
  }
  catch (error) {
    unlisten();
    failRemoteTransferProgress(describeRemoteError(error));

    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('remote.transfer.downloadFailedTitle'),
          description: describeRemoteError(error),
        },
      },
      duration: 6000,
    });

    return false;
  }

  unlisten();

  finishRemoteTransferProgress(report, skippedByUser);
  reportOutcome('download', report, skippedByUser, localDir);

  return true;
}
