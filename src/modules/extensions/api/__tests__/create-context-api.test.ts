// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { openUrlMock } = vi.hoisted(() => ({
  openUrlMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: openUrlMock,
}));

vi.mock('@/modules/extensions/context', () => ({
  getCurrentPath: vi.fn(() => null),
  getSelectedEntries: vi.fn(() => []),
  getAppVersion: vi.fn(async () => '2.0.0'),
  getDownloadsDir: vi.fn(async () => '/downloads'),
  getPicturesDir: vi.fn(async () => '/pictures'),
  onPathChange: vi.fn(),
  onSelectionChange: vi.fn(),
}));

import { createContextAPI } from '@/modules/extensions/api/create-context-api';

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
    grantDialogWriteAccess: vi.fn(),
    consumeDialogWriteAccess: vi.fn(),
  };
}

describe('createContextAPI', () => {
  it('blocks openUrl without permission', async () => {
    const contextApi = createContextAPI(createContext());

    expect(() => contextApi.openUrl('https://example.com')).toThrow(
      'extensions.api.permissionDenied:openUrl',
    );
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it('blocks unsupported URL schemes', async () => {
    const contextApi = createContextAPI(createContext(['openUrl' as ExtensionPermission]));

    expect(() => contextApi.openUrl('file:///tmp/test.txt')).toThrow(
      'Only http, https, and mailto URLs are allowed',
    );
    expect(openUrlMock).not.toHaveBeenCalled();
  });

  it('opens allowed URLs', async () => {
    openUrlMock.mockResolvedValueOnce(undefined);
    const contextApi = createContextAPI(createContext(['openUrl' as ExtensionPermission]));

    await expect(contextApi.openUrl('https://example.com/path')).resolves.toBeUndefined();
    expect(openUrlMock).toHaveBeenCalledWith('https://example.com/path');
  });
});
