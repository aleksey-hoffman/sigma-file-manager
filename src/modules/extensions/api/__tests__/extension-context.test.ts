// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionPermission } from '@/types/extension';

const { invokeMock, hasScopedAccessMock, invokeAsExtensionMock, sharedBinariesMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  hasScopedAccessMock: vi.fn(),
  invokeAsExtensionMock: vi.fn(),
  sharedBinariesMock: {} as Record<string, {
    path: string;
    source?: 'managed' | 'custom';
    usedBy: string[];
  }>,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    hasScopedAccess: hasScopedAccessMock,
    extensionsData: {
      sharedBinaries: sharedBinariesMock,
    },
  }),
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@/modules/extensions/api/platform', () => ({
  getPlatformInfo: () => ({
    pathSeparator: '/',
  }),
}));

vi.mock('@/modules/extensions/context', () => ({
  getCurrentPath: vi.fn(() => null),
  getSelectedEntries: vi.fn(() => []),
}));

import { createExtensionContext } from '@/modules/extensions/api/extension-context';

describe('createExtensionContext', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    hasScopedAccessMock.mockReset();
    hasScopedAccessMock.mockResolvedValue(false);
    invokeAsExtensionMock.mockReset();
    Object.keys(sharedBinariesMock).forEach((key) => {
      delete sharedBinariesMock[key];
    });
    invokeAsExtensionMock.mockImplementation(async (_extensionId: string, command: string) => {
      if (command === 'get_extension_path') {
        return '/extensions/test.extension';
      }

      if (command === 'get_extension_storage_path') {
        return '/extensions-storage/test.extension';
      }

      throw new Error(`Unexpected invokeAsExtension command: ${command}`);
    });
    invokeMock.mockImplementation(async (command: string, args?: {
      path?: string;
      directory?: string;
    }) => {
      if (command === 'get_shared_binaries_base_dir') {
        return '/shared-binaries';
      }

      if (command !== 'is_path_within_directory') {
        throw new Error(`Unexpected invoke command: ${command}`);
      }

      return Boolean(args?.path?.startsWith(`${args?.directory}/`) || args?.path === args?.directory);
    });
  });

  it('treats extension storage paths as allowed read paths', async () => {
    const context = createExtensionContext('test.extension', ['fs.read' as ExtensionPermission]);

    await expect(
      context.isInAllowedReadDir('/extensions-storage/test.extension/secrets/youtube-cookies.txt'),
    ).resolves.toBe(true);

    expect(hasScopedAccessMock).not.toHaveBeenCalled();
  });

  it('treats extension storage paths as allowed write paths', async () => {
    const context = createExtensionContext('test.extension', ['fs.write' as ExtensionPermission]);

    await expect(
      context.isInAllowedWriteDir('/extensions-storage/test.extension/secrets/youtube-cookies.txt'),
    ).resolves.toBe(true);

    expect(hasScopedAccessMock).not.toHaveBeenCalled();
  });

  it('treats dialog-selected files as allowed read paths', async () => {
    const context = createExtensionContext('test.extension', ['fs.read' as ExtensionPermission]);
    context.grantDialogReadAccess('/downloads/cookies.txt');

    await expect(
      context.isInAllowedReadDir('/downloads/cookies.txt'),
    ).resolves.toBe(true);

    expect(hasScopedAccessMock).not.toHaveBeenCalled();
  });

  it('treats session-granted parent directories as allowed read paths for subfolders', async () => {
    const context = createExtensionContext('test.extension', ['fs.read' as ExtensionPermission]);
    context.grantSessionAccessFromNavigation({
      currentPath: '',
      selectedEntries: [{
        path: '/downloads/video.mp4',
        name: 'video.mp4',
        isDirectory: false,
      }],
    });

    await expect(
      context.isInAllowedReadDir('/downloads/converted/output.mp4'),
    ).resolves.toBe(true);

    expect(hasScopedAccessMock).not.toHaveBeenCalled();
  });

  it('treats session-granted parent directories as allowed write paths for subfolders', async () => {
    const context = createExtensionContext('test.extension', ['fs.write' as ExtensionPermission]);
    context.grantSessionAccessFromNavigation({
      currentPath: '',
      selectedEntries: [{
        path: '/downloads/video.mp4',
        name: 'video.mp4',
        isDirectory: false,
      }],
    });

    await expect(
      context.isInAllowedWriteDir('/downloads/converted/output.mp4'),
    ).resolves.toBe(true);

    expect(hasScopedAccessMock).not.toHaveBeenCalled();
  });

  it('treats custom binary paths and sibling executables as allowed read paths for using extensions', async () => {
    sharedBinariesMock.ffmpeg = {
      path: '/downloads/ffmpeg/bin/ffmpeg.exe',
      source: 'custom',
      usedBy: ['test.extension'],
    };

    const context = createExtensionContext('test.extension', ['fs.read' as ExtensionPermission]);

    await expect(
      context.isInAllowedReadDir('/downloads/ffmpeg/bin/ffmpeg.exe'),
    ).resolves.toBe(true);

    await expect(
      context.isInAllowedReadDir('/downloads/ffmpeg/bin/ffprobe.exe'),
    ).resolves.toBe(true);

    hasScopedAccessMock.mockClear();

    await expect(
      context.isInAllowedReadDir('/downloads/ffmpeg/other/file.txt'),
    ).resolves.toBe(false);
  });

  it('does not treat custom binary paths as allowed for unrelated extensions', async () => {
    sharedBinariesMock.ffmpeg = {
      path: '/downloads/ffmpeg/bin/ffmpeg.exe',
      source: 'custom',
      usedBy: ['other.extension'],
    };

    const context = createExtensionContext('test.extension', ['fs.read' as ExtensionPermission]);

    await expect(
      context.isInAllowedReadDir('/downloads/ffmpeg/bin/ffprobe.exe'),
    ).resolves.toBe(false);
  });
});
