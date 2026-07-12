// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface ElementContentBoxInsets {
  borderLeft: number;
  borderTop: number;
  paddingBottom: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
}

export function getElementContentBoxInsets(element: HTMLElement): ElementContentBoxInsets {
  const style = getComputedStyle(element);

  return {
    borderLeft: Number.parseFloat(style.borderLeftWidth) || 0,
    borderTop: Number.parseFloat(style.borderTopWidth) || 0,
    paddingBottom: Number.parseFloat(style.paddingBottom) || 0,
    paddingLeft: Number.parseFloat(style.paddingLeft) || 0,
    paddingRight: Number.parseFloat(style.paddingRight) || 0,
    paddingTop: Number.parseFloat(style.paddingTop) || 0,
  };
}

export function getElementContentBoxWidth(element: HTMLElement): number {
  const { paddingLeft, paddingRight } = getElementContentBoxInsets(element);

  return Math.max(0, element.clientWidth - paddingLeft - paddingRight);
}

export function getElementContentBoxClientRect(
  element: HTMLElement,
  insets: ElementContentBoxInsets = getElementContentBoxInsets(element),
): DOMRect {
  const rect = element.getBoundingClientRect();
  const {
    borderLeft,
    borderTop,
    paddingBottom,
    paddingLeft,
    paddingRight,
    paddingTop,
  } = insets;

  return new DOMRect(
    rect.left + borderLeft + paddingLeft,
    rect.top + borderTop + paddingTop,
    Math.max(0, element.clientWidth - paddingLeft - paddingRight),
    Math.max(0, element.clientHeight - paddingTop - paddingBottom),
  );
}
