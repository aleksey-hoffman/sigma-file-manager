// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getRowMidpointsFromHeights(listTop: number, heights: number[]): number[] {
  let top = listTop;

  return heights.map((height) => {
    const midpoint = top + (height / 2);
    top += height;
    return midpoint;
  });
}

export function getNeighborReorderIndex(
  pointerY: number,
  currentIndex: number,
  rowMidpoints: number[],
): number {
  const nextIndex = currentIndex + 1;
  const previousIndex = currentIndex - 1;

  if (nextIndex < rowMidpoints.length && pointerY > rowMidpoints[nextIndex]) {
    return nextIndex;
  }

  if (previousIndex >= 0 && pointerY < rowMidpoints[previousIndex]) {
    return previousIndex;
  }

  return currentIndex;
}
