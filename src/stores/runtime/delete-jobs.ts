// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { markRaw, shallowRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import uniqueId from '@/utils/unique-id';
import { sourceDisplayNameFromPaths } from '@/utils/source-display-name';
import { useStatusCenterStore } from './status-center';

interface DeleteJobProgressPayload {
  jobId: string;
  percent: number;
  detail: string;
  processedCount?: number | null;
  totalCount?: number | null;
  /**
   * FORK-MODIFICATION 2026-10-22：进度语义从「顶层路径数」换成「条目数」。
   *
   * 旧口径在删一棵含 25 万个文件的目录树时，进度条在整个删除期间几乎不动
   * （用户看到「4% 卡住 40 分钟」）。新口径按条目推进，字节数作辅助。
   */
  phase?: 'scanning' | 'deleting';
  deletedItems?: number;
  freedBytes?: number;
  totalBytes?: number | null;
  itemPercent?: number | null;
  bytePercent?: number | null;
  files?: number;
  directories?: number;
  currentPath?: string;
}

interface DeleteJobFinishedPayload {
  jobId: string;
  success: boolean;
  cancelled: boolean;
  useTrash: boolean;
  error: string | null;
  deletedPaths: string[];
  /** 真正删掉的条目数（文件 + 目录）。 */
  deletedItems?: number;
  /** 真正释放的字节数。 */
  freedBytes?: number;
  /** 预扫描得到的条目总数。 */
  totalItems?: number;
  /** 预扫描得到的文件数。 */
  files?: number;
  /** 预扫描得到的目录数。 */
  directories?: number;
  /** 预扫描得到的总字节。 */
  totalBytes?: number;
}

export interface DeleteJobResult {
  success: boolean;
  cancelled: boolean;
  error: string | null;
  deletedPaths: string[];
}

export interface StartDeleteJobOptions {
  label: string;
  displayPath: string;
}

function toastDeleteSuccess(payload: DeleteJobFinishedPayload) {
  // FORK-MODIFICATION 2026-10-22：报**真实删掉的条目数**。
  //
  // 旧实现报的是顶层路径数 —— 删一棵含 25 万个文件的目录树，弹出来的却是
  // 「已删除 1 项」。数字小到让人以为没删掉。
  const deletedCount = payload.deletedItems ?? payload.deletedPaths.length;
  const titleKey = payload.useTrash
    ? 'notifications.trashedNItems'
    : 'notifications.deletedNItems';

  toast.custom(markRaw(ToastStatic), {
    componentProps: {
      data: {
        title: i18n.global.t(titleKey, { totalAmount: deletedCount }),
        description: '',
      },
    },
    duration: 2500,
  });
}

export const useDeleteJobsStore = defineStore('delete-jobs', () => {
  const eventUnlisteners = shallowRef<UnlistenFn[]>([]);
  const completionHandlers = new Map<
    string,
    { resolve: (result: DeleteJobResult) => void }
  >();

  async function ensureEventListeners() {
    if (eventUnlisteners.value.length > 0) {
      return;
    }

    const statusCenterStore = useStatusCenterStore();

    const progressUnlisten = await listen<DeleteJobProgressPayload>(
      'delete-job-progress',
      (event) => {
        const payload = event.payload;
        const existing = statusCenterStore.getOperation(payload.jobId);

        if (existing?.status === 'cancelling') {
          return;
        }

        statusCenterStore.updateOperation(payload.jobId, {
          status: 'in-progress',
          progress: payload.percent,
          message: payload.detail,
          processedCount: payload.processedCount ?? undefined,
          totalCount: payload.totalCount ?? undefined,
          phase: payload.phase,
          deletedItems: payload.deletedItems,
          freedBytes: payload.freedBytes,
          totalBytes: payload.totalBytes ?? undefined,
          itemPercent: payload.itemPercent ?? undefined,
          bytePercent: payload.bytePercent ?? undefined,
          files: payload.files,
          directories: payload.directories,
          currentPath: payload.currentPath,
        });
      },
    );

    const finishedUnlisten = await listen<DeleteJobFinishedPayload>(
      'delete-job-finished',
      (event) => {
        const payload = event.payload;
        const handlers = completionHandlers.get(payload.jobId);
        completionHandlers.delete(payload.jobId);
        const existingOp = statusCenterStore.getOperation(payload.jobId);

        if (!handlers) {
          if (
            existingOp
            && (
              existingOp.status === 'in-progress'
              || existingOp.status === 'pending'
              || existingOp.status === 'cancelling'
            )
          ) {
            statusCenterStore.removeOperation(payload.jobId);
          }

          return;
        }

        if (payload.cancelled) {
          statusCenterStore.completeOperation(payload.jobId, 'cancelled');
          handlers.resolve({
            success: false,
            cancelled: true,
            error: null,
            deletedPaths: payload.deletedPaths,
          });
        }
        else if (payload.success) {
          statusCenterStore.completeOperation(payload.jobId, 'completed');
          toastDeleteSuccess(payload);
          handlers.resolve({
            success: true,
            cancelled: false,
            error: null,
            deletedPaths: payload.deletedPaths,
          });
        }
        else {
          const fallbackError = payload.useTrash
            ? i18n.global.t('notifications.errorTrashItems')
            : i18n.global.t('notifications.errorDeleteItems');
          const errorText = payload.error ?? fallbackError;
          statusCenterStore.completeOperation(
            payload.jobId,
            'error',
            errorText,
          );
          toast.custom(markRaw(ToastStatic), {
            componentProps: {
              data: {
                title: fallbackError,
                description: payload.error ?? '',
              },
            },
            duration: 5000,
          });
          handlers.resolve({
            success: false,
            cancelled: false,
            error: errorText,
            deletedPaths: payload.deletedPaths,
          });
        }
      },
    );

    eventUnlisteners.value = [progressUnlisten, finishedUnlisten];
  }

  async function startJob(
    paths: string[],
    useTrash: boolean,
    options: StartDeleteJobOptions,
  ): Promise<DeleteJobResult> {
    await ensureEventListeners();
    const statusCenterStore = useStatusCenterStore();
    const jobId = uniqueId();

    return new Promise((resolve, reject) => {
      completionHandlers.set(jobId, { resolve });
      statusCenterStore.addOperation({
        id: jobId,
        type: useTrash ? 'deleteTrash' : 'deletePermanent',
        status: 'in-progress',
        label: options.label,
        path: options.displayPath,
        progress: 0,
        sourceDisplayName: sourceDisplayNameFromPaths(paths),
      });

      invoke('start_delete_job', {
        paths,
        useTrash,
        jobId,
      }).catch((error: unknown) => {
        completionHandlers.delete(jobId);
        statusCenterStore.removeOperation(jobId);
        reject(error);
      });
    });
  }

  async function cancelJob(jobId: string) {
    await invoke<boolean>('cancel_delete_job', { jobId });
  }

  return {
    ensureEventListeners,
    startJob,
    cancelJob,
  };
});
