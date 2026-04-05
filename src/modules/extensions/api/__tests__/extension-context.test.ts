// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExtensionPermission } from '@/types/extension';

const { invokeMock, hasScopedAccessMock, invokeAsExtensionMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
  hasScopedAccessMock: vi.fn(),
  invokeAsExtensionMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    hasScopedAccess: hasScopedAccessMock,
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

import { createExtensionContext } from '@/modules/extensions/api/extension-context';

describe('createExtensionContext', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    hasScopedAccessMock.mockReset();
    invokeAsExtensionMock.mockReset();
    invokeAsExtensionMock.mockImplementation(async (_extensionId: string, command: string) => {
      if (command === 'get_extension_path') {
        return '/extensions/test.extension';
      }
      if (command === 'get_extension_storage_path') {
        return '/extensions-storage/test.extension';
      }
      throw new Error(`Unexpected invokeAsExtension command: ${command}`);
    });
    invokeMock.mockImplementation(async (command: string, args?: { path?: string; directory?: string }) => {
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
});
