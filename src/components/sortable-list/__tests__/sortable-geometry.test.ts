// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getNeighborReorderIndex,
  getRowMidpointsFromHeights,
} from '../sortable-geometry';

describe('getRowMidpointsFromHeights', () => {
  it('builds midpoints from a list top and row heights', () => {
    expect(getRowMidpointsFromHeights(10, [20, 30, 10])).toEqual([20, 45, 65]);
  });
});

describe('getNeighborReorderIndex', () => {
  const midpoints = [10, 30, 50, 70];

  it('moves down only after the pointer crosses the next midpoint', () => {
    expect(getNeighborReorderIndex(29, 0, midpoints)).toBe(0);
    expect(getNeighborReorderIndex(31, 0, midpoints)).toBe(1);
  });

  it('moves up only after the pointer crosses the previous midpoint', () => {
    expect(getNeighborReorderIndex(51, 2, midpoints)).toBe(2);
    expect(getNeighborReorderIndex(29, 2, midpoints)).toBe(1);
  });

  it('stays in place at the ends', () => {
    expect(getNeighborReorderIndex(0, 0, midpoints)).toBe(0);
    expect(getNeighborReorderIndex(100, 3, midpoints)).toBe(3);
  });
});
