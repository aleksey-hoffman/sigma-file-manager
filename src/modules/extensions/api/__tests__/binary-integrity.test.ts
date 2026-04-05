// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildIntegrityCandidateUrls,
  getAssetNameFromDownloadUrl,
  parseIntegrityFromChecksumText,
  shouldAllowMissingIntegrity,
  warnUnverifiedBinaryDownload,
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
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp.exe.sha256',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA2-256SUMS',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/SHA256SUMS',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/checksums.sha256',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/sha256sums.txt',
      'https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/checksums.txt',
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

  it('allows missing integrity for local extensions only', () => {
    expect(shouldAllowMissingIntegrity(true, undefined)).toBe(true);
    expect(shouldAllowMissingIntegrity(true, '')).toBe(true);
    expect(shouldAllowMissingIntegrity(true, '   ')).toBe(true);
    expect(shouldAllowMissingIntegrity(true, 'sha256:abc')).toBe(false);
    expect(shouldAllowMissingIntegrity(false, undefined)).toBe(false);
  });
});

describe('warnUnverifiedBinaryDownload', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs a console warning with extension and binary identifiers', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    warnUnverifiedBinaryDownload({
      extensionId: 'publisher.tool',
      binaryId: 'ffmpeg',
      downloadUrl: 'https://example.com/ffmpeg.zip',
    });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const message = warnSpy.mock.calls[0][0] as string;
    expect(message).toContain('[Sigma][extensions]');
    expect(message).toContain('publisher.tool');
    expect(message).toContain('ffmpeg');
    expect(message).toContain('https://example.com/ffmpeg.zip');
  });
});
