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
import type { FileOperationResult, PathResolutionEntry } from '@/stores/runtime/clipboard';
import { useStatusCenterStore } from './status-center';

interface CopyMoveJobProgressPayload {
  jobId: string;
  percent: number;
  detail: string;
  processedCount?: number | null;
  totalCount?: number | null;
}

interface CopyMoveJobFinishedPayload {
  jobId: string;
  cancelled: boolean;
  success: boolean;
  error: string | null;
  copiedCount?: number;
  failedCount?: number;
  skippedCount?: number;
}

function localizeCopyMoveProgressDetail(detail: string): string {
  const preparingSuffix = ' · Preparing';

  if (detail.endsWith(preparingSuffix)) {
    const prefix = detail.slice(0, -preparingSuffix.length);
    return `${prefix} · ${i18n.global.t('statusCenter.preparing')}`;
  }

  return detail;
}

export interface StartCopyMoveJobOptions {
  label: string;
  displayPath: string;
}

function finishedPayloadToResult(payload: CopyMoveJobFinishedPayload): FileOperationResult {
  return {
    success: payload.success && !payload.cancelled,
    cancelled: payload.cancelled,
    error: payload.error ?? undefined,
    copied_count: payload.copiedCount,
    failed_count: payload.failedCount,
    skipped_count: payload.skippedCount,
    fromStatusCenterJob: true,
  };
}

function toastCopyMoveSuccess(
  payload: CopyMoveJobFinishedPayload,
  operationType: 'copy' | 'move' | undefined,
) {
  const copied = payload.copiedCount ?? 0;
  const skipped = payload.skippedCount ?? 0;
  const isMove = operationType === 'move';

  if (copied === 0 && skipped > 0) {
    toast.custom(markRaw(ToastStatic), {
      componentProps: {
        data: {
          title: i18n.global.t('notifications.skippedAll'),
          description: '',
        },
      },
      duration: 2500,
    });
    return;
  }

  const titleKey = isMove ? 'notifications.movedNItems' : 'notifications.copiedNItems';
  const title = i18n.global.t(titleKey, { n: copied }, copied);
  const description
    = skipped > 0
      ? i18n.global.t('notifications.skippedCount', { n: skipped }, skipped)
      : '';

  toast.custom(markRaw(ToastStatic), {
    componentProps: {
      data: {
        title,
        description,
      },
    },
    duration: 2500,
  });
}

export const useCopyMoveJobsStore = defineStore('copy-move-jobs', () => {
  const eventUnlisteners = shallowRef<UnlistenFn[]>([]);
  const completionHandlers = new Map<
    string,
    { resolve: (result: FileOperationResult) => void }
  >();

  async function ensureEventListeners() {
    if (eventUnlisteners.value.length > 0) {
      return;
    }

    const statusCenterStore = useStatusCenterStore();

    const progressUnlisten = await listen<CopyMoveJobProgressPayload>(
      'copy-move-job-progress',
      (event) => {
        const payload = event.payload;
        const existing = statusCenterStore.getOperation(payload.jobId);

        if (existing?.status === 'cancelling') {
          return;
        }

        statusCenterStore.updateOperation(payload.jobId, {
          status: 'in-progress',
          progress: payload.percent,
          message: localizeCopyMoveProgressDetail(payload.detail),
          processedCount: payload.processedCount ?? undefined,
          totalCount: payload.totalCount ?? undefined,
        });
      },
    );

    const finishedUnlisten = await listen<CopyMoveJobFinishedPayload>(
      'copy-move-job-finished',
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
          handlers.resolve(finishedPayloadToResult(payload));
        }
        else if (payload.success) {
          statusCenterStore.completeOperation(payload.jobId, 'completed');
          const copyMoveKind: 'copy' | 'move' | undefined
            = existingOp?.type === 'copy' || existingOp?.type === 'move'
              ? existingOp.type
              : undefined;
          toastCopyMoveSuccess(payload, copyMoveKind);
          handlers.resolve(finishedPayloadToResult(payload));
        }
        else {
          const fallbackTitle = existingOp?.type === 'move'
            ? i18n.global.t('fileBrowser.moveFailed')
            : i18n.global.t('fileBrowser.copyFailed');
          const errorText = payload.error ?? fallbackTitle;
          statusCenterStore.completeOperation(
            payload.jobId,
            'error',
            errorText,
          );
          toast.custom(markRaw(ToastStatic), {
            componentProps: {
              data: {
                title: fallbackTitle,
                description: payload.error ?? '',
              },
            },
            duration: 5000,
          });
          handlers.resolve(finishedPayloadToResult(payload));
        }
      },
    );

    eventUnlisteners.value = [progressUnlisten, finishedUnlisten];
  }

  async function startJob(
    kind: 'copy' | 'move',
    sourcePaths: string[],
    destinationPath: string,
    conflictResolution: null,
    perPathResolutions: PathResolutionEntry[] | undefined,
    options: StartCopyMoveJobOptions,
  ): Promise<FileOperationResult> {
    await ensureEventListeners();
    const statusCenterStore = useStatusCenterStore();
    const jobId = uniqueId();

    return new Promise((resolve, reject) => {
      completionHandlers.set(jobId, { resolve });
      statusCenterStore.addOperation({
        id: jobId,
        type: kind,
        status: 'in-progress',
        label: options.label,
        path: options.displayPath,
        progress: 0,
        sourceDisplayName: sourceDisplayNameFromPaths(sourcePaths),
      });

      invoke('start_copy_move_job', {
        request: {
          kind,
          sourcePaths,
          destinationPath,
          conflictResolution,
          perPathResolutions:
            perPathResolutions && perPathResolutions.length > 0
              ? perPathResolutions.map(entry => ({
                  destination_path: entry.destination_path,
                  resolution: entry.resolution,
                }))
              : null,
          jobId,
        },
      }).catch((error: unknown) => {
        completionHandlers.delete(jobId);
        statusCenterStore.removeOperation(jobId);
        reject(error);
      });
    });
  }

  async function cancelJob(jobId: string) {
    await invoke<boolean>('cancel_copy_move_job', { jobId });
  }

  return {
    ensureEventListeners,
    startJob,
    cancelJob,
  };
});
