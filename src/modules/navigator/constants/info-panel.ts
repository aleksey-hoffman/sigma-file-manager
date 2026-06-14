// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const INFO_PANEL_LAYOUT = {
  DEFAULT_WIDTH_PX: 280,
  MIN_WIDTH_PX: 200,
  MAX_WIDTH_PX: 600,
  MAIN_MIN_WIDTH_PERCENT: 50,
  DEFAULT_PREVIEW_HEIGHT_PX: 180,
  MIN_PREVIEW_HEIGHT_PX: 100,
  MAX_PREVIEW_HEIGHT_PX: 480,
  REFERENCE_NAVIGATOR_WIDTH_PX: 1400,
  REFERENCE_NAVIGATOR_HEIGHT_PX: 800,
  SIZE_TRANSITION_MS: 400,
  SIZE_TRANSITION_BACK_OVERSHOOT: 1.4,
  VISIBILITY_TRANSITION_EASING: 'cubic-bezier(0.16, 1, 0.3, 1)',
  COMPACT_DRAWER_PREFERRED_HEIGHT_VH: 65,
  COMPACT_DRAWER_MIN_HEIGHT_PX: 240,
  COMPACT_DRAWER_MAX_PREVIEW_HEIGHT_PX: 300,
  PROPERTIES_ROWS_MIN_WIDTH_PX: 250,
} as const;

export function clampInfoPanelPx(value: number, minPx: number, maxPx: number): number {
  return Math.min(maxPx, Math.max(minPx, Math.round(value)));
}

export function getScaledInfoPanelDefaultPx(
  referenceDefaultPx: number,
  referenceContainerPx: number,
  currentContainerPx: number,
  minPx: number,
  maxPx: number,
): number {
  const scale = currentContainerPx / referenceContainerPx;

  return clampInfoPanelPx(referenceDefaultPx * scale, minPx, maxPx);
}
