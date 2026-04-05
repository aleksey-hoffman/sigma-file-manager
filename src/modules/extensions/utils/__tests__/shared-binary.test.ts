// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getSharedBinaryPendingKey,
  mergeSharedBinaryInfo,
} from '@/modules/extensions/utils/shared-binary';

describe('shared binary helpers', () => {
  it('uses the shared binary identity for pending downloads', () => {
    expect(getSharedBinaryPendingKey('ffmpeg', 'ffmpeg.exe', undefined)).toBe('ffmpeg:latest:ffmpeg.exe');
    expect(getSharedBinaryPendingKey('ffmpeg', 'ffmpeg.exe', '7.1.0')).toBe('ffmpeg:7.1.0:ffmpeg.exe');
    expect(getSharedBinaryPendingKey('ffmpeg', 'ffplay.exe', '7.1.0')).toBe('ffmpeg:7.1.0:ffplay.exe');
  });

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
});
