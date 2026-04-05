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
import { useStatusCenterStore } from './status-center';

interface DeleteJobProgressPayload {
  jobId: string;
  percent: number;
  detail: string;
}

interface DeleteJobFinishedPayload {
  jobId: string;
  success: boolean;
  cancelled: boolean;
  useTrash: boolean;
  error: string | null;
  deletedPaths: string[];
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
        type: 'delete',
        status: 'in-progress',
        label: options.label,
        path: options.displayPath,
        progress: 0,
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
