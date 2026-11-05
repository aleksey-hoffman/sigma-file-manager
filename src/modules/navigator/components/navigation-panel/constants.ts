// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const NAVIGATION_PANEL_LAYOUT = {
  DEFAULT_WIDTH_PX: 260,
  MAX_WIDTH_PX: 1_000_000,
  TRANSITION_END_GRACE_MS: 80,
  RESIZE_KEYBOARD_STEP_PX: 16,
} as const;

export function clampNavigationPanelWidthPx(value: number): number {
  if (!Number.isFinite(value)) {
    return NAVIGATION_PANEL_LAYOUT.DEFAULT_WIDTH_PX;
  }

  return Math.min(
    NAVIGATION_PANEL_LAYOUT.MAX_WIDTH_PX,
    Math.max(0, Math.round(value)),
  );
}
