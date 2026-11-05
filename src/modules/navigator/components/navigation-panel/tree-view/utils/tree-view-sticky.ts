// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const TREE_VIEW_LAYOUT = {
  ROW_HEIGHT_PX: 28,
  MAX_STICKY_ROWS: 7,
  MAX_STICKY_VIEWPORT_RATIO: 0.4,
} as const;

export function getTreeViewStickyRowLimit(viewportHeightPx: number): number {
  if (!Number.isFinite(viewportHeightPx) || viewportHeightPx <= 0) {
    return 0;
  }

  const rowsThatFit = Math.floor(
    (viewportHeightPx * TREE_VIEW_LAYOUT.MAX_STICKY_VIEWPORT_RATIO) / TREE_VIEW_LAYOUT.ROW_HEIGHT_PX,
  );

  return Math.min(TREE_VIEW_LAYOUT.MAX_STICKY_ROWS, rowsThatFit);
}
