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
      // FORK-MODIFICATION: 未在用户顺序里出现的分组按默认顺序补在后面
      'frequent',
      'history',
    ]);
  });

  it('fills missing sections and drops unknown values', () => {
    expect(normalizeQuickAccessSectionOrder(['tagged', 'other', 'tagged'])).toEqual([
      'tagged',
      'favorites',
      'frequent',
      'history',
    ]);
  });

  it('falls back to the default order', () => {
    expect(normalizeQuickAccessSectionOrder(undefined)).toEqual(DEFAULT_QUICK_ACCESS_SECTION_ORDER);
    expect(normalizeQuickAccessSectionOrder([])).toEqual(DEFAULT_QUICK_ACCESS_SECTION_ORDER);
  });

  // FORK-MODIFICATION: 需求 N3② —— 新增 frequent / history 两个分组
  it('keeps the frequent and history sections in a user-defined position', () => {
    expect(normalizeQuickAccessSectionOrder(['history', 'favorites'])).toEqual([
      'history',
      'favorites',
      'tagged',
      'frequent',
    ]);
  });

  it('accepts all four sections without dropping any', () => {
    expect(
      normalizeQuickAccessSectionOrder(['history', 'frequent', 'tagged', 'favorites']),
    ).toEqual(['history', 'frequent', 'tagged', 'favorites']);
  });

  it('defaults to favorites, tagged, frequent, history', () => {
    expect(DEFAULT_QUICK_ACCESS_SECTION_ORDER).toEqual([
      'favorites',
      'tagged',
      'frequent',
      'history',
    ]);
  });
});
