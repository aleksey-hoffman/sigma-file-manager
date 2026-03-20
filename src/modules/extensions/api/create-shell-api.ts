// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { listen } from '@tauri-apps/api/event';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

export function createShellAPI(context: ExtensionContext) {
  return {
    run: async (commandPath: string, args?: string[]): Promise<{ code: number;
      stdout: string;
      stderr: string; }> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      return invokeAsExtension<{ code: number;
        stdout: string;
        stderr: string; }>(context.extensionId, 'run_extension_command', {
        extensionId: context.extensionId,
        commandPath,
        args: args || [],
      });
    },
    runWithProgress: async (
      commandPath: string,
      args?: string[],
      onProgress?: (payload: { taskId: string;
        line: string;
        isStderr: boolean; }) => void,
    ): Promise<{
      taskId: string;
      result: Promise<{ code: number;
        stdout: string;
        stderr: string; }>;
      cancel: () => Promise<void>;
    }> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      let resolveResult: ((value: { code: number;
        stdout: string;
        stderr: string; }) => void) | null = null;
      let rejectResult: ((reason?: unknown) => void) | null = null;

      const resultPromise = new Promise<{ code: number;
        stdout: string;
        stderr: string; }>((resolve, reject) => {
        resolveResult = resolve;
        rejectResult = reject;
      });

      type ProgressPayload = { taskId: string;
        line: string;
        isStderr: boolean; };
      type CompletePayload = { taskId: string;
        code: number;
        stdout: string;
        stderr: string; };
      type EarlyEvent
        = | { type: 'progress';
          payload: ProgressPayload; }
          | { type: 'complete';
            payload: CompletePayload; };

      let taskId: string | null = null;
      let settled = false;
      const earlyEvents: EarlyEvent[] = [];

      function handleProgress(payload: ProgressPayload): void {
        if (onProgress) onProgress(payload);
      }

      function handleComplete(payload: CompletePayload): void {
        if (settled) return;
        settled = true;
        unlistenProgress();
        unlistenComplete();

        if (resolveResult) {
          resolveResult({
            code: payload.code,
            stdout: payload.stdout,
            stderr: payload.stderr,
          });
        }
      }

      const unlistenProgress = await listen<ProgressPayload>(
        'extension-command-progress',
        (event) => {
          if (taskId === null) {
            earlyEvents.push({
              type: 'progress',
              payload: event.payload,
            });
            return;
          }

          if (event.payload.taskId !== taskId) return;
          handleProgress(event.payload);
        },
      );

      const unlistenComplete = await listen<CompletePayload>(
        'extension-command-complete',
        (event) => {
          if (taskId === null) {
            earlyEvents.push({
              type: 'complete',
              payload: event.payload,
            });
            return;
          }

          if (event.payload.taskId !== taskId) return;
          handleComplete(event.payload);
        },
      );

      try {
        taskId = await invokeAsExtension<string>(context.extensionId, 'start_extension_command', {
          extensionId: context.extensionId,
          commandPath,
          args: args || [],
        });

        for (const event of earlyEvents) {
          if (event.payload.taskId !== taskId) continue;

          if (event.type === 'progress') {
            handleProgress(event.payload);
          }
          else {
            handleComplete(event.payload);
          }
        }

        earlyEvents.length = 0;
      }
      catch (error) {
        unlistenProgress();
        unlistenComplete();
        throw error;
      }

      async function cancel(): Promise<void> {
        try {
          await invokeAsExtension<void>(context.extensionId, 'cancel_extension_command', { taskId: taskId! });
        }
        catch (error) {
          if (rejectResult) rejectResult(error);
        }
      }

      return {
        taskId,
        result: resultPromise,
        cancel,
      };
    },
    renamePartFilesToTs: async (directory: string): Promise<number> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      return invokeAsExtension<number>(context.extensionId, 'rename_part_files_to_ts', { directory });
    },
  };
}
