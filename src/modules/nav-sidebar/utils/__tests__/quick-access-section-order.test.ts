// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_QUICK_ACCESS_SECTION_ORDER,
  normalizeQuickAccessSectionOrder,
} from '../quick-access-section-order';

describe('normalizeQuickAccessSectionOrder', () => {
  it('keeps a valid reversed order', () => {
    expect(normalizeQuickAccessSectionOrder(['tagged', 'favorites'])).toEqual([
      'tagged',
      'favorites',
    ]);
  });

  it('fills missing sections and drops unknown values', () => {
    expect(normalizeQuickAccessSectionOrder(['tagged', 'other', 'tagged'])).toEqual([
      'tagged',
      'favorites',
    ]);
  });

  it('falls back to the default order', () => {
    expect(normalizeQuickAccessSectionOrder(undefined)).toEqual(DEFAULT_QUICK_ACCESS_SECTION_ORDER);
    expect(normalizeQuickAccessSectionOrder([])).toEqual(DEFAULT_QUICK_ACCESS_SECTION_ORDER);
  });
});
