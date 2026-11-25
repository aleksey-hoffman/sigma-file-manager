// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type RectBounds = Pick<DOMRect, 'top' | 'left' | 'width' | 'height'>;

const SAME_ROW_TOLERANCE_PX = 1;

function getCenterX(rect: RectBounds): number {
  return rect.left + rect.width / 2;
}

function getCenterY(rect: RectBounds): number {
  return rect.top + rect.height / 2;
}

/** Finds the rect on the closest row and, within that row, the one closest horizontally. */
export function findNearestRectIndex(rects: readonly RectBounds[], source: RectBounds): number {
  const sourceX = getCenterX(source);
  const sourceY = getCenterY(source);
  let nearestIndex = -1;
  let nearestRowDistance = Infinity;
  let nearestColumnDistance = Infinity;

  rects.forEach((rect, index) => {
    const rowDistance = Math.abs(getCenterY(rect) - sourceY);
    const columnDistance = Math.abs(getCenterX(rect) - sourceX);
    const isCloserRow = rowDistance < nearestRowDistance - SAME_ROW_TOLERANCE_PX;
    const isSameRow = Math.abs(rowDistance - nearestRowDistance) <= SAME_ROW_TOLERANCE_PX;

    if (isCloserRow || (isSameRow && columnDistance < nearestColumnDistance)) {
      nearestIndex = index;
      nearestRowDistance = rowDistance;
      nearestColumnDistance = columnDistance;
    }
  });

  return nearestIndex;
}
