// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  computeHorizontalFixedVirtualRange,
  computeHorizontalVirtualTotalWidth,
} from '@/composables/use-horizontal-fixed-virtual-list';

describe('computeHorizontalVirtualTotalWidth', () => {
  it('returns 0 for empty count', () => {
    expect(computeHorizontalVirtualTotalWidth(0, 64, 8)).toBe(0);
  });

  it('returns item width for a single item', () => {
    expect(computeHorizontalVirtualTotalWidth(1, 64, 8)).toBe(64);
  });

  it('includes gaps between items', () => {
    expect(computeHorizontalVirtualTotalWidth(3, 64, 8)).toBe(64 + 72 + 72);
  });
});

describe('computeHorizontalFixedVirtualRange', () => {
  const base = {
    itemWidthPx: 64,
    itemGapPx: 8,
    overscanItems: 0,
  };

  it('covers items visible at scroll origin', () => {
    const range = computeHorizontalFixedVirtualRange({
      ...base,
      scrollLeft: 0,
      viewportWidth: 200,
      itemCount: 100,
    });

    expect(range.start).toBe(0);
    expect(range.end).toBeGreaterThan(range.start);
    expect(range.end).toBeLessThanOrEqual(100);
  });

  it('shifts window when scrolled into the list', () => {
    const range = computeHorizontalFixedVirtualRange({
      ...base,
      scrollLeft: 72 * 40,
      viewportWidth: 300,
      itemCount: 200,
      overscanItems: 0,
    });

    expect(range.start).toBeGreaterThan(30);
    expect(range.end).toBeLessThan(200);
  });

  it('respects overscan', () => {
    const withScan = computeHorizontalFixedVirtualRange({
      ...base,
      scrollLeft: 0,
      viewportWidth: 72,
      itemCount: 50,
      overscanItems: 4,
    });
    const noScan = computeHorizontalFixedVirtualRange({
      ...base,
      scrollLeft: 0,
      viewportWidth: 72,
      itemCount: 50,
      overscanItems: 0,
    });

    expect(withScan.start).toBeLessThanOrEqual(noScan.start);
    expect(withScan.end).toBeGreaterThanOrEqual(noScan.end);
  });

  it('clamps stale scroll positions after item count shrinks', () => {
    const range = computeHorizontalFixedVirtualRange({
      ...base,
      scrollLeft: 72 * 40,
      viewportWidth: 300,
      itemCount: 3,
      overscanItems: 0,
    });

    expect(range).toEqual({
      start: 0,
      end: 3,
    });
  });
});
