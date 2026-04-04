// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

const {
  lazyStoreGetMock,
  lazyStoreSaveMock,
} = vi.hoisted(() => ({
  lazyStoreGetMock: vi.fn(),
  lazyStoreSaveMock: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {
      await lazyStoreSaveMock();
    }

    async get<T>(key: string): Promise<T | undefined> {
      return lazyStoreGetMock(key);
    }
  },
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataDir: '/tmp/user-data',
    },
  }),
}));

describe('extensions storage shared binaries', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    lazyStoreGetMock.mockReset();
    lazyStoreSaveMock.mockReset();
  });

  it('merges shared binary users when the same entry is set twice', async () => {
    const storageStore = useExtensionsStorageStore();

    await storageStore.setSharedBinary('ffmpeg', '7.0.0', {
      id: 'ffmpeg',
      path: '/shared/ffmpeg',
      version: '7.0.0',
      storageVersion: '7.0.0',
      repository: 'https://github.com/example/ffmpeg',
      latestVersion: '7.1.0',
      hasUpdate: true,
      latestCheckedAt: 123,
      installedAt: 111,
      usedBy: ['ext.video'],
    });

    await storageStore.setSharedBinary('ffmpeg', '7.0.0', {
      id: 'ffmpeg',
      path: '/shared/ffmpeg',
      installedAt: 222,
      usedBy: ['ext.audio'],
    });

    expect(storageStore.getSharedBinary('ffmpeg', '7.0.0')).toEqual({
      id: 'ffmpeg',
      path: '/shared/ffmpeg',
      version: '7.0.0',
      storageVersion: '7.0.0',
      repository: 'https://github.com/example/ffmpeg',
      latestVersion: '7.1.0',
      hasUpdate: true,
      latestCheckedAt: 123,
      installedAt: 222,
      usedBy: ['ext.video', 'ext.audio'],
    });
  });

  it('hydrates from startup bootstrap without reading from LazyStore', async () => {
    const storageStore = useExtensionsStorageStore();

    await storageStore.init({
      path: '/tmp/user-data/extensions.json',
      status: 'ready',
      data: {
        installedExtensions: {
          'ext.video': {
            version: '1.0.0',
            enabled: true,
            autoUpdate: true,
            installedAt: 123,
            manifest: {
              id: 'ext.video',
              name: 'Video',
              version: '1.0.0',
              description: 'Video tools',
              author: 'Sigma',
              permissions: [],
              engines: {
                sigmaFileManager: '>=2.0.0',
              },
              activationEvents: [],
            },
            settings: {
              scopedDirectories: [],
              customSettings: {},
            },
          },
        },
        recentCommandIds: ['ext.video.run'],
      },
      schemaVersion: null,
      error: null,
    });

    expect(lazyStoreGetMock).not.toHaveBeenCalled();
    expect(storageStore.extensionsData.installedExtensions['ext.video']?.version).toBe('1.0.0');
    expect(storageStore.getRecentCommandIds()).toEqual(['ext.video.run']);
  });
});
