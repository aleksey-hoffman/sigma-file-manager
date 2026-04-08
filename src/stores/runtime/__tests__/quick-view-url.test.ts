// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  determineFileType,
  getFileExtension,
  getFileName,
  getQuickViewDisplayUrl,
  isHttpOrHttpsUrl,
} from '@/stores/runtime/quick-view';

describe('quick-view http(s) urls', () => {
  it('detects http(s) urls', () => {
    expect(isHttpOrHttpsUrl('https://raw.githubusercontent.com/a/b/c.png')).toBe(true);
    expect(isHttpOrHttpsUrl('http://example.com/x.png')).toBe(true);
    expect(isHttpOrHttpsUrl('C:/files/x.png')).toBe(false);
  });

  it('gets extension from url pathname', () => {
    expect(
      getFileExtension(
        'https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.0.1/preview-1.png',
      ),
    ).toBe('png');
    expect(getFileExtension('https://example.com/v.mp4?x=1')).toBe('mp4');
  });

  it('gets file name from url', () => {
    expect(
      getFileName(
        'https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.0.1/preview-1.png',
      ),
    ).toBe('preview-1.png');
  });

  it('classifies image urls', () => {
    expect(
      determineFileType(
        'https://raw.githubusercontent.com/sigma-hub/sfm-extension-video-downloader/v1.0.1/preview-1.png',
      ),
    ).toBe('image');
  });

  it('passes through display url for http(s)', () => {
    const url = 'https://raw.githubusercontent.com/o/r/main/x.png';
    expect(getQuickViewDisplayUrl(url)).toBe(url);
  });
});
