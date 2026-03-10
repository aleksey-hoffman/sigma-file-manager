// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

export function createShellAPI(context: ExtensionContext) {
  return {
    run: async (commandPath: string, args?: string[]): Promise<{ code: number;
      stdout: string;
      stderr: string; }> => {
      if (!context.hasPermission('shell')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'shell' }));
      }

      return invoke<{ code: number;
        stdout: string;
        stderr: string; }>('run_extension_command', {
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

      const taskId = await invoke<string>('start_extension_command', {
        extensionId: context.extensionId,
        commandPath,
        args: args || [],
      });

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

      const unlistenProgress = await listen<{
        taskId: string;
        line: string;
        isStderr: boolean;
      }>('extension-command-progress', (event) => {
        if (event.payload.taskId !== taskId) return;
        if (onProgress) onProgress(event.payload);
      });

      const unlistenComplete = await listen<{
        taskId: string;
        code: number;
        stdout: string;
        stderr: string;
      }>('extension-command-complete', (event) => {
        if (event.payload.taskId !== taskId) return;
        unlistenProgress();
        unlistenComplete();

        if (resolveResult) {
          resolveResult({
            code: event.payload.code,
            stdout: event.payload.stdout,
            stderr: event.payload.stderr,
          });
        }
      });

      async function cancel(): Promise<void> {
        try {
          await invoke('cancel_extension_command', { taskId });
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

      return invoke<number>('rename_part_files_to_ts', { directory });
    },
  };
}
