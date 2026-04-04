// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type CompareOp = '>=' | '<=' | '>' | '<' | '=' | '==';

export type QuickSearchSizePredicate =
  | { kind: 'substring' }
  | { kind: 'compare'; op: CompareOp; thresholdBytes: number }
  | { kind: 'between'; minBytes: number; maxBytes: number };

export type QuickSearchItemsPredicate =
  | { kind: 'substring' }
  | { kind: 'compare'; op: CompareOp; threshold: number }
  | { kind: 'between'; min: number; max: number };

const SIZE_UNIT_TO_BYTES: Record<string, number> = {
  b: 1,
  kb: 1024,
  mb: 1024 ** 2,
  gb: 1024 ** 3,
  tb: 1024 ** 4,
};

const BETWEEN_SIZE_PATTERN = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?\s*\.\.\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?\s*$/i;

const COMPARE_SIZE_PATTERN = /^\s*(>=|<=|>|<|==|=)\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb|tb)?\s*$/i;

const BETWEEN_ITEMS_PATTERN = /^\s*(\d+)\s*\.\.\s*(\d+)\s*$/;

const COMPARE_ITEMS_PATTERN = /^\s*(>=|<=|>|<|==|=)\s*(\d+)\s*$/;

function sizeToBytes(value: number, unit: string | undefined): number {
  const unitTrimmed = unit?.trim();

  if (!unitTrimmed) {
    return value * SIZE_UNIT_TO_BYTES.mb;
  }

  const multiplier = SIZE_UNIT_TO_BYTES[unitTrimmed.toLowerCase()] ?? 1;

  return value * multiplier;
}

export function parseQuickSearchSizePredicate(raw: string): QuickSearchSizePredicate {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { kind: 'substring' };
  }

  const betweenMatch = trimmed.match(BETWEEN_SIZE_PATTERN);

  if (betweenMatch) {
    const firstValue = Number(betweenMatch[1]);
    const secondValue = Number(betweenMatch[3]);

    if (!Number.isFinite(firstValue) || !Number.isFinite(secondValue)) {
      return { kind: 'substring' };
    }

    const firstUnit = betweenMatch[2];
    const secondUnit = betweenMatch[4] ?? firstUnit;
    const minBytes = sizeToBytes(firstValue, firstUnit);
    const maxBytes = sizeToBytes(secondValue, secondUnit);

    if (minBytes > maxBytes) {
      return { kind: 'between', minBytes: maxBytes, maxBytes: minBytes };
    }

    return { kind: 'between', minBytes, maxBytes };
  }

  const compareMatch = trimmed.match(COMPARE_SIZE_PATTERN);

  if (compareMatch) {
    const numericValue = Number(compareMatch[2]);

    if (!Number.isFinite(numericValue)) {
      return { kind: 'substring' };
    }

    const op = compareMatch[1] as CompareOp;
    const thresholdBytes = sizeToBytes(numericValue, compareMatch[3]);

    return { kind: 'compare', op, thresholdBytes };
  }

  return { kind: 'substring' };
}

export function parseQuickSearchItemsPredicate(raw: string): QuickSearchItemsPredicate {
  const trimmed = raw.trim();

  if (trimmed === '') {
    return { kind: 'substring' };
  }

  const betweenMatch = trimmed.match(BETWEEN_ITEMS_PATTERN);

  if (betweenMatch) {
    const min = Number(betweenMatch[1]);
    const max = Number(betweenMatch[2]);

    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      return { kind: 'substring' };
    }

    if (min > max) {
      return { kind: 'between', min: max, max: min };
    }

    return { kind: 'between', min, max };
  }

  const compareMatch = trimmed.match(COMPARE_ITEMS_PATTERN);

  if (compareMatch) {
    const threshold = Number(compareMatch[2]);

    if (!Number.isFinite(threshold)) {
      return { kind: 'substring' };
    }

    const op = compareMatch[1] as CompareOp;

    return { kind: 'compare', op, threshold };
  }

  return { kind: 'substring' };
}

export function evaluateCompare(op: CompareOp, left: number, right: number): boolean {
  switch (op) {
    case '>=':
      return left >= right;
    case '<=':
      return left <= right;
    case '>':
      return left > right;
    case '<':
      return left < right;
    case '=':
    case '==':
      return left === right;
    default:
      return false;
  }
}

export function evaluateQuickSearchSizePredicate(
  predicate: Exclude<QuickSearchSizePredicate, { kind: 'substring' }>,
  sizeBytes: number,
): boolean {
  if (predicate.kind === 'between') {
    return sizeBytes >= predicate.minBytes && sizeBytes <= predicate.maxBytes;
  }

  return evaluateCompare(predicate.op, sizeBytes, predicate.thresholdBytes);
}

export function evaluateQuickSearchItemsPredicate(
  predicate: Exclude<QuickSearchItemsPredicate, { kind: 'substring' }>,
  itemCount: number,
): boolean {
  if (predicate.kind === 'between') {
    return itemCount >= predicate.min && itemCount <= predicate.max;
  }

  return evaluateCompare(predicate.op, itemCount, predicate.threshold);
}
