// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { assertValidManifestData } from '@/modules/extensions/runtime/validation';

function createManifest() {
  return {
    id: 'sigma.test-extension',
    name: 'Test Extension',
    version: '1.0.0',
    repository: 'https://github.com/sigma-hub/test-extension',
    license: 'MIT',
    extensionType: 'api',
    main: 'index.js',
    permissions: ['commands'],
    platforms: ['windows', 'macos', 'linux'],
    engines: {
      sigmaFileManager: '>=2.0.0',
    },
  };
}

describe('manifest binary validation', () => {
  it('accepts valid binary definitions', () => {
    const manifest = {
      ...createManifest(),
      binaries: [
        {
          id: 'ffmpeg',
          name: 'ffmpeg',
          version: '8.1',
          executable: 'bin/ffmpeg.exe',
          repository: 'https://github.com/BtbN/FFmpeg-Builds',
          platforms: ['windows'],
          assets: [
            {
              platform: 'windows',
              arch: ['x64'],
              downloadUrl: 'https://example.com/ffmpeg.zip',
              integrity: 'sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
              archive: true,
              executable: 'bin/ffmpeg.exe',
            },
          ],
        },
      ],
    };

    expect(() => assertValidManifestData(manifest)).not.toThrow();
  });

  it('accepts upstream binary versions that are not semver', () => {
    const manifest = {
      ...createManifest(),
      binaries: [
        {
          id: 'yt-dlp',
          name: 'yt-dlp',
          version: '2026.03.17',
          assets: [
            {
              platform: 'linux',
              downloadUrl: 'https://example.com/yt-dlp',
              integrity: 'sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd',
            },
          ],
        },
      ],
    };

    expect(() => assertValidManifestData(manifest)).not.toThrow();
  });

  it('rejects binaries without integrity', () => {
    const manifest = {
      ...createManifest(),
      binaries: [
        {
          id: 'ffmpeg',
          name: 'ffmpeg',
          version: '8.1',
          assets: [
            {
              platform: 'windows',
              downloadUrl: 'https://example.com/ffmpeg.zip',
            },
          ],
        },
      ],
    };

    expect(() => assertValidManifestData(manifest)).toThrow('Invalid manifest: binaries are invalid');
  });

  it('rejects duplicate platform and arch targets', () => {
    const manifest = {
      ...createManifest(),
      binaries: [
        {
          id: 'deno',
          name: 'deno',
          version: '2.1.0',
          assets: [
            {
              platform: 'windows',
              arch: ['x64'],
              downloadUrl: 'https://example.com/deno-x64.zip',
              integrity: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
            },
            {
              platform: 'windows',
              arch: ['x64'],
              downloadUrl: 'https://example.com/deno-x64-other.zip',
              integrity: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
            },
          ],
        },
      ],
    };

    expect(() => assertValidManifestData(manifest)).toThrow('Invalid manifest: binaries are invalid');
  });

  it('rejects unsafe executable paths', () => {
    const manifest = {
      ...createManifest(),
      binaries: [
        {
          id: 'yt-dlp',
          name: 'yt-dlp',
          version: '2025.01.01',
          executable: '../yt-dlp',
          assets: [
            {
              platform: 'linux',
              downloadUrl: 'https://example.com/yt-dlp',
              integrity: 'sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
            },
          ],
        },
      ],
    };

    expect(() => assertValidManifestData(manifest)).toThrow('Invalid manifest: binaries are invalid');
  });
});

describe('manifest theme validation', () => {
  it('accepts valid theme contributions', () => {
    const manifest = {
      ...createManifest(),
      contributes: {
        themes: [
          {
            id: 'midnight',
            title: 'Midnight',
            baseTheme: 'dark',
            variables: {
              '--background': '230 20% 10%',
              '--primary': '200 80% 60%',
            },
          },
        ],
      },
    };

    expect(() => assertValidManifestData(manifest)).not.toThrow();
  });

  it('rejects theme contributions without css variables', () => {
    const manifest = {
      ...createManifest(),
      contributes: {
        themes: [
          {
            id: 'broken-theme',
            title: 'Broken Theme',
            baseTheme: 'dark',
            variables: {},
          },
        ],
      },
    };

    expect(() => assertValidManifestData(manifest)).toThrow('Invalid manifest: contributes are invalid');
  });

  it('rejects duplicate theme ids within one extension', () => {
    const manifest = {
      ...createManifest(),
      contributes: {
        themes: [
          {
            id: 'midnight',
            title: 'Midnight',
            baseTheme: 'dark',
            variables: {
              '--background': '230 20% 10%',
            },
          },
          {
            id: 'midnight',
            title: 'Midnight 2',
            baseTheme: 'dark',
            variables: {
              '--background': '230 20% 12%',
            },
          },
        ],
      },
    };

    expect(() => assertValidManifestData(manifest)).toThrow('Invalid manifest: contributes are invalid');
  });
});
