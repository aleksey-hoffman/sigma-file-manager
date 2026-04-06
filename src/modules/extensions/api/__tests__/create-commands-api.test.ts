// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { ExtensionCommand, ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const {
  addCommandRegistrationMock,
  findCommandRegistrationMock,
  getBuiltinCommandDefinitionsMock,
  getBuiltinCommandHandlerMock,
  getBuiltinCommandRequiredPermissionMock,
  isBuiltinCommandMock,
} = vi.hoisted(() => ({
  addCommandRegistrationMock: vi.fn(),
  findCommandRegistrationMock: vi.fn(),
  getBuiltinCommandDefinitionsMock: vi.fn(() => []),
  getBuiltinCommandHandlerMock: vi.fn(),
  getBuiltinCommandRequiredPermissionMock: vi.fn(),
  isBuiltinCommandMock: vi.fn(),
}));

vi.mock('@/modules/extensions/api/registrations', () => ({
  addCommandRegistration: addCommandRegistrationMock,
  findCommandRegistration: findCommandRegistrationMock,
}));

vi.mock('@/modules/extensions/builtin-commands', () => ({
  getBuiltinCommandDefinitions: getBuiltinCommandDefinitionsMock,
  getBuiltinCommandHandler: getBuiltinCommandHandlerMock,
  getBuiltinCommandRequiredPermission: getBuiltinCommandRequiredPermissionMock,
  isBuiltinCommand: isBuiltinCommandMock,
}));

import { createCommandsAPI } from '@/modules/extensions/api/create-commands-api';

function createContext(permissions: ExtensionPermission[] = []): ExtensionContext {
  return {
    extensionId: 'test.extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    t: (key: string, params?: Record<string, string | number>) => params?.permission
      ? `${key}:${params.permission}`
      : key,
    getExtensionPath: vi.fn(),
    getExtensionStoragePath: vi.fn(),
    isPathWithinDirectory: vi.fn(),
    isInExtensionDir: vi.fn(),
    isInExtensionStorageDir: vi.fn(),
    getSharedBinariesDir: vi.fn(),
    isInSharedBinariesDir: vi.fn(),
    isInAllowedReadDir: vi.fn(),
    isInAllowedWriteDir: vi.fn(),
    normalizeRelativePath: vi.fn(),
    resolvePrivatePath: vi.fn(),
    resolveStoragePath: vi.fn(),
    getExtensionName: vi.fn(),
    getExtensionIconPath: vi.fn(),
    getExtensionToastTitle: vi.fn(),
    grantDialogReadAccess: vi.fn(),
    hasDialogReadAccess: vi.fn(),
    grantDialogWriteAccess: vi.fn(),
    consumeDialogWriteAccess: vi.fn(),
  };
}

describe('createCommandsAPI', () => {
  it('blocks cross-extension command execution', async () => {
    isBuiltinCommandMock.mockReturnValue(false);

    const commandsApi = createCommandsAPI(createContext());

    await expect(commandsApi.executeCommand('other.extension.test-command')).rejects.toThrow(
      'Cross-extension command execution is not allowed',
    );
    expect(findCommandRegistrationMock).not.toHaveBeenCalled();
  });

  it('blocks built-in commands when the required permission is missing', async () => {
    isBuiltinCommandMock.mockReturnValue(true);
    getBuiltinCommandRequiredPermissionMock.mockReturnValue('dialogs');

    const builtinHandler = vi.fn();
    getBuiltinCommandHandlerMock.mockReturnValue(builtinHandler);

    const commandsApi = createCommandsAPI(createContext());

    await expect(commandsApi.executeCommand('sigma.dialog.openFile')).rejects.toThrow(
      'extensions.api.permissionDenied:dialogs',
    );
    expect(builtinHandler).not.toHaveBeenCalled();
  });

  it('runs built-in commands when the required permission is granted', async () => {
    isBuiltinCommandMock.mockReturnValue(true);
    getBuiltinCommandRequiredPermissionMock.mockReturnValue('dialogs');

    const builtinHandler = vi.fn().mockResolvedValue('selected-file');
    getBuiltinCommandHandlerMock.mockReturnValue(builtinHandler);

    const commandsApi = createCommandsAPI(createContext(['dialogs']));

    await expect(commandsApi.executeCommand('sigma.dialog.openFile')).resolves.toBe('selected-file');
    expect(builtinHandler).toHaveBeenCalledTimes(1);
  });

  it('runs built-in commands without an extra permission requirement', async () => {
    isBuiltinCommandMock.mockReturnValue(true);
    getBuiltinCommandRequiredPermissionMock.mockReturnValue(undefined);

    const builtinHandler = vi.fn().mockResolvedValue(undefined);
    getBuiltinCommandHandlerMock.mockReturnValue(builtinHandler);

    const commandsApi = createCommandsAPI(createContext());

    await expect(commandsApi.executeCommand('sigma.app.openSettings')).resolves.toBeUndefined();
    expect(builtinHandler).toHaveBeenCalledTimes(1);
  });

  it('registers extension commands with the extension id prefix', () => {
    addCommandRegistrationMock.mockReturnValue({
      dispose: vi.fn(),
    });

    const commandsApi = createCommandsAPI(createContext(['commands']));
    const command: ExtensionCommand = {
      id: 'test-command',
      title: 'Test Command',
    };
    const handler = vi.fn();

    commandsApi.registerCommand(command, handler);

    expect(addCommandRegistrationMock).toHaveBeenCalledWith({
      extensionId: 'test.extension',
      command: {
        id: 'test.extension.test-command',
        title: 'Test Command',
      },
      handler,
    });
  });

  it('executes registered extension commands by resolving the full command id', async () => {
    isBuiltinCommandMock.mockReturnValue(false);

    const registeredHandler = vi.fn().mockResolvedValue('ok');
    findCommandRegistrationMock.mockReturnValue({
      extensionId: 'test.extension',
      handler: registeredHandler,
    });

    const commandsApi = createCommandsAPI(createContext());

    await expect(commandsApi.executeCommand('test-command', 'value')).resolves.toBe('ok');
    expect(findCommandRegistrationMock).toHaveBeenCalledWith('test.extension.test-command');
    expect(registeredHandler).toHaveBeenCalledWith('value');
  });

  it('executes registered extension commands when called with the own fully qualified id', async () => {
    isBuiltinCommandMock.mockReturnValue(false);

    const registeredHandler = vi.fn().mockResolvedValue('ok');
    findCommandRegistrationMock.mockReturnValue({
      extensionId: 'test.extension',
      handler: registeredHandler,
    });

    const commandsApi = createCommandsAPI(createContext());

    await expect(commandsApi.executeCommand('test.extension.test-command', 'value')).resolves.toBe('ok');
    expect(findCommandRegistrationMock).toHaveBeenCalledWith('test.extension.test-command');
    expect(registeredHandler).toHaveBeenCalledWith('value');
  });
});
