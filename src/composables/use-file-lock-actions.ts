// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-24：「解除文件锁定」与「彻底删除」的前端驱动。
//
// 这两件事与既有的删除流程**刻意分开**：
// 既有删除走 `delete_tree`（可回收站、可并行、有进度条），
// 而这里的「彻底删除」走的是 Windows 的 delete-pending / 重启后删除，
// 语义完全不同 —— 前者删的是「目录树里的条目」，后者针对的是
// 「一个删不掉的路径」。
//
// 后端命令（`src-tauri/src/file_lock_commands.rs`）：
// - `diagnose_file_locks` —— 只读，查出谁占着这个文件；
// - `unlock_file` —— 解除锁定；
// - `force_delete_path` —— 彻底删除；
// - `terminate_lock_holder_processes` —— 结束占用者进程（不可逆）。

import { ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast, ToastStatic } from '@/components/ui/toaster';
import type { DirEntry } from '@/types/dir-entry';

/** 一个占用者进程。 */
export interface LockHolder {
  pid: number;
  processName: string;
  isService: boolean;
}

/** 一条路径的锁定诊断结果。 */
export interface LockDiagnostic {
  path: string;
  holders: LockHolder[];
  exists: boolean;
}

/** 解除锁定的结果。 */
export interface UnlockOutcome {
  path: string;
  unlocked: boolean;
  canDeleteNow: boolean;
  error: string | null;
}

/** 彻底删除的结果。 */
export interface ForceDeleteOutcome {
  path: string;
  deleted: boolean;
  scheduledForReboot: boolean;
  error: string | null;
}

/** 一个没被成功结束的进程。 */
export interface TerminateFailure {
  pid: number;
  error: string;
}

/** 结束占用者进程的结果。 */
export interface TerminateHoldersResult {
  terminated: number[];
  failed: TerminateFailure[];
}

/** 占用者显示名：优先用进程名，缺名字时退回 PID。 */
export function describeLockHolder(holder: LockHolder): string {
  const name = holder.processName.trim();

  if (!name) {
    return `PID ${holder.pid}`;
  }

  return name;
}

export function useFileLockActions() {
  const { t } = useI18n();

  /** 诊断结果，供界面展示「谁占着这个文件」。 */
  const diagnostics = ref<LockDiagnostic[]>([]);
  /** 正在跑诊断 / 解除 / 删除。 */
  const isBusy = ref(false);

  function showError(title: string, description: string) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title,
          description,
        },
      },
    });
  }

  /**
   * 诊断一批路径被谁占着。
   *
   * ⚠️ 失败时**不抛异常**，而是返回空数组 ——
   * 「查不出来」与「没被占用」在这个功能里都表现为「没有占用者」，
   * 让调用方能统一走「解除锁定」那条路。
   */
  async function diagnose(paths: string[]): Promise<LockDiagnostic[]> {
    if (paths.length === 0) {
      return [];
    }

    try {
      const result = await invoke<LockDiagnostic[]>('diagnose_file_locks', { paths });
      diagnostics.value = result;
      return result;
    }
    catch (error) {
      console.error('Failed to diagnose file locks:', error);
      diagnostics.value = [];
      return [];
    }
  }

  /**
   * 解除锁定。
   *
   * 后端做的是「清只读位 + 探一探现在能不能删」——
   * **它不删文件**，只是把挡着删除的东西清掉（只读位 / 占用者）。
   *
   * 真正的删除是「彻底删除」（`forceDelete`）的事。
   */
  async function unlock(path: string): Promise<UnlockOutcome | null> {
    isBusy.value = true;

    try {
      const outcome = await invoke<UnlockOutcome>('unlock_file', { path });

      if (outcome.unlocked) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('fileLock.unlocked'),
              description: t('fileLock.unlockedDescription'),
            },
          },
        });
      }
      else {
        showError(
          t('fileLock.unlockFailed'),
          outcome.error || t('fileLock.unknownError'),
        );
      }

      return outcome;
    }
    catch (error) {
      showError(t('fileLock.unlockFailed'), String(error));
      return null;
    }
    finally {
      isBusy.value = false;
    }
  }

  /**
   * 彻底删除。
   *
   * 后端按代价从低到高依次尝试：清只读位 → 标记删除 → 登记为重启后删除。
   * 三种结果的含义完全不同，**必须分别如实回报**：
   * - `deleted` —— 文件已经（或即将）消失；
   * - `scheduledForReboot` —— 已经登记，重启后系统会删；
   * - 都不是 —— 失败，附带原因。
   */
  async function forceDelete(path: string): Promise<ForceDeleteOutcome | null> {
    isBusy.value = true;

    try {
      const outcome = await invoke<ForceDeleteOutcome>('force_delete_path', { path });

      if (outcome.deleted) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('fileLock.forceDeleted'),
              description: t('fileLock.forceDeletedDescription'),
            },
          },
        });
      }
      else if (outcome.scheduledForReboot) {
        toast.custom(markRaw(ToastStatic), {
          componentProps: {
            data: {
              title: t('fileLock.scheduledForReboot'),
              description: t('fileLock.scheduledForRebootDescription'),
            },
          },
        });
      }
      else {
        showError(
          t('fileLock.forceDeleteFailed'),
          outcome.error || t('fileLock.unknownError'),
        );
      }

      return outcome;
    }
    catch (error) {
      showError(t('fileLock.forceDeleteFailed'), String(error));
      return null;
    }
    finally {
      isBusy.value = false;
    }
  }

  /**
   * 结束占用者进程。
   *
   * ⚠️ **不可逆**：被结束的进程可能有未保存的数据。
   * 调用方必须先弹确认框。
   */
  async function terminateHolders(pids: number[]): Promise<TerminateHoldersResult | null> {
    if (pids.length === 0) {
      return null;
    }

    isBusy.value = true;

    try {
      const result = await invoke<TerminateHoldersResult>('terminate_lock_holder_processes', { pids });

      if (result.failed.length > 0) {
        showError(
          t('fileLock.terminateFailed'),
          result.failed.map(item => `PID ${item.pid}: ${item.error}`).join('\n'),
        );
      }

      return result;
    }
    catch (error) {
      showError(t('fileLock.terminateFailed'), String(error));
      return null;
    }
    finally {
      isBusy.value = false;
    }
  }

  return {
    diagnostics,
    isBusy,
    diagnose,
    unlock,
    forceDelete,
    terminateHolders,
  };
}

/** 从选中的条目里取出唯一的目标路径。 */
export function resolveSingleTargetPath(entries: DirEntry[]): string | null {
  if (entries.length !== 1) {
    return null;
  }

  return entries[0].path;
}
