// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getElementContentBoxWidth(element: HTMLElement): number {
  const style = getComputedStyle(element);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;

  return Math.max(0, element.clientWidth - paddingLeft - paddingRight);
}

export function getElementContentBoxClientRect(element: HTMLElement): DOMRect {
  const rect = element.getBoundingClientRect();
  const style = getComputedStyle(element);
  const paddingLeft = Number.parseFloat(style.paddingLeft) || 0;
  const paddingRight = Number.parseFloat(style.paddingRight) || 0;
  const paddingTop = Number.parseFloat(style.paddingTop) || 0;
  const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
  const borderLeft = Number.parseFloat(style.borderLeftWidth) || 0;
  const borderTop = Number.parseFloat(style.borderTopWidth) || 0;

  return new DOMRect(
    rect.left + borderLeft + paddingLeft,
    rect.top + borderTop + paddingTop,
    Math.max(0, element.clientWidth - paddingLeft - paddingRight),
    Math.max(0, element.clientHeight - paddingTop - paddingBottom),
  );
}
