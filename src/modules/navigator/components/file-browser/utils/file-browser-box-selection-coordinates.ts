// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { FileBrowserBoxSelectionBox } from './file-browser-box-selection-hit-test';

export interface BoxSelectionPointerPosition {
  clientX: number;
  clientY: number;
}

export interface BoxSelectionContentPoint {
  x: number;
  y: number;
}

export function clientPointToBoxSelectionContentPoint(
  point: BoxSelectionPointerPosition,
  viewportRect: DOMRect,
  contentRect: DOMRect,
  scrollTop: number,
  scrollLeft: number,
  virtualContentOffset: number,
): BoxSelectionContentPoint {
  return {
    x: point.clientX - contentRect.left + scrollLeft,
    y: point.clientY - viewportRect.top + scrollTop - virtualContentOffset,
  };
}

export function boxSelectionContentToClientBox(
  origin: BoxSelectionContentPoint,
  current: BoxSelectionContentPoint,
  viewportRect: DOMRect,
  contentRect: DOMRect,
  scrollTop: number,
  scrollLeft: number,
  virtualContentOffset: number,
): FileBrowserBoxSelectionBox {
  const contentLeft = Math.min(origin.x, current.x);
  const contentRight = Math.max(origin.x, current.x);
  const contentTop = Math.min(origin.y, current.y);
  const contentBottom = Math.max(origin.y, current.y);

  return {
    left: contentRect.left + contentLeft - scrollLeft,
    top: viewportRect.top + contentTop + virtualContentOffset - scrollTop,
    right: contentRect.left + contentRight - scrollLeft,
    bottom: viewportRect.top + contentBottom + virtualContentOffset - scrollTop,
  };
}

export function buildBoxSelectionBox(
  originContent: BoxSelectionContentPoint,
  currentPointer: BoxSelectionPointerPosition,
  viewportRect: DOMRect,
  contentRect: DOMRect,
  scrollTop: number,
  scrollLeft: number,
  virtualContentOffset: number,
  paneRect: DOMRect,
): FileBrowserBoxSelectionBox {
  const clampedCurrent = {
    clientX: Math.min(Math.max(currentPointer.clientX, paneRect.left), paneRect.right),
    clientY: Math.min(Math.max(currentPointer.clientY, paneRect.top), paneRect.bottom),
  };
  const currentContent = clientPointToBoxSelectionContentPoint(
    clampedCurrent,
    viewportRect,
    contentRect,
    scrollTop,
    scrollLeft,
    virtualContentOffset,
  );

  return boxSelectionContentToClientBox(
    originContent,
    currentContent,
    viewportRect,
    contentRect,
    scrollTop,
    scrollLeft,
    virtualContentOffset,
  );
}
