// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const SCROLL_VIEWPORT_SELECTOR = '[data-reka-scroll-area-viewport]';

export function resolveScrollAreaViewportElement(element: HTMLElement): HTMLElement {
  if (element.matches(SCROLL_VIEWPORT_SELECTOR)) {
    return element;
  }

  const closestViewport = element.closest<HTMLElement>(SCROLL_VIEWPORT_SELECTOR);

  if (closestViewport) {
    return closestViewport;
  }

  return element.querySelector<HTMLElement>(SCROLL_VIEWPORT_SELECTOR) ?? element;
}

export function refreshScrollAreaHorizontalMetrics(viewport: HTMLElement) {
  const scrollContent = viewport.firstElementChild;

  if (!(scrollContent instanceof HTMLElement)) {
    return;
  }

  const contentScrollWidth = viewport.scrollWidth;
  scrollContent.style.width = `${contentScrollWidth}px`;

  requestAnimationFrame(() => {
    scrollContent.style.removeProperty('width');

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

    if (viewport.scrollLeft > maxScrollLeft) {
      viewport.scrollLeft = maxScrollLeft;
    }
  });
}
