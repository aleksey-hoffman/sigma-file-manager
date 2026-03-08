// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { compareVersions, getExtensionAssetUrl, sortVersionsDescending } from '@/data/extensions';
import { isVersionCompatibleWithRange } from '@/modules/extensions/runtime/validation';

describe('compareVersions', () => {
  it('returns -1 when versionA is less than versionB', () => {
    expect(compareVersions('1.0.0', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0', '2.1.0')).toBe(-1);
    expect(compareVersions('2.0.0-beta.2', '2.0.0')).toBe(-1);
    expect(compareVersions('2.0.0-alpha', '2.0.0-beta')).toBe(-1);
  });

  it('returns 1 when versionA is greater than versionB', () => {
    expect(compareVersions('2.0.0', '1.0.0')).toBe(1);
    expect(compareVersions('2.1.0', '2.0.0')).toBe(1);
    expect(compareVersions('2.0.0', '2.0.0-beta.2')).toBe(1);
    expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.1')).toBe(1);
  });

  it('returns 0 when versions are equal', () => {
    expect(compareVersions('2.0.0', '2.0.0')).toBe(0);
    expect(compareVersions('2.0.0-beta.2', '2.0.0-beta.2')).toBe(0);
  });
});

describe('sortVersionsDescending', () => {
  it('sorts versions with prereleases correctly', () => {
    const versions = ['2.0.0-beta.1', '2.0.0', '2.0.0-beta.2', '1.9.0'];
    expect(sortVersionsDescending(versions)).toEqual(['2.0.0', '2.0.0-beta.2', '2.0.0-beta.1', '1.9.0']);
  });
});

describe('getExtensionAssetUrl', () => {
  it('builds raw GitHub asset urls for release tags', () => {
    expect(getExtensionAssetUrl(
      'https://github.com/sigma-hub/sfm-extension-video-downloader',
      'v1.0.7',
      'icon.png',
    )).toBe('https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.0.7/icon.png');
  });

  it('normalizes leading slashes in asset paths', () => {
    expect(getExtensionAssetUrl(
      'https://github.com/sigma-hub/sfm-extension-video-downloader',
      'main',
      '/assets/icon.png',
    )).toBe('https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/main/assets/icon.png');
  });
});

describe('isVersionCompatibleWithRange', () => {
  it('accepts matching prerelease app version when range requires a release or later', () => {
    expect(isVersionCompatibleWithRange('2.0.0-beta.2', '>=2.0.0')).toBe(true);
    expect(isVersionCompatibleWithRange('2.0.0-beta.2', '>=2.0.0 <3.0.0')).toBe(true);
  });

  it('accepts full release when range is satisfied', () => {
    expect(isVersionCompatibleWithRange('2.0.0', '>=2.0.0')).toBe(true);
    expect(isVersionCompatibleWithRange('2.1.0', '>=2.0.0')).toBe(true);
  });

  it('accepts prerelease when range explicitly requires prerelease', () => {
    expect(isVersionCompatibleWithRange('2.0.0-beta.2', '>=2.0.0-beta.1')).toBe(true);
  });

  it('rejects prerelease app version when the required release is newer', () => {
    expect(isVersionCompatibleWithRange('2.0.0-beta.2', '>=2.0.1')).toBe(false);
  });
});
