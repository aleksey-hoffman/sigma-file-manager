// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { normalizeVideoThumbnailSize } from '../use-video-thumbnails';

describe('normalizeVideoThumbnailSize', () => {
  it('preserves aspect ratio when clamping large thumbnails', () => {
    expect(normalizeVideoThumbnailSize({
      width: 1020,
      height: 720,
    })).toEqual({
      width: 512,
      height: 361,
    });
  });

  it('keeps dimensions under the maximum without changing smaller thumbnails', () => {
    expect(normalizeVideoThumbnailSize({
      width: 340,
      height: 240,
    })).toEqual({
      width: 340,
      height: 240,
    });
  });
});
