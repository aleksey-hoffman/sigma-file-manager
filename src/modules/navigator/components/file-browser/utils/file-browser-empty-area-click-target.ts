// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const EMPTY_AREA_IGNORED_TARGET_SELECTOR = [
  '[data-entry-path]',
  '.file-browser-loading',
  '.file-browser__empty-state-container',
  '.file-browser-error',
].join(', ');

const EMPTY_AREA_CLICK_ROOT_SELECTOR = '.file-browser__scroll-area-viewport';

export function isFileBrowserEmptyAreaClickTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) {
    return false;
  }

  if (target.closest(EMPTY_AREA_IGNORED_TARGET_SELECTOR)) {
    return false;
  }

  return target.closest(EMPTY_AREA_CLICK_ROOT_SELECTOR) !== null;
}
