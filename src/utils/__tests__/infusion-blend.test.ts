// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import {
  DEFAULT_INFUSION_BLEND_TINT,
  getSupportedInfusionBlendModeGroups,
  INFUSION_BLEND_MODE_GROUPS,
  INFUSION_BLEND_MODES,
  INFUSION_BLEND_TINTS,
  isInfusionBlendMode,
  isInfusionBlendModeSupported,
  isInfusionBlendTarget,
  normalizeInfusionBlendMode,
  normalizeInfusionBlendSettings,
  normalizeInfusionBlendTarget,
  normalizeInfusionBlendTint,
  parseInfusionBlendTint,
} from '@/utils/infusion-blend';

describe('infusion blend modes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lists the 15 modes in Photoshop order and groups', () => {
    expect(INFUSION_BLEND_MODE_GROUPS).toEqual([
      ['normal'],
      ['darken', 'multiply', 'color-burn'],
      ['lighten', 'screen', 'color-dodge', 'plus-lighter'],
      ['overlay', 'soft-light', 'hard-light'],
      ['difference', 'exclusion'],
      ['color', 'luminosity'],
    ]);
    expect(INFUSION_BLEND_MODES).toHaveLength(15);
  });

  it('accepts only modes from the allowlist', () => {
    expect(isInfusionBlendMode('plus-lighter')).toBe(true);
    expect(isInfusionBlendMode('hue')).toBe(false);
    expect(isInfusionBlendMode('saturation')).toBe(false);
    expect(isInfusionBlendMode('Multiply')).toBe(false);
    expect(isInfusionBlendMode(undefined)).toBe(false);
    expect(isInfusionBlendMode(1)).toBe(false);
  });

  it('replaces legacy modes and falls back to normal for anything else', () => {
    expect(normalizeInfusionBlendMode('multiply')).toBe('multiply');
    expect(normalizeInfusionBlendMode('hue')).toBe('color');
    expect(normalizeInfusionBlendMode('saturation')).toBe('color');
    expect(normalizeInfusionBlendMode('linear-burn')).toBe('normal');
    expect(normalizeInfusionBlendMode('constructor')).toBe('normal');
    expect(normalizeInfusionBlendMode('toString')).toBe('normal');
    expect(normalizeInfusionBlendMode(null)).toBe('normal');
    expect(normalizeInfusionBlendMode({})).toBe('normal');
  });

  it('validates the blend target and defaults to the interface', () => {
    expect(isInfusionBlendTarget('ui')).toBe(true);
    expect(isInfusionBlendTarget('fill')).toBe(true);
    expect(isInfusionBlendTarget('both')).toBe(false);
    expect(normalizeInfusionBlendTarget('fill')).toBe('fill');
    expect(normalizeInfusionBlendTarget('both')).toBe('ui');
    expect(normalizeInfusionBlendTarget(undefined)).toBe('ui');
  });

  it('keeps tints as lower-case #rrggbb only', () => {
    expect(parseInfusionBlendTint('#3B82F6')).toBe('#3b82f6');
    expect(parseInfusionBlendTint('#abc')).toBeNull();
    expect(parseInfusionBlendTint('3b82f6')).toBeNull();
    expect(parseInfusionBlendTint('#3b82f6ff')).toBeNull();
    expect(parseInfusionBlendTint('red')).toBeNull();
    expect(parseInfusionBlendTint('#3b82f6; color: red')).toBeNull();
    expect(normalizeInfusionBlendTint('#EC4899')).toBe('#ec4899');
    expect(normalizeInfusionBlendTint(42)).toBe(DEFAULT_INFUSION_BLEND_TINT);
    expect(DEFAULT_INFUSION_BLEND_TINT).toBe('#3b82f6');
  });

  it('offers 8 valid swatches starting with the default tint', () => {
    expect(INFUSION_BLEND_TINTS).toHaveLength(8);
    expect(INFUSION_BLEND_TINTS[0]).toBe(DEFAULT_INFUSION_BLEND_TINT);
    expect(INFUSION_BLEND_TINTS.every(tint => parseInfusionBlendTint(tint) === tint)).toBe(true);
  });

  it('normalizes settings saved by older versions without the new fields', () => {
    expect(normalizeInfusionBlendSettings({ mixBlendMode: 'overlay' })).toEqual({
      mixBlendMode: 'overlay',
      blendTarget: 'ui',
      blendTint: '#3b82f6',
    });
    expect(normalizeInfusionBlendSettings({
      mixBlendMode: 'saturation',
      blendTarget: 'fill',
      blendTint: '#22C55E',
    })).toEqual({
      mixBlendMode: 'color',
      blendTarget: 'fill',
      blendTint: '#22c55e',
    });
  });

  it('drops modes the webview cannot draw and groups left empty', () => {
    const groups = getSupportedInfusionBlendModeGroups(
      mode => !['plus-lighter', 'difference', 'exclusion'].includes(mode),
    );

    expect(groups).toEqual([
      ['normal'],
      ['darken', 'multiply', 'color-burn'],
      ['lighten', 'screen', 'color-dodge'],
      ['overlay', 'soft-light', 'hard-light'],
      ['color', 'luminosity'],
    ]);
  });

  it('asks CSS.supports for every mode except normal', () => {
    const supports = vi.fn((_property: string, value: string) => value !== 'plus-lighter');
    vi.stubGlobal('CSS', { supports });

    expect(isInfusionBlendModeSupported('normal')).toBe(true);
    expect(isInfusionBlendModeSupported('multiply')).toBe(true);
    expect(isInfusionBlendModeSupported('plus-lighter')).toBe(false);
    expect(supports).toHaveBeenCalledWith('mix-blend-mode', 'plus-lighter');
    expect(supports).not.toHaveBeenCalledWith('mix-blend-mode', 'normal');
  });
});
