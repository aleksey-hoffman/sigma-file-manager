// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import type { OpenFileDialogOptions, SaveFileDialogOptions } from '@/modules/extensions/builtin-commands';

export function createDialogAPI(
  context: ExtensionContext,
  executeCommand: (commandId: string, ...args: unknown[]) => Promise<unknown>,
) {
  return {
    openFile: async (options?: OpenFileDialogOptions): Promise<string | string[] | null> => {
      if (!context.hasPermission('dialogs')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      const selectedPath = await executeCommand('sigma.dialog.openFile', options) as string | string[] | null;

      if (typeof selectedPath === 'string' && selectedPath.length > 0) {
        context.grantDialogReadAccess(selectedPath);
      }
      else if (Array.isArray(selectedPath)) {
        for (const filePath of selectedPath) {
          if (typeof filePath === 'string' && filePath.length > 0) {
            context.grantDialogReadAccess(filePath);
          }
        }
      }

      return selectedPath;
    },
    saveFile: async (options?: SaveFileDialogOptions): Promise<string | null> => {
      if (!context.hasPermission('dialogs')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      const selectedPath = await executeCommand('sigma.dialog.saveFile', options) as string | null;

      if (typeof selectedPath === 'string' && selectedPath.length > 0) {
        context.grantDialogWriteAccess(selectedPath);
      }

      return selectedPath;
    },
  };
}
