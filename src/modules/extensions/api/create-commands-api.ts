// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionCommand, Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { addCommandRegistration, findCommandRegistration } from '@/modules/extensions/api/registrations';
import {
  getBuiltinCommandHandler,
  isBuiltinCommand,
  getBuiltinCommandDefinitions,
} from '@/modules/extensions/builtin-commands';

export function createCommandsAPI(context: ExtensionContext) {
  return {
    registerCommand: (
      command: ExtensionCommand,
      handler: (...args: unknown[]) => Promise<unknown> | unknown,
    ): Disposable => {
      if (!context.hasPermission('commands')) {
        throw new Error(context.t('extensions.api.permissionDenied', { permission: 'commands' }));
      }

      return addCommandRegistration({
        extensionId: context.extensionId,
        command: {
          ...command,
          id: `${context.extensionId}.${command.id}`,
        },
        handler,
      });
    },
    executeCommand: async (commandId: string, ...args: unknown[]): Promise<unknown> => {
      if (isBuiltinCommand(commandId)) {
        if (commandId.startsWith('sigma.shell.') && !context.hasPermission('shell')) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: 'shell' }));
        }

        const handler = getBuiltinCommandHandler(commandId);

        if (!handler) {
          throw new Error(`Built-in command not found: ${commandId}`);
        }

        return handler(...args);
      }

      const fullCommandId = commandId.includes('.') ? commandId : `${context.extensionId}.${commandId}`;
      const registration = findCommandRegistration(fullCommandId);

      if (!registration) {
        throw new Error(`Command not found: ${fullCommandId}`);
      }

      return registration.handler(...args);
    },
    getBuiltinCommands: () => {
      return getBuiltinCommandDefinitions().map(cmd => ({
        id: cmd.id,
        title: cmd.title,
        description: cmd.description,
      }));
    },
  };
}
