// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  normalizeManifestMediaItems,
  getGitHubRefForRemoteMedia,
  manifestHasMediaItems,
  resolveManifestMediaItems,
} from '@/modules/extensions/utils/resolve-manifest-media';

describe('resolve-manifest-media', () => {
  it('normalizes valid media entries', () => {
    const result = normalizeManifestMediaItems({
      id: 'x.y',
      name: 'T',
      version: '1.0.0',
      repository: 'https://github.com/o/r',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: [],
      engines: { sigmaFileManager: '1.0.0' },
      media: [
        {
          title: ' A ',
          src: ' ./a.png ',
          type: 'image',
        },
        {
          title: 'Clip',
          src: 'b.mp4',
          type: 'video',
        },
      ],
    });
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      title: 'A',
      src: './a.png',
      type: 'image',
    });
    expect(result[1]).toEqual({
      title: 'Clip',
      src: 'b.mp4',
      type: 'video',
    });
  });

  it('drops invalid entries', () => {
    const result = normalizeManifestMediaItems({
      id: 'x.y',
      name: 'T',
      version: '1.0.0',
      repository: 'https://github.com/o/r',
      license: 'MIT',
      extensionType: 'api',
      main: 'index.js',
      permissions: [],
      engines: { sigmaFileManager: '1.0.0' },
      media: [
        {
          title: '',
          src: 'a.png',
          type: 'image',
        },
        {
          title: 'x',
          src: '',
          type: 'image',
        },
        {
          title: 'y',
          src: 'z.png',
          type: 'audio' as 'image',
        },
      ],
    });
    expect(result).toHaveLength(0);
  });

  it('computes remote ref for marketplace', () => {
    expect(
      getGitHubRefForRemoteMedia({
        isInstalled: false,
        selectedVersion: '2.1.0',
        latestVersion: '3.0.0',
      }),
    ).toBe('v2.1.0');
    expect(
      getGitHubRefForRemoteMedia({
        isInstalled: false,
        selectedVersion: '',
        latestVersion: '1.0.0',
      }),
    ).toBe('v1.0.0');
    expect(
      getGitHubRefForRemoteMedia({
        isInstalled: false,
        selectedVersion: '',
        latestVersion: null,
      }),
    ).toBe('main');
  });

  it('uses installed version tag for remote asset ref when extension is installed', () => {
    expect(
      getGitHubRefForRemoteMedia({
        isInstalled: true,
        selectedVersion: '9.9.9',
        installedVersion: '1.0.1',
        latestVersion: '2.0.0',
      }),
    ).toBe('v1.0.1');
  });

  it('manifestHasMediaItems reflects media array', () => {
    expect(manifestHasMediaItems(undefined)).toBe(false);
    expect(
      manifestHasMediaItems({
        id: 'x.y',
        name: 'T',
        version: '1.0.0',
        repository: 'https://github.com/o/r',
        license: 'MIT',
        extensionType: 'api',
        main: 'index.js',
        permissions: [],
        engines: { sigmaFileManager: '1.0.0' },
        media: [{ title: 'A', src: 'a.png', type: 'image' }],
      }),
    ).toBe(true);
  });

  it('sets quick view paths for remote raw URLs', async () => {
    const result = await resolveManifestMediaItems({
      manifest: {
        id: 'sigma.video-downloader',
        name: 'V',
        version: '1.0.1',
        repository: 'https://github.com/sigma-hub/sfm-extension-video-downloader',
        license: 'MIT',
        extensionType: 'api',
        main: 'dist/index.js',
        permissions: [],
        engines: { sigmaFileManager: '2.0.0' },
        media: [{ title: 'Preview', src: 'preview-1.png', type: 'image' }],
      },
      extensionId: 'sigma.video-downloader',
      isInstalled: false,
      repository: 'https://github.com/sigma-hub/sfm-extension-video-downloader',
      remoteRef: 'v1.0.1',
    });
    expect(result).toHaveLength(1);
    expect(result[0].quickViewPath).toBe(
      'https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.0.1/preview-1.png',
    );
    expect(result[0].remoteOpenUrl).toBeUndefined();
  });
});
