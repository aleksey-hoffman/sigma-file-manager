// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import type { ExtensionManifest } from '@/types/extension';

const {
  ensurePlatformInfoMock,
  getExtensionInstallCancellationIdForExtensionMock,
  getExtensionSettingsMock,
  getExtensionToastIconPathMock,
  getExtensionToastTitleMock,
  getSharedBinaryMock,
  incrementBinaryDownloadCountMock,
  incrementBinaryReuseCountMock,
  invokeMock,
  listenMock,
  setSharedBinaryMock,
  toastCustomMock,
  toastDismissMock,
  updateExtensionSettingsMock,
} = vi.hoisted(() => ({
  ensurePlatformInfoMock: vi.fn(async () => ({
    os: 'windows',
    arch: 'x64',
    isWindows: true,
  })),
  getExtensionInstallCancellationIdForExtensionMock: vi.fn(() => null),
  getExtensionSettingsMock: vi.fn(async () => ({ customSettings: {} })),
  getExtensionToastIconPathMock: vi.fn(() => '/icon.png'),
  getExtensionToastTitleMock: vi.fn(() => 'Test Extension'),
  getSharedBinaryMock: vi.fn(() => null),
  incrementBinaryDownloadCountMock: vi.fn(),
  incrementBinaryReuseCountMock: vi.fn(),
  invokeMock: vi.fn(),
  listenMock: vi.fn(),
  setSharedBinaryMock: vi.fn(async () => undefined),
  toastCustomMock: vi.fn(),
  toastDismissMock: vi.fn(),
  updateExtensionSettingsMock: vi.fn(async () => undefined),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

vi.mock('@/modules/extensions/api/platform', () => ({
  ensurePlatformInfo: ensurePlatformInfoMock,
}));

vi.mock('@/modules/extensions/api/binary-download-counts', () => ({
  incrementBinaryDownloadCount: incrementBinaryDownloadCountMock,
  incrementBinaryReuseCount: incrementBinaryReuseCountMock,
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    custom: toastCustomMock,
    dismiss: toastDismissMock,
  },
  ToastProgress: {},
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

vi.mock('@/stores/storage/extensions', () => ({
  useExtensionsStorageStore: () => ({
    getExtensionSettings: getExtensionSettingsMock,
    updateExtensionSettings: updateExtensionSettingsMock,
    getSharedBinary: getSharedBinaryMock,
    setSharedBinary: setSharedBinaryMock,
  }),
}));

vi.mock('@/modules/extensions/utils/extension-install-cancellation', () => ({
  getExtensionInstallCancellationIdForExtension: getExtensionInstallCancellationIdForExtensionMock,
}));

vi.mock('@/modules/extensions/utils/toast-utils', () => ({
  getExtensionToastIconPath: getExtensionToastIconPathMock,
  getExtensionToastTitle: getExtensionToastTitleMock,
}));

function createManifest(): ExtensionManifest {
  return {
    id: 'test.extension',
    name: 'Test Extension',
    version: '1.0.0',
    binaries: [
      {
        id: 'ffmpeg',
        name: 'ffmpeg',
        version: '7.1.0',
        assets: [
          {
            platform: 'windows',
            arch: ['x64'],
            downloadUrl: 'https://example.com/ffmpeg.zip',
            integrity: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
          },
        ],
      },
    ],
  } as ExtensionManifest;
}

describe('syncManifestBinariesForExtension', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
    getExtensionSettingsMock.mockReset().mockResolvedValue({ customSettings: {} });
    updateExtensionSettingsMock.mockReset().mockResolvedValue(undefined);
    getSharedBinaryMock.mockReset().mockReturnValue(null);
    setSharedBinaryMock.mockReset().mockResolvedValue(undefined);
    ensurePlatformInfoMock.mockReset().mockResolvedValue({
      os: 'windows',
      arch: 'x64',
      isWindows: true,
    });
    incrementBinaryDownloadCountMock.mockReset();
    incrementBinaryReuseCountMock.mockReset();
    getExtensionInstallCancellationIdForExtensionMock.mockReset().mockReturnValue(null);
    getExtensionToastTitleMock.mockReset().mockReturnValue('Test Extension');
    getExtensionToastIconPathMock.mockReset().mockReturnValue('/icon.png');
  });

  it('switches the dependency toast to installing after the archive finishes downloading', async () => {
    const eventHandlers = new Map<string, (event: { payload?: Record<string, unknown> }) => void>();

    listenMock.mockImplementation(async (eventName: string, handler: (event: { payload?: Record<string, unknown> }) => void) => {
      eventHandlers.set(eventName, handler);
      return vi.fn();
    });

    invokeMock.mockImplementation(async (command: string, payload?: { options?: { progressEventId?: string } }) => {
      if (command === 'get_shared_binary_path') {
        return null;
      }

      if (command === 'download_and_extract_shared_binary') {
        const progressEventId = payload?.options?.progressEventId;

        eventHandlers.get('binary-download-progress')?.({
          payload: {
            progressEventId,
            downloaded: 1024,
            total: 1024,
          },
        });
        eventHandlers.get('binary-download-stage')?.({
          payload: {
            progressEventId,
            stage: 'installing',
          },
        });

        return 'C:/shared/ffmpeg/7.1.0/ffmpeg.exe';
      }

      throw new Error(`Unexpected invoke command: ${command}`);
    });

    const { syncManifestBinariesForExtension } = await import('@/modules/extensions/runtime/manifest-binaries');

    await syncManifestBinariesForExtension('test.extension', createManifest());

    const toastStates = toastCustomMock.mock.calls.map(([, options]) => options.componentProps.data);

    expect(toastStates[0].subtitle).toBe('extensions.api.downloadingDependencies');
    expect(toastStates.at(-1)?.subtitle).toBe('extensions.installing');
    expect(toastStates.at(-1)?.downloadSize).toBeUndefined();
    expect(toastStates.at(-1)?.progress).toBe(99);
    expect(toastDismissMock).toHaveBeenCalledWith('binary-download-test.extension-ffmpeg');
  });
});
