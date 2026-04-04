// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const QUICK_SEARCH_PROPERTY_KEYS = [
  'name',
  'size',
  'items',
  'modified',
  'created',
  'accessed',
  'path',
  'mime',
] as const;

export type QuickSearchProperty = (typeof QUICK_SEARCH_PROPERTY_KEYS)[number];

const PROPERTY_PREFIX_PATTERN = new RegExp(
  `^(${QUICK_SEARCH_PROPERTY_KEYS.join('|')})\\s*:\\s*(.*)$`,
  'is',
);

export function parseQuickSearchQuery(raw: string): {
  property: QuickSearchProperty | null;
  value: string;
} {
  const trimmed = raw.trim();
  const match = trimmed.match(PROPERTY_PREFIX_PATTERN);

  if (!match) {
    return { property: null, value: trimmed };
  }

  const key = match[1].toLowerCase() as QuickSearchProperty;

  if (!QUICK_SEARCH_PROPERTY_KEYS.includes(key)) {
    return { property: null, value: trimmed };
  }

  return { property: key, value: match[2] };
}

export function toggleQuickSearchPropertyInQuery(
  query: string,
  targetProperty: QuickSearchProperty,
): string {
  const trimmed = query.trim();
  const parsed = parseQuickSearchQuery(trimmed);
  const valuePortion = parsed.property !== null ? parsed.value.trim() : trimmed;

  if (parsed.property === targetProperty) {
    return valuePortion;
  }

  if (valuePortion === '') {
    return `${targetProperty}:`;
  }

  return `${targetProperty}: ${valuePortion}`;
}
