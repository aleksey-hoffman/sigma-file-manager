// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { findNearestRectIndex } from '../nearest-rect';

function createRect(left: number, top: number, height = 40) {
  return {
    left,
    top,
    width: 100,
    height,
  };
}

describe('findNearestRectIndex', () => {
  const list = [createRect(500, 100), createRect(500, 140), createRect(500, 220)];

  it('picks the item on the closest row', () => {
    expect(findNearestRectIndex(list, createRect(0, 150))).toBe(1);
    expect(findNearestRectIndex(list, createRect(0, 210))).toBe(2);
  });

  it('picks the last item when the source is below the list', () => {
    expect(findNearestRectIndex(list, createRect(0, 900))).toBe(2);
  });

  it('enters a grid from the side the source is on', () => {
    const grid = [
      createRect(500, 100),
      createRect(620, 100),
      createRect(740, 100),
      createRect(500, 240),
      createRect(620, 240),
    ];

    expect(findNearestRectIndex(grid, createRect(0, 100))).toBe(0);
    expect(findNearestRectIndex(grid, createRect(1200, 100))).toBe(2);
    expect(findNearestRectIndex(grid, createRect(1200, 230))).toBe(4);
  });

  it('returns -1 when there are no items', () => {
    expect(findNearestRectIndex([], createRect(0, 0))).toBe(-1);
  });
});
