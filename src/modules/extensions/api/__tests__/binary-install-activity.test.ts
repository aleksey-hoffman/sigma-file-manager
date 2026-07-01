// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { afterEach, describe, expect, it } from 'vitest';
import {
  beginBinaryInstallActivity,
  endBinaryInstallActivity,
  hasAnyBinaryInstallInProgress,
  isBinaryInstallInProgress,
} from '@/modules/extensions/api/binary-install-activity';

describe('binary install activity', () => {
  afterEach(() => {
    endBinaryInstallActivity('ffmpeg');
    endBinaryInstallActivity('deno');
  });

  it('tracks active binary installs by id', () => {
    expect(isBinaryInstallInProgress('ffmpeg')).toBe(false);

    beginBinaryInstallActivity('ffmpeg');

    expect(isBinaryInstallInProgress('ffmpeg')).toBe(true);
    expect(hasAnyBinaryInstallInProgress()).toBe(true);

    endBinaryInstallActivity('ffmpeg');

    expect(isBinaryInstallInProgress('ffmpeg')).toBe(false);
    expect(hasAnyBinaryInstallInProgress()).toBe(false);
  });

  it('supports nested installs for the same binary id', () => {
    beginBinaryInstallActivity('ffmpeg');
    beginBinaryInstallActivity('ffmpeg');

    expect(isBinaryInstallInProgress('ffmpeg')).toBe(true);

    endBinaryInstallActivity('ffmpeg');

    expect(isBinaryInstallInProgress('ffmpeg')).toBe(true);

    endBinaryInstallActivity('ffmpeg');

    expect(isBinaryInstallInProgress('ffmpeg')).toBe(false);
  });
});
