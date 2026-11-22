// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getFolderMeterFraction } from '../file-browser-folder-meter';

describe('getFolderMeterFraction', () => {
  it('returns 0 for empty or unknown sizes', () => {
    expect(getFolderMeterFraction(0)).toBe(0);
    expect(getFolderMeterFraction(null)).toBe(0);
    expect(getFolderMeterFraction(undefined)).toBe(0);
    expect(getFolderMeterFraction(-5)).toBe(0);
    expect(getFolderMeterFraction(Number.NaN)).toBe(0);
  });

  it('places MB, GB and TB at thirds of a log scale', () => {
    expect(getFolderMeterFraction(1e6)).toBeCloseTo(1 / 3);
    expect(getFolderMeterFraction(1e9)).toBeCloseTo(2 / 3);
    expect(getFolderMeterFraction(1e12)).toBe(1);
  });

  it('keeps a visible sliver for tiny folders and caps huge ones', () => {
    expect(getFolderMeterFraction(12)).toBe(0.04);
    expect(getFolderMeterFraction(1e3)).toBe(0.04);
    expect(getFolderMeterFraction(5e15)).toBe(1);
  });
});
