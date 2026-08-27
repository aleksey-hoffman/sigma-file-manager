// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getTagOverflowVisibleCount } from '../tag-overflow-list';

const GAP = 4;
const MORE_BADGE_WIDTH = 24;

function overflow(tagWidths: number[], availableWidth: number) {
  return getTagOverflowVisibleCount({
    tagWidths,
    moreBadgeWidth: MORE_BADGE_WIDTH,
    availableWidth,
    gap: GAP,
  });
}

describe('getTagOverflowVisibleCount', () => {
  it('returns no badges when there are no tags', () => {
    expect(overflow([], 200)).toEqual({
      visibleCount: 0,
      hiddenCount: 0,
    });
  });

  it('shows every tag when they fit without a more badge', () => {
    expect(overflow([40, 40, 40], 128)).toEqual({
      visibleCount: 3,
      hiddenCount: 0,
    });
  });

  it('shows +X only for tags that do not fit', () => {
    expect(overflow([40, 40, 40], 112)).toEqual({
      visibleCount: 2,
      hiddenCount: 1,
    });
  });

  it('keeps the first tag when only that tag plus +X fit', () => {
    expect(overflow([40, 40, 40], 70)).toEqual({
      visibleCount: 1,
      hiddenCount: 2,
    });
  });

  it('keeps one tag when the first tag is wider than the row', () => {
    expect(overflow([200, 40], 80)).toEqual({
      visibleCount: 1,
      hiddenCount: 1,
    });
  });

  it('does not show +X for a single tag that overflows', () => {
    expect(overflow([200], 80)).toEqual({
      visibleCount: 1,
      hiddenCount: 0,
    });
  });

  it('shows every tag before the row has a measured width', () => {
    expect(overflow([40, 40], 0)).toEqual({
      visibleCount: 2,
      hiddenCount: 0,
    });
  });
});
