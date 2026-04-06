// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { invokeAsExtensionMock, hasScopedAccessMock } = vi.hoisted(() => ({
  invokeAsExtensionMock: vi.fn(),
  hasScopedAccessMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    hasScopedAccess: hasScopedAccessMock,
    addScopedDirectory: vi.fn(),
    getExtensionSettings: vi.fn(),
  }),
}));

import { createFsAPI } from '@/modules/extensions/api/create-fs-api';

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

describe('createFsAPI', () => {
  beforeEach(() => {
    invokeAsExtensionMock.mockReset();
    hasScopedAccessMock.mockReset();
  });

  it('allows generic exists for extension storage paths', async () => {
    const context = createContext(['fs.read']);
    context.isInAllowedReadDir = vi.fn(async () => true);
    invokeAsExtensionMock.mockResolvedValueOnce(true);
    const fsApi = createFsAPI(context);

    await expect(fsApi.exists('/extension-storage/secrets/youtube-cookies.txt')).resolves.toBe(true);

    expect(context.isInAllowedReadDir).toHaveBeenCalledWith('/extension-storage/secrets/youtube-cookies.txt');
    expect(invokeAsExtensionMock).toHaveBeenCalledWith('test.extension', 'path_exists', {
      path: '/extension-storage/secrets/youtube-cookies.txt',
    });
  });

  it('allows generic writeFile for extension storage paths', async () => {
    const context = createContext(['fs.write']);
    context.consumeDialogWriteAccess = vi.fn(() => false);
    context.isInAllowedWriteDir = vi.fn(async () => true);
    invokeAsExtensionMock.mockResolvedValueOnce(undefined);
    const fsApi = createFsAPI(context);
    const fileBytes = new Uint8Array([1, 2, 3]);

    await expect(fsApi.writeFile('/extension-storage/secrets/youtube-cookies.txt', fileBytes)).resolves.toBeUndefined();

    expect(context.isInAllowedWriteDir).toHaveBeenCalledWith('/extension-storage/secrets/youtube-cookies.txt');
    expect(invokeAsExtensionMock).toHaveBeenCalledWith('test.extension', 'write_file_binary', {
      path: '/extension-storage/secrets/youtube-cookies.txt',
      data: [1, 2, 3],
    });
  });

  it('allows importing a file selected from a dialog', async () => {
    const context = createContext(['fs.read', 'fs.write']);
    context.isInAllowedReadDir = vi.fn(async () => true);
    context.normalizeRelativePath = vi.fn((value: string) => value);
    invokeAsExtensionMock.mockResolvedValueOnce('/extension-storage/secrets/youtube-cookies.txt');
    const fsApi = createFsAPI(context);

    await expect(
      fsApi.storage.importFile('/downloads/cookies.txt', 'secrets/youtube-cookies.txt'),
    ).resolves.toBe('/extension-storage/secrets/youtube-cookies.txt');

    expect(context.isInAllowedReadDir).toHaveBeenCalledWith('/downloads/cookies.txt');
    expect(invokeAsExtensionMock).toHaveBeenCalledWith('test.extension', 'import_extension_storage_file', {
      extensionId: 'test.extension',
      sourcePath: '/downloads/cookies.txt',
      targetRelativePath: 'secrets/youtube-cookies.txt',
    });
  });
});
