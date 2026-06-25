// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { hashTextSample } from '@/modules/extensions/utils/clipboard-fingerprint';

describe('hashTextSample', () => {
  it('returns stable hash for short text', () => {
    expect(hashTextSample('hello')).toBe(hashTextSample('hello'));
  });

  it('samples large text instead of hashing every byte', () => {
    const shortText = 'a'.repeat(100);
    const longPrefixText = `${'a'.repeat(5000)}unique-tail`;
    const longSuffixText = `unique-head${'b'.repeat(5000)}`;

    expect(hashTextSample(shortText)).not.toBe(hashTextSample(longPrefixText));
    expect(hashTextSample(longPrefixText)).not.toBe(hashTextSample(longSuffixText));
  });
});
