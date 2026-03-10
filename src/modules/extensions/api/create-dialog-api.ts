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

      return executeCommand('sigma.dialog.openFile', options) as Promise<string | string[] | null>;
    },
    saveFile: async (options?: SaveFileDialogOptions): Promise<string | null> => {
      if (!context.hasPermission('dialogs')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'dialogs' }));
      }

      return executeCommand('sigma.dialog.saveFile', options) as Promise<string | null>;
    },
  };
}
