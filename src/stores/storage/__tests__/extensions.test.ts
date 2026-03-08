// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

describe('extensions storage shared binaries', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
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
});
