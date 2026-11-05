// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getTreeViewStickyRowLimit, TREE_VIEW_LAYOUT } from '../tree-view-sticky';

describe('getTreeViewStickyRowLimit', () => {
  it('disables sticky rows before the tree has a height', () => {
    expect(getTreeViewStickyRowLimit(0)).toBe(0);
    expect(getTreeViewStickyRowLimit(Number.NaN)).toBe(0);
  });

  it('keeps sticky rows within a share of a short tree', () => {
    expect(getTreeViewStickyRowLimit(190)).toBe(2);
  });

  it('caps sticky rows on a tall tree', () => {
    expect(getTreeViewStickyRowLimit(2000)).toBe(TREE_VIEW_LAYOUT.MAX_STICKY_ROWS);
  });
});
