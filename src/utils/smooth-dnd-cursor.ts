// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const SMOOTH_DND_CURSOR_STYLE_PREFIX = 'body *{cursor:';
const RELEASE_EVENT_NAMES = ['mouseup', 'touchend'] as const;

function removeSmoothDndCursorStyles() {
  for (const styleElement of document.head.querySelectorAll('style')) {
    if (styleElement.textContent?.startsWith(SMOOTH_DND_CURSOR_STYLE_PREFIX)) {
      styleElement.remove();
    }
  }
}

/*
  smooth-dnd adds a global `body * { cursor: ... !important }` style in a setTimeout
  after creating the drag ghost when a dragClass is set. If the pointer is released
  before that timeout runs, its release cleanup finds nothing to remove and the style
  is added afterwards and never removed, leaving the grabbing cursor on the whole app.
  Call this on drag start: the timeout queued on release runs after the library's.
*/
export function removeSmoothDndCursorStyleOnRelease() {
  function handleRelease() {
    RELEASE_EVENT_NAMES.forEach(eventName => window.removeEventListener(eventName, handleRelease, true));
    setTimeout(removeSmoothDndCursorStyles);
  }

  RELEASE_EVENT_NAMES.forEach(eventName => window.addEventListener(eventName, handleRelease, true));
}
