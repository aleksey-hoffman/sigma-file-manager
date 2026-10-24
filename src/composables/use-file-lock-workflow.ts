// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-24：「解除文件锁定 / 彻底删除」的完整流程。
//
// ## 为什么单独一个 composable
//
// 这个功能有**两个调用点**，而它们本来是两份平行实现：
// - `use-dir-entry-actions.ts`（首页 / 仪表盘等 `DirEntryInteractive` 场景）；
// - `use-file-browser-selection.ts`（导航器主界面）。
//
// 两边的删除逻辑早就各写了一份（`deleteItems` 在两处都有），
// 但**破坏性**的操作不该抄两份 —— 抄漏一处就是一处没有确认框的删除。
// 所以流程收敛到这里，两个调用点各自 `useFileLockWorkflow()` 一行接上。
//
// ## 破坏性动作的三道确认
//
// 1. 「解除文件锁定」：可能会结束占用它的程序 ⇒ 必须确认；
// 2. 「彻底删除」：删文件 ⇒ 必须确认；
// 3. 「结束进程」：被杀进程可能有未保存的数据 ⇒ 必须确认。

import { ref } from 'vue';
import { markRaw } from 'vue';
import { useI18n } from 'vue-i18n';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { getParentDirectory } from '@/utils/normalize-path';
import {
  resolveSingleTargetPath,
  useFileLockActions,
  type LockHolder,
} from '@/composables/use-file-lock-actions';
import type { DirEntry } from '@/types/dir-entry';

/** 对话框当前在做什么。 */
export type FileLockDialogMode = 'unlock' | 'force-delete';

/** 「解除文件锁定」对话框的载荷。 */
export interface UnlockRequest {
  path: string;
  holders: LockHolder[];
}

/** 「彻底删除」对话框的载荷。 */
export interface ForceDeleteRequest {
  path: string;
}

export function useFileLockWorkflow() {
  const { t } = useI18n();
  const workspacesStore = useWorkspacesStore();
  const userStatsStore = useUserStatsStore();
  const userSettingsStore = useUserSettingsStore();
  const dirSizesStore = useDirSizesStore();
  const fileLockActions = useFileLockActions();

  /** 对话框是否打开。 */
  const isOpen = ref(false);
  /** 对话框模式。 */
  const mode = ref<FileLockDialogMode>('unlock');
  /** 对话框针对的路径。 */
  const path = ref('');
  /** 占用该文件的进程（仅 unlock 模式有值）。 */
  const holders = ref<LockHolder[]>([]);
  /** 正在执行破坏性动作。 */
  const isBusy = ref(false);

  function requestUnlock(request: UnlockRequest) {
    mode.value = 'unlock';
    path.value = request.path;
    holders.value = request.holders;
    isOpen.value = true;
  }

  function requestForceDelete(request: ForceDeleteRequest) {
    mode.value = 'force-delete';
    path.value = request.path;
    holders.value = [];
    isOpen.value = true;
  }

  function handleOpenChange(value: boolean) {
    isOpen.value = value;

    if (!value) {
      path.value = '';
      holders.value = [];
    }
  }

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

  /** 目标路径消失后，刷新它所在的目录。 */
  function refreshParentOf(targetPath: string) {
    workspacesStore.handleDirectoryContentsChanged([getParentDirectory(targetPath)]);
  }

  /**
   * 「解除文件锁定」的入口。
   *
   * 先诊断（谁是占用者）→ 有人占就弹对话框让人决定，
   * 没人占就直接解锁（多半是只读位挡着）。
   */
  async function unlockEntry(entry: DirEntry): Promise<void> {
    const targetPath = resolveSingleTargetPath([entry]);

    if (!targetPath) {
      return;
    }

    const [diagnostic] = await fileLockActions.diagnose([targetPath]);

    if (!diagnostic) {
      showError(t('fileLock.diagnoseFailed'), '');
      return;
    }

    if (diagnostic.holders.length === 0) {
      // 没人占 ⇒ 直接解锁即可（多半是只读位挡着）。
      // 解锁**不删文件**，所以这里不需要刷新目录。
      await fileLockActions.unlock(targetPath);
      return;
    }

    requestUnlock({
      path: targetPath,
      holders: diagnostic.holders,
    });
  }

  /** 「彻底删除」的入口 —— 不可逆，所以先弹确认框。 */
  function forceDeleteEntry(entry: DirEntry): void {
    const targetPath = resolveSingleTargetPath([entry]);

    if (!targetPath) {
      return;
    }

    requestForceDelete({ path: targetPath });
  }

  /**
   * 对话框点了「解除文件锁定」。
   *
   * ⚠️ 解锁**不删文件** —— 它只是把挡着删除的东西清掉。
   * 所以成功后**不需要**刷新目录（文件还在那儿），
   * 但要把「现在可以删了」这件事告诉用户。
   */
  async function handleUnlock(): Promise<void> {
    const targetPath = path.value;

    if (!targetPath) {
      return;
    }

    isBusy.value = true;

    try {
      await fileLockActions.unlock(targetPath);
    }
    finally {
      isBusy.value = false;
      handleOpenChange(false);
    }
  }

  /** 对话框点了「彻底删除」。 */
  async function handleForceDelete(): Promise<void> {
    const targetPath = path.value;

    if (!targetPath) {
      return;
    }

    isBusy.value = true;

    try {
      const outcome = await fileLockActions.forceDelete(targetPath);

      if (outcome?.deleted || outcome?.scheduledForReboot) {
        refreshParentOf(targetPath);
        userStatsStore.handlePathsDeleted([targetPath]);
        userSettingsStore.handlePathsDeleted([targetPath]);
        dirSizesStore.invalidate([targetPath]);
      }
    }
    finally {
      isBusy.value = false;
      handleOpenChange(false);
    }
  }

  /**
   * 对话框点了「结束进程」。
   *
   * 结束占用者之后**要重新解锁**才有用 ——
   * 光结束进程只是把锁的来源去掉了，还得再探一次「现在能不能删」。
   */
  async function handleTerminateHolders(pids: number[]): Promise<void> {
    const targetPath = path.value;

    isBusy.value = true;

    try {
      await fileLockActions.terminateHolders(pids);

      if (targetPath) {
        await fileLockActions.unlock(targetPath);
      }
    }
    finally {
      isBusy.value = false;
      handleOpenChange(false);
    }
  }

  return {
    isOpen,
    mode,
    path,
    holders,
    isBusy,
    unlockEntry,
    forceDeleteEntry,
    handleUnlock,
    handleForceDelete,
    handleTerminateHolders,
    handleOpenChange,
  };
}
