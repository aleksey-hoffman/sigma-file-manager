// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionCommand, Disposable } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import { addCommandRegistration, findCommandRegistration } from '@/modules/extensions/api/registrations';
import {
  getBuiltinCommandHandler,
  getBuiltinCommandRequiredPermission,
  isBuiltinCommand,
  getBuiltinCommandDefinitions,
} from '@/modules/extensions/builtin-commands';
import { getFullCommandId } from '@/modules/extensions/utils/manifest-utils';

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
        handler: async (...args) => {
          context.grantSessionAccessFromCurrentNavigation();
          return handler(...args);
        },
      });
    },
    executeCommand: async (commandId: string, ...args: unknown[]): Promise<unknown> => {
      if (isBuiltinCommand(commandId)) {
        const requiredPermission = getBuiltinCommandRequiredPermission(commandId);

        if (requiredPermission && !context.hasPermission(requiredPermission)) {
          throw new Error(context.t('extensions.api.permissionDenied', { permission: requiredPermission }));
        }

        const handler = getBuiltinCommandHandler(commandId);

        if (!handler) {
          throw new Error(`Built-in command not found: ${commandId}`);
        }

        return handler(...args);
      }

      const directRegistration = findCommandRegistration(commandId);

      if (directRegistration && directRegistration.extensionId !== context.extensionId) {
        throw new Error('Cross-extension command execution is not allowed');
      }

      const fullCommandId = directRegistration ? commandId : getFullCommandId(context.extensionId, commandId);
      const registration = directRegistration ?? findCommandRegistration(fullCommandId);

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
