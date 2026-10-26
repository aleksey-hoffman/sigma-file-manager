// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { InfusionBlendTarget, MixBlendMode } from '@/types/user-settings';

/**
 * Blend modes the background visual effect can use, in the order and groups of the Photoshop menu.
 * Photoshop modes CSS lacks (Linear Burn, Darker Color, Lighter Color) are left out; Linear Dodge (Add)
 * is CSS plus-lighter. Hue and Saturation are left out because with a fill color they flatten
 * the media to the fill and look like Color, and over the interface they are almost invisible.
 */
export const INFUSION_BLEND_MODE_GROUPS: readonly (readonly MixBlendMode[])[] = [
  ['normal'],
  ['darken', 'multiply', 'color-burn'],
  ['lighten', 'screen', 'color-dodge', 'plus-lighter'],
  ['overlay', 'soft-light', 'hard-light'],
  ['difference', 'exclusion'],
  ['color', 'luminosity'],
];

export const INFUSION_BLEND_MODES: readonly MixBlendMode[] = INFUSION_BLEND_MODE_GROUPS.flat();

export const DEFAULT_INFUSION_BLEND_MODE: MixBlendMode = 'normal';

/**
 * What a blend mode blends the media with: "ui" is the interface under the effect (the effect is drawn over it),
 * "fill" is a fill color inside the effect's own layer.
 */
export const INFUSION_BLEND_TARGETS: readonly InfusionBlendTarget[] = ['ui', 'fill'];

export const DEFAULT_INFUSION_BLEND_TARGET: InfusionBlendTarget = 'ui';

export const DEFAULT_INFUSION_BLEND_TINT = '#3b82f6';

export const INFUSION_BLEND_TINTS: readonly string[] = [
  '#3b82f6',
  '#6366f1',
  '#a855f7',
  '#ec4899',
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#14b8a6',
];

/**
 * Blend modes older versions offered that are no longer in the menu, and the mode that replaces them.
 * Hue and Saturation belong to the same component group as Color, which keeps the media's color.
 */
export const LEGACY_INFUSION_BLEND_MODE_REPLACEMENTS: Readonly<Record<string, MixBlendMode>> = {
  hue: 'color',
  saturation: 'color',
};

export function isInfusionBlendMode(value: unknown): value is MixBlendMode {
  return typeof value === 'string' && (INFUSION_BLEND_MODES as readonly string[]).includes(value);
}

export function isInfusionBlendTarget(value: unknown): value is InfusionBlendTarget {
  return typeof value === 'string' && (INFUSION_BLEND_TARGETS as readonly string[]).includes(value);
}

/** Returns a mode from the allowlist: legacy modes are replaced, anything else falls back to normal. */
export function normalizeInfusionBlendMode(value: unknown): MixBlendMode {
  if (isInfusionBlendMode(value)) {
    return value;
  }

  if (typeof value === 'string' && Object.hasOwn(LEGACY_INFUSION_BLEND_MODE_REPLACEMENTS, value)) {
    return LEGACY_INFUSION_BLEND_MODE_REPLACEMENTS[value];
  }

  return DEFAULT_INFUSION_BLEND_MODE;
}

export function normalizeInfusionBlendTarget(value: unknown): InfusionBlendTarget {
  return isInfusionBlendTarget(value) ? value : DEFAULT_INFUSION_BLEND_TARGET;
}

/** Returns the color as lower-case #rrggbb, or null when it is anything else. */
export function parseInfusionBlendTint(value: unknown): string | null {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

export function normalizeInfusionBlendTint(value: unknown): string {
  return parseInfusionBlendTint(value) ?? DEFAULT_INFUSION_BLEND_TINT;
}

export type InfusionBlendSettings = {
  mixBlendMode: MixBlendMode;
  blendTarget: InfusionBlendTarget;
  blendTint: string;
};

export function normalizeInfusionBlendSettings(value: {
  mixBlendMode?: unknown;
  blendTarget?: unknown;
  blendTint?: unknown;
}): InfusionBlendSettings {
  return {
    mixBlendMode: normalizeInfusionBlendMode(value.mixBlendMode),
    blendTarget: normalizeInfusionBlendTarget(value.blendTarget),
    blendTint: normalizeInfusionBlendTint(value.blendTint),
  };
}

/** Whether this webview can draw the mode. Normal always works; without CSS.supports every mode is assumed to work. */
export function isInfusionBlendModeSupported(mode: MixBlendMode): boolean {
  if (mode === 'normal' || typeof CSS === 'undefined' || typeof CSS.supports !== 'function') {
    return true;
  }

  return CSS.supports('mix-blend-mode', mode);
}

/** The menu groups without the modes this webview cannot draw, and without groups left empty. */
export function getSupportedInfusionBlendModeGroups(
  isSupported: (mode: MixBlendMode) => boolean = isInfusionBlendModeSupported,
): MixBlendMode[][] {
  return INFUSION_BLEND_MODE_GROUPS
    .map(group => group.filter(mode => isSupported(mode)))
    .filter(group => group.length > 0);
}
