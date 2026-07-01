// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  consolidateSharedBinariesRecord,
  findSharedBinaryEntry,
  mergeSharedBinaryInfo,
} from '@/modules/extensions/utils/shared-binary';

describe('shared binary helpers', () => {
  it('merges users without dropping existing metadata', () => {
    const mergedBinary = mergeSharedBinaryInfo(
      {
        id: 'ffmpeg',
        path: '/shared/ffmpeg',
        version: '7.0.0',
        storageVersion: '7.0.0',
        repository: 'https://github.com/example/ffmpeg',
        downloadUrl: 'https://example.com/ffmpeg.zip',
        latestVersion: '7.1.0',
        hasUpdate: true,
        latestCheckedAt: 123,
        installedAt: 111,
        usedBy: ['ext.video'],
      },
      {
        id: 'ffmpeg',
        path: '/shared/ffmpeg',
        installedAt: 222,
        usedBy: ['ext.audio'],
      },
    );

    expect(mergedBinary.version).toBe('7.0.0');
    expect(mergedBinary.repository).toBe('https://github.com/example/ffmpeg');
    expect(mergedBinary.downloadUrl).toBe('https://example.com/ffmpeg.zip');
    expect(mergedBinary.latestVersion).toBe('7.1.0');
    expect(mergedBinary.hasUpdate).toBe(true);
    expect(mergedBinary.latestCheckedAt).toBe(123);
    expect(mergedBinary.installedAt).toBe(222);
    expect(mergedBinary.usedBy).toEqual(['ext.video', 'ext.audio']);
  });

  it('merges duplicate storage keys for the same binary id', () => {
    const consolidated = consolidateSharedBinariesRecord({
      'ffmpeg@8.1': {
        id: 'ffmpeg',
        path: 'C:/shared/ffmpeg-8.1/ffmpeg.exe',
        version: '8.1',
        storageVersion: '8.1',
        installedAt: 100,
        usedBy: ['ext.video'],
      },
      'ffmpeg@latest': {
        id: 'ffmpeg',
        path: 'D:/tools/ffmpeg.exe',
        version: '8.1',
        storageVersion: null,
        source: 'custom',
        installedAt: 200,
        usedBy: ['ext.media'],
      },
    });

    expect(Object.keys(consolidated)).toEqual(['ffmpeg@8.1']);
    expect(consolidated['ffmpeg@8.1']).toMatchObject({
      id: 'ffmpeg',
      version: '8.1',
      source: 'custom',
      usedBy: ['ext.video', 'ext.media'],
    });
  });

  it('finds shared binaries across versioned and latest storage keys', () => {
    const sharedBinaries = {
      'ffmpeg@latest': {
        id: 'ffmpeg',
        path: 'D:/tools/ffmpeg.exe',
        version: '8.1',
        storageVersion: null,
        source: 'custom' as const,
        installedAt: 1,
        usedBy: ['ext.media'],
      },
    };

    expect(findSharedBinaryEntry(sharedBinaries, 'ffmpeg', '8.1')?.binary.usedBy).toEqual(['ext.media']);
    expect(findSharedBinaryEntry(sharedBinaries, 'ffmpeg')?.key).toBe('ffmpeg@latest');
  });
});
