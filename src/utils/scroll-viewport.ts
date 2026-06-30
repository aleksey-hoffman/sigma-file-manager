// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function getScrollViewportFromElement(root: HTMLElement | null): HTMLElement | null {
  if (!root) {
    return null;
  }

  return root.querySelector<HTMLElement>('[data-radix-scroll-area-viewport], .sigma-ui-scroll-area__viewport');
}
