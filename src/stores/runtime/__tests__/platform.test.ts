// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { canUseDefaultFileManager } from '@/stores/runtime/platform';

describe('platform capabilities', () => {
  it('allows the default file manager integration for direct Windows installations', () => {
    expect(canUseDefaultFileManager('windows', true)).toBe(true);
  });

  it('disables the default file manager integration when the backend reports it unavailable', () => {
    expect(canUseDefaultFileManager('windows', false)).toBe(false);
  });

  it('disables the default file manager integration on other platforms', () => {
    expect(canUseDefaultFileManager('linux', true)).toBe(false);
    expect(canUseDefaultFileManager('macos', true)).toBe(false);
  });
});
