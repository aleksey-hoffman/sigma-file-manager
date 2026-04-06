// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

import { createDialogAPI } from '@/modules/extensions/api/create-dialog-api';

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

describe('createDialogAPI', () => {
  it('grants temporary read access to a selected file', async () => {
    const context = createContext(['dialogs']);
    const executeCommand = vi.fn().mockResolvedValue('D:/downloads/cookies.txt');
    const dialogApi = createDialogAPI(context, executeCommand);

    await expect(dialogApi.openFile({ title: 'Pick file' })).resolves.toBe('D:/downloads/cookies.txt');

    expect(executeCommand).toHaveBeenCalledWith('sigma.dialog.openFile', { title: 'Pick file' });
    expect(context.grantDialogReadAccess).toHaveBeenCalledWith('D:/downloads/cookies.txt');
  });

  it('grants temporary read access to each selected file', async () => {
    const context = createContext(['dialogs']);
    const executeCommand = vi.fn().mockResolvedValue(['D:/downloads/a.txt', 'D:/downloads/b.txt']);
    const dialogApi = createDialogAPI(context, executeCommand);

    await expect(dialogApi.openFile({ multiple: true })).resolves.toEqual(['D:/downloads/a.txt', 'D:/downloads/b.txt']);

    expect(context.grantDialogReadAccess).toHaveBeenCalledWith('D:/downloads/a.txt');
    expect(context.grantDialogReadAccess).toHaveBeenCalledWith('D:/downloads/b.txt');
  });
});
