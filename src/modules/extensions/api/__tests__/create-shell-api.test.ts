// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionPermission } from '@/types/extension';
import type { ExtensionContext } from '@/modules/extensions/api/extension-context';

const { invokeAsExtensionMock } = vi.hoisted(() => ({
  invokeAsExtensionMock: vi.fn(),
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}));

import { createShellAPI } from '@/modules/extensions/api/create-shell-api';

function createContext(permissions: ExtensionPermission[] = []): ExtensionContext {
  return {
    extensionId: 'test.extension',
    hasPermission: (permission: ExtensionPermission) => permissions.includes(permission),
    t: (key: string, params?: Record<string, string | number>) =>
      params?.permission ? `${key}:${params.permission}` : key,
  } as unknown as ExtensionContext;
}

describe('createShellAPI permission gating', () => {
  beforeEach(() => {
    invokeAsExtensionMock.mockReset();
  });

  it('runs a command when the shell permission is granted', async () => {
    invokeAsExtensionMock.mockResolvedValue({
      code: 0,
      stdout: 'ok',
      stderr: '',
    });
    const shell = createShellAPI(createContext(['shell']));

    const result = await shell.run('yt-dlp', ['--version']);

    expect(result).toEqual({
      code: 0,
      stdout: 'ok',
      stderr: '',
    });
    expect(invokeAsExtensionMock).toHaveBeenCalledTimes(1);
    // Identity is bound to the owning extension by the host, not chosen by the
    // extension: invokeAsExtension injects callerExtensionId server-side.
    expect(invokeAsExtensionMock).toHaveBeenCalledWith(
      'test.extension',
      'run_extension_command',
      {
        extensionId: 'test.extension',
        commandPath: 'yt-dlp',
        args: ['--version'],
      },
    );
  });

  it('denies run() when the shell permission is missing', async () => {
    const shell = createShellAPI(createContext([]));

    await expect(shell.run('yt-dlp', ['--version'])).rejects.toThrow(
      'extensions.api.permissionDenied:shell',
    );
    expect(invokeAsExtensionMock).not.toHaveBeenCalled();
  });

  it('denies runWithProgress() when the shell permission is missing', async () => {
    const shell = createShellAPI(createContext([]));

    await expect(shell.runWithProgress('yt-dlp', [])).rejects.toThrow(
      'extensions.api.permissionDenied:shell',
    );
    expect(invokeAsExtensionMock).not.toHaveBeenCalled();
  });

  it('denies renamePartFilesToTs() when the shell permission is missing', async () => {
    const shell = createShellAPI(createContext([]));

    await expect(shell.renamePartFilesToTs('/tmp')).rejects.toThrow(
      'extensions.api.permissionDenied:shell',
    );
    expect(invokeAsExtensionMock).not.toHaveBeenCalled();
  });
});
