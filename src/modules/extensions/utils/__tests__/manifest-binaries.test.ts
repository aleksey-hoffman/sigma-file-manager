// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { ManifestBinaryDefinition } from '@/types/extension';
import { resolveManifestBinaryAsset } from '@/modules/extensions/utils/manifest-binaries';

function createBinaryDefinition(): ManifestBinaryDefinition {
  return {
    id: 'ffmpeg',
    name: 'ffmpeg',
    version: '7.1.0',
    assets: [
      {
        platform: 'macos',
        arch: ['arm64'],
        downloadUrl: 'https://example.com/ffmpeg-macos-arm64.zip',
        integrity: 'sha256:1111111111111111111111111111111111111111111111111111111111111111',
      },
      {
        platform: 'windows',
        arch: ['arm64'],
        downloadUrl: 'https://example.com/ffmpeg-windows-arm64.zip',
        integrity: 'sha256:2222222222222222222222222222222222222222222222222222222222222222',
      },
      {
        platform: 'windows',
        arch: ['x64'],
        downloadUrl: 'https://example.com/ffmpeg-windows-x64.zip',
        integrity: 'sha256:3333333333333333333333333333333333333333333333333333333333333333',
      },
    ],
  };
}

describe('resolveManifestBinaryAsset', () => {
  it('matches the current platform instead of the first asset', () => {
    const binaryDefinition = createBinaryDefinition();

    expect(resolveManifestBinaryAsset(binaryDefinition, 'windows', 'x64')?.downloadUrl)
      .toBe('https://example.com/ffmpeg-windows-x64.zip');
  });

  it('returns null when no asset matches the current platform', () => {
    const binaryDefinition = {
      ...createBinaryDefinition(),
      platforms: ['linux'],
    } satisfies ManifestBinaryDefinition;

    expect(resolveManifestBinaryAsset(binaryDefinition, 'windows', 'x64')).toBeNull();
  });
});
