// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { markRaw, shallowRef } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { translateArchiveErrorMessage } from '@/utils/translate-archive-error-message';
import uniqueId from '@/utils/unique-id';
import { useStatusCenterStore } from './status-center';

export type StartArchiveJobRequest
  = | {
    kind: 'extractHere';
    archivePath: string;
    destinationDir: string;
  }
  | {
    kind: 'extractToNamedFolder';
    archivePath: string;
  }
  | {
    kind: 'compress';
    sourcePaths: string[];
    destinationZipPath: string;
  };

interface ArchiveJobProgressPayload {
  jobId: string;
  percent: number;
  detail: string;
}

interface ArchiveJobFinishedPayload {
  jobId: string;
  success: boolean;
  cancelled: boolean;
  error: string | null;
  resultPath?: string | null;
}

export interface StartArchiveJobOptions {
  label: string;
  displayPath: string;
  onComplete?: (detail?: { resultPath?: string | null }) => void;
}

export const useArchiveJobsStore = defineStore('archive-jobs', () => {
  const eventUnlisteners = shallowRef<UnlistenFn[]>([]);
  const completionHandlers = new Map<
    string,
    { onComplete?: (detail?: { resultPath?: string | null }) => void }
  >();

  async function ensureEventListeners() {
    if (eventUnlisteners.value.length > 0) {
      return;
    }

    const statusCenterStore = useStatusCenterStore();

    const progressUnlisten = await listen<ArchiveJobProgressPayload>(
      'archive-job-progress',
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

    const finishedUnlisten = await listen<ArchiveJobFinishedPayload>(
      'archive-job-finished',
      (event) => {
        const payload = event.payload;
        const handlers = completionHandlers.get(payload.jobId);
        completionHandlers.delete(payload.jobId);

        if (payload.cancelled) {
          statusCenterStore.completeOperation(payload.jobId, 'cancelled');
        }
        else if (payload.success) {
          statusCenterStore.completeOperation(payload.jobId, 'completed');
          handlers?.onComplete?.({ resultPath: payload.resultPath });
        }
        else {
          const rawError
            = payload.error ?? i18n.global.t('fileBrowser.archive.unknownError');
          const errorText = translateArchiveErrorMessage(rawError);
          statusCenterStore.completeOperation(
            payload.jobId,
            'error',
            errorText,
          );
          toast.custom(markRaw(ToastStatic), {
            componentProps: {
              data: {
                title: i18n.global.t('fileBrowser.archive.operationErrorTitle'),
                description: errorText,
              },
            },
            duration: 5000,
          });
        }
      },
    );

    eventUnlisteners.value = [progressUnlisten, finishedUnlisten];
  }

  async function startJob(request: StartArchiveJobRequest, options: StartArchiveJobOptions) {
    await ensureEventListeners();
    const statusCenterStore = useStatusCenterStore();
    const jobId = uniqueId();

    completionHandlers.set(jobId, { onComplete: options.onComplete });
    statusCenterStore.addOperation({
      id: jobId,
      type: 'archive',
      status: 'in-progress',
      label: options.label,
      path: options.displayPath,
      progress: 0,
    });

    try {
      await invoke<string>('start_archive_job', {
        request,
        jobId,
      });
      return jobId;
    }
    catch (error) {
      completionHandlers.delete(jobId);
      statusCenterStore.removeOperation(jobId);
      throw error;
    }
  }

  async function cancelJob(jobId: string) {
    await invoke<boolean>('cancel_archive_job', { jobId });
  }

  return {
    ensureEventListeners,
    startJob,
    cancelJob,
  };
});
