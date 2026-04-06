// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { BinaryInfo, ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { invokeMock, getExtensionSettingsMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  getExtensionSettingsMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    getExtensionSettings: getExtensionSettingsMock,
  }),
}));

import { createBinaryAPI } from '@/modules/extensions/api/create-binary-api';

function createContext(permissions: ExtensionPermission[] = ['shell']): ExtensionContext {
  return {
    extensionId: 'test.extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    t: (key: string) => key,
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

function createStoredBinaryInfo(): BinaryInfo {
  return {
    id: 'ffmpeg',
    path: '/shared/ffmpeg',
    version: '7.1.0',
    downloadUrl: 'https://example.com/ffmpeg.zip',
    installedAt: 123,
  };
}

describe('createBinaryAPI', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    getExtensionSettingsMock.mockReset();
  });

  it('returns null when the stored binary path no longer exists', async () => {
    getExtensionSettingsMock.mockResolvedValue({
      customSettings: {
        __binaries: {
          ffmpeg: createStoredBinaryInfo(),
        },
      },
    });
    invokeMock.mockResolvedValue(false);
    const binaryApi = createBinaryAPI(createContext(['shell']));

    await expect(binaryApi.getPath('ffmpeg')).resolves.toBeNull();
    await expect(binaryApi.isInstalled('ffmpeg')).resolves.toBe(false);
    await expect(binaryApi.getInfo('ffmpeg')).resolves.toBeNull();

    expect(invokeMock).toHaveBeenCalledWith('path_exists', { path: '/shared/ffmpeg' });
  });

  it('returns a cloned binary info object when the path exists', async () => {
    const storedBinaryInfo = createStoredBinaryInfo();
    getExtensionSettingsMock.mockResolvedValue({
      customSettings: {
        __binaries: {
          ffmpeg: storedBinaryInfo,
        },
      },
    });
    invokeMock.mockResolvedValue(true);
    const binaryApi = createBinaryAPI(createContext(['shell']));

    const resolvedBinaryInfo = await binaryApi.getInfo('ffmpeg');

    expect(resolvedBinaryInfo).toEqual(storedBinaryInfo);
    expect(resolvedBinaryInfo).not.toBe(storedBinaryInfo);
  });

  it('returns null when the path existence check fails', async () => {
    getExtensionSettingsMock.mockResolvedValue({
      customSettings: {
        __binaries: {
          ffmpeg: createStoredBinaryInfo(),
        },
      },
    });
    invokeMock.mockRejectedValue(new Error('failed'));
    const binaryApi = createBinaryAPI(createContext(['shell']));

    await expect(binaryApi.getPath('ffmpeg')).resolves.toBeNull();
  });

  it('requires shell permission', async () => {
    const binaryApi = createBinaryAPI(createContext([]));

    await expect(binaryApi.getPath('ffmpeg')).rejects.toThrow('extensions.api.permissionDeniedBinary');
    expect(getExtensionSettingsMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
