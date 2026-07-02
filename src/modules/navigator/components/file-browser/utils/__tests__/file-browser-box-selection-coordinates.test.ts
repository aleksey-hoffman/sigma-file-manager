// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  buildBoxSelectionBox,
  clientPointToBoxSelectionContentPoint,
} from '../file-browser-box-selection-coordinates';

describe('file-browser-box-selection-coordinates', () => {
  it('expands the client selection box when scrollTop increases without pointer movement', () => {
    const viewportRect = new DOMRect(100, 200, 800, 600);
    const contentRect = new DOMRect(120, 200, 760, 600);
    const paneRect = new DOMRect(80, 160, 840, 680);
    const originPointer = {
      clientX: 200,
      clientY: 260,
    };
    const latestPointer = {
      clientX: 400,
      clientY: 360,
    };
    const virtualContentOffset = 0;

    const originContent = clientPointToBoxSelectionContentPoint(
      originPointer,
      viewportRect,
      contentRect,
      0,
      0,
      virtualContentOffset,
    );

    const initialBox = buildBoxSelectionBox(
      originContent,
      latestPointer,
      viewportRect,
      contentRect,
      0,
      0,
      virtualContentOffset,
      paneRect,
    );
    const scrolledBox = buildBoxSelectionBox(
      originContent,
      latestPointer,
      viewportRect,
      contentRect,
      120,
      0,
      virtualContentOffset,
      paneRect,
    );

    expect(scrolledBox.bottom - scrolledBox.top).toBeGreaterThan(initialBox.bottom - initialBox.top);
    expect(scrolledBox.top).toBeLessThan(initialBox.top);
  });
});
