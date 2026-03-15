// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';

import {
  buildIntegrityCandidateUrls,
  getAssetNameFromDownloadUrl,
  parseIntegrityFromChecksumText,
} from '@/modules/extensions/api/binary-integrity';

describe('binary-integrity', () => {
  it('extracts asset names from download urls', () => {
    expect(getAssetNameFromDownloadUrl(
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe',
    )).toBe('yt-dlp.exe');
  });

  it('builds common checksum candidate urls', () => {
    expect(buildIntegrityCandidateUrls(
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe',
    )).toEqual([
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe.sha256sum',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA2-256SUMS',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/checksums.sha256',
    ]);
  });

  it('parses a single-hash checksum file', () => {
    expect(parseIntegrityFromChecksumText(
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      'deno-x86_64-pc-windows-msvc.zip',
    )).toBe('sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');
  });

  it('parses posix checksum manifests', () => {
    expect(parseIntegrityFromChecksumText(
      [
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa  yt-dlp',
        'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb  yt-dlp.exe',
      ].join('\n'),
      'yt-dlp.exe',
    )).toBe('sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
  });

  it('parses openssl checksum output', () => {
    expect(parseIntegrityFromChecksumText(
      'SHA256 (ffmpeg-master-latest-win64-gpl.zip) = cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc',
      'ffmpeg-master-latest-win64-gpl.zip',
    )).toBe('sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc');
  });

  it('parses powershell checksum output', () => {
    expect(parseIntegrityFromChecksumText(
      [
        'Algorithm : SHA256',
        'Hash      : 0BF523E2909DA9BFC56100461CD70A1287AE247E6C63B390C52605941D370DD1',
        'Path      : C:\\a\\deno\\deno\\target\\release\\deno-x86_64-pc-windows-msvc.zip',
      ].join('\n'),
      'deno-x86_64-pc-windows-msvc.zip',
    )).toBe('sha256:0bf523e2909da9bfc56100461cd70a1287ae247e6c63b390c52605941d370dd1');
  });
});
