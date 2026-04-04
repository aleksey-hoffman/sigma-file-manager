// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  evaluateQuickSearchSizePredicate,
  parseQuickSearchSizePredicate,
  parseQuickSearchItemsPredicate,
  evaluateQuickSearchItemsPredicate,
} from '../file-browser-quick-search-numeric';

const MB = 1024 ** 2;

describe('parseQuickSearchSizePredicate', () => {
  it('parses comparison with default megabytes when unit omitted', () => {
    expect(parseQuickSearchSizePredicate('>=2')).toEqual({
      kind: 'compare',
      op: '>=',
      thresholdBytes: 2 * MB,
    });
  });

  it('parses explicit units', () => {
    expect(parseQuickSearchSizePredicate('<= 512kb')).toEqual({
      kind: 'compare',
      op: '<=',
      thresholdBytes: 512 * 1024,
    });
  });

  it('returns substring for plain text without operators', () => {
    expect(parseQuickSearchSizePredicate('report')).toEqual({ kind: 'substring' });
  });

  it('parses inclusive between ranges', () => {
    expect(parseQuickSearchSizePredicate('1mb..10mb')).toEqual({
      kind: 'between',
      minBytes: MB,
      maxBytes: 10 * MB,
    });
  });

  it('swaps between bounds when min greater than max', () => {
    expect(parseQuickSearchSizePredicate('10mb..1mb')).toEqual({
      kind: 'between',
      minBytes: MB,
      maxBytes: 10 * MB,
    });
  });
});

describe('evaluateQuickSearchSizePredicate', () => {
  it('evaluates compare and between', () => {
    const compare = parseQuickSearchSizePredicate('>=2mb');
    if (compare.kind === 'substring') throw new Error('expected compare');
    expect(evaluateQuickSearchSizePredicate(compare, 3 * MB)).toBe(true);
    expect(evaluateQuickSearchSizePredicate(compare, 1 * MB)).toBe(false);

    const between = parseQuickSearchSizePredicate('1mb..3mb');
    if (between.kind === 'substring') throw new Error('expected between');
    expect(evaluateQuickSearchSizePredicate(between, 2 * MB)).toBe(true);
    expect(evaluateQuickSearchSizePredicate(between, 4 * MB)).toBe(false);
  });
});

describe('parseQuickSearchItemsPredicate', () => {
  it('parses integer comparisons and ranges', () => {
    expect(parseQuickSearchItemsPredicate('>=5')).toEqual({
      kind: 'compare',
      op: '>=',
      threshold: 5,
    });
    expect(parseQuickSearchItemsPredicate('3..12')).toEqual({
      kind: 'between',
      min: 3,
      max: 12,
    });
  });
});

describe('evaluateQuickSearchItemsPredicate', () => {
  it('evaluates items predicates', () => {
    const compare = parseQuickSearchItemsPredicate('==10');
    if (compare.kind === 'substring') throw new Error('expected compare');
    expect(evaluateQuickSearchItemsPredicate(compare, 10)).toBe(true);
    expect(evaluateQuickSearchItemsPredicate(compare, 9)).toBe(false);

    const between = parseQuickSearchItemsPredicate('2..4');
    if (between.kind === 'substring') throw new Error('expected between');
    expect(evaluateQuickSearchItemsPredicate(between, 3)).toBe(true);
  });
});
