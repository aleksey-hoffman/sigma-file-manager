// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  parseQuickSearchQuery,
  toggleQuickSearchPropertyInQuery,
} from '../file-browser-quick-search-query';

describe('parseQuickSearchQuery', () => {
  it('parses known property prefixes case-insensitively', () => {
    expect(parseQuickSearchQuery('size: 24 mb')).toEqual({ property: 'size', value: '24 mb' });
    expect(parseQuickSearchQuery('SIZE:foo')).toEqual({ property: 'size', value: 'foo' });
    expect(parseQuickSearchQuery('Modified: 2024')).toEqual({ property: 'modified', value: '2024' });
  });

  it('returns null property when no prefix matches', () => {
    expect(parseQuickSearchQuery('hello world')).toEqual({ property: null, value: 'hello world' });
    expect(parseQuickSearchQuery('unknown: x')).toEqual({ property: null, value: 'unknown: x' });
  });

  it('captures value after first colon for property match', () => {
    expect(parseQuickSearchQuery('path: C:\\a:b')).toEqual({ property: 'path', value: 'C:\\a:b' });
  });
});

describe('toggleQuickSearchPropertyInQuery', () => {
  it('adds prefix while preserving value when switching', () => {
    expect(toggleQuickSearchPropertyInQuery('hello', 'size')).toBe('size: hello');
    expect(toggleQuickSearchPropertyInQuery('size: hello', 'modified')).toBe('modified: hello');
  });

  it('removes prefix when toggling the active property off', () => {
    expect(toggleQuickSearchPropertyInQuery('size: hello', 'size')).toBe('hello');
  });

  it('uses bare prefix when value is empty', () => {
    expect(toggleQuickSearchPropertyInQuery('', 'mime')).toBe('mime:');
  });
});
