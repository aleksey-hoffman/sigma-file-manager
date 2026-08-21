// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  applyRangeSelection,
  getEntriesInInclusiveRange,
} from '../file-browser-range-selection';

function createEntry(path: string): DirEntry {
  return {
    name: path.split('/').pop() ?? path,
    path,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    ext: null,
    mime: null,
  };
}

describe('getEntriesInInclusiveRange', () => {
  const entries = [
    createEntry('/tmp/a'),
    createEntry('/tmp/b'),
    createEntry('/tmp/c'),
    createEntry('/tmp/d'),
    createEntry('/tmp/e'),
  ];

  it('returns the inclusive slice from the earlier entry to the later entry', () => {
    expect(getEntriesInInclusiveRange(entries, entries[1], entries[3]).map(entry => entry.path)).toEqual([
      '/tmp/b',
      '/tmp/c',
      '/tmp/d',
    ]);
  });

  it('returns the same slice when the range is selected backwards', () => {
    expect(getEntriesInInclusiveRange(entries, entries[3], entries[1]).map(entry => entry.path)).toEqual([
      '/tmp/b',
      '/tmp/c',
      '/tmp/d',
    ]);
  });

  it('returns a single entry when both ends are the same item', () => {
    expect(getEntriesInInclusiveRange(entries, entries[2], entries[2]).map(entry => entry.path)).toEqual([
      '/tmp/c',
    ]);
  });

  it('returns an empty list when either end is missing from the visual order', () => {
    expect(getEntriesInInclusiveRange(entries, entries[0], createEntry('/tmp/missing'))).toEqual([]);
    expect(getEntriesInInclusiveRange(entries, createEntry('/tmp/missing'), entries[0])).toEqual([]);
  });
});

describe('applyRangeSelection', () => {
  const firstRange = [
    createEntry('/tmp/a'),
    createEntry('/tmp/b'),
    createEntry('/tmp/c'),
  ];
  const secondRange = [
    createEntry('/tmp/e'),
    createEntry('/tmp/f'),
  ];

  it('replaces the current selection when the range is not additive', () => {
    expect(applyRangeSelection(firstRange, secondRange, false).map(entry => entry.path)).toEqual([
      '/tmp/e',
      '/tmp/f',
    ]);
  });

  it('keeps the original selection and appends a second range when additive', () => {
    expect(applyRangeSelection(firstRange, secondRange, true).map(entry => entry.path)).toEqual([
      '/tmp/a',
      '/tmp/b',
      '/tmp/c',
      '/tmp/e',
      '/tmp/f',
    ]);
  });

  it('does not duplicate entries that already belong to the original selection', () => {
    const overlappingRange = [
      createEntry('/tmp/c'),
      createEntry('/tmp/d'),
    ];

    expect(applyRangeSelection(firstRange, overlappingRange, true).map(entry => entry.path)).toEqual([
      '/tmp/a',
      '/tmp/b',
      '/tmp/c',
      '/tmp/d',
    ]);
  });
});
