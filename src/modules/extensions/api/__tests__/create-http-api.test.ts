// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createHttpAPI } from '@/modules/extensions/api/create-http-api';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';
import type { ExtensionPermission } from '@/types/extension';

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: vi.fn(),
}));

import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

function createContext(
  permissions: ExtensionPermission[] = [],
  httpAllowedHosts?: string[],
): ExtensionContext {
  return {
    extensionId: 'sigma.test-extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    httpAllowedHosts,
    t: (key: string, params?: Record<string, string | number>) => `${key}:${JSON.stringify(params ?? {})}`,
    getExtensionPath: vi.fn(),
    getExtensionStoragePath: vi.fn(),
    isPathWithinDirectory: vi.fn(),
    isInExtensionDir: vi.fn(),
    isInExtensionStorageDir: vi.fn(),
    getSharedBinariesDir: vi.fn(),
    isInSharedBinariesDir: vi.fn(),
    isInAllowedReadDir: vi.fn(),
    isInAllowedWriteDir: vi.fn(),
    normalizeRelativePath: (relativePath: string) => relativePath,
    resolvePrivatePath: vi.fn(),
    resolveStoragePath: vi.fn(),
    getExtensionName: () => 'Test Extension',
    getExtensionIconPath: () => undefined,
    getExtensionToastTitle: () => 'Test Extension',
    grantDialogReadAccess: vi.fn(),
    hasDialogReadAccess: vi.fn(),
    grantDialogWriteAccess: vi.fn(),
    consumeDialogWriteAccess: vi.fn(),
    grantSessionAccessFromNavigation: vi.fn(),
    grantSessionAccessFromCurrentNavigation: vi.fn(),
  };
}

describe('createHttpAPI', () => {
  beforeEach(() => {
    vi.mocked(invokeAsExtension).mockReset();
  });

  it('requires http permission', async () => {
    const httpApi = createHttpAPI(createContext([]));

    await expect(httpApi.request({ url: 'https://example.com' })).rejects.toThrow(
      'extensions.api.permissionDenied',
    );
  });

  it('forwards request options to the host command', async () => {
    vi.mocked(invokeAsExtension).mockResolvedValue({
      ok: true,
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: [123, 125],
    });

    const httpApi = createHttpAPI(createContext(['http'], ['http://localhost:*']));
    const response = await httpApi.request({
      url: 'http://localhost:8080/',
      method: 'GET',
      query: {
        search: '*.ts',
        json: '1',
        count: '100',
      },
      headers: {
        Accept: 'application/json',
      },
      timeoutMs: 5000,
    });

    expect(invokeAsExtension).toHaveBeenCalledWith(
      'sigma.test-extension',
      'extension_http_request',
      {
        extensionId: 'sigma.test-extension',
        url: 'http://localhost:8080/?search=*.ts&json=1&count=100',
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        body: undefined,
        timeoutMs: 5000,
      },
    );
    expect(response.ok).toBe(true);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(new Uint8Array([123, 125]));
  });

  it('rejects oversized request bodies before invoking the host command', async () => {
    const httpApi = createHttpAPI(createContext(['http'], ['https://example.com']));
    const oversizedBody = new Uint8Array(10 * 1024 * 1024 + 1);

    await expect(httpApi.request({
      url: 'https://example.com',
      method: 'POST',
      body: oversizedBody,
    })).rejects.toThrow('HTTP request body exceeds maximum size');

    expect(invokeAsExtension).not.toHaveBeenCalled();
  });
});
