// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const { invokeMock } = vi.hoisted(() => ({
  invokeMock: vi.fn(),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

describe('binary-health-check', () => {
  beforeEach(async () => {
    setActivePinia(createPinia());
    invokeMock.mockReset();

    const { useExtensionsStorageStore } = await import('@/stores/storage/extensions');
    const storageStore = useExtensionsStorageStore();

    storageStore.extensionsData.customBinaryPreferences = {
      ffmpeg: {
        mode: 'custom',
        customPath: 'C:/missing/ffmpeg.exe',
      },
    };
    storageStore.extensionsData.installedExtensions = {
      'ext.video': {
        version: '1.0.0',
        enabled: true,
        autoUpdate: true,
        installedAt: 1,
        manifest: {
          id: 'ext.video',
          name: 'Video',
          version: '1.0.0',
          binaries: [{
            id: 'ffmpeg',
            name: 'ffmpeg',
            version: '7.0.0',
            assets: [],
          }],
        } as never,
        settings: { scopedDirectories: [] },
      },
    };
  });

  it('reports invalid custom binaries used by installed extensions', async () => {
    invokeMock.mockResolvedValue(false);

    const { validateCustomBinaryPaths } = await import('@/modules/extensions/utils/binary-health-check');
    const invalidBinaries = await validateCustomBinaryPaths();

    expect(invalidBinaries).toEqual([{
      binaryId: 'ffmpeg',
      customPath: 'C:/missing/ffmpeg.exe',
      affectedExtensionIds: ['ext.video'],
    }]);
  });

  it('ignores managed preferences', async () => {
    const { useExtensionsStorageStore } = await import('@/stores/storage/extensions');
    const storageStore = useExtensionsStorageStore();

    storageStore.extensionsData.customBinaryPreferences = {
      ffmpeg: { mode: 'managed' },
    };

    const { validateCustomBinaryPaths } = await import('@/modules/extensions/utils/binary-health-check');
    const invalidBinaries = await validateCustomBinaryPaths();

    expect(invalidBinaries).toEqual([]);
    expect(invokeMock).not.toHaveBeenCalled();
  });
});
