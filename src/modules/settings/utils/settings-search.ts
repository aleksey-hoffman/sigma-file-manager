// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { messages } from '@/localization/data';

export const SHORTCUTS_SECTION_SEARCH_KEYS = [
  'settingsTabs.shortcuts',
  'settingsTags.shortcuts',
] as const;

export type SettingsSectionSearchFields = {
  key: string;
  titleKey: string;
  tags: string;
  category: string;
};

export type SettingsShortcutSearchItem = {
  labelKey?: string;
  titles?: string[];
  combinations: string[];
};

const SHORTCUT_DISPLAY_ALIASES: Array<[string, string]> = [
  ['↑', 'ArrowUp'],
  ['↓', 'ArrowDown'],
  ['←', 'ArrowLeft'],
  ['→', 'ArrowRight'],
  ['Del', 'Delete'],
  ['Mouse Button 4', 'MouseButton4'],
  ['Mouse Button 5', 'MouseButton5'],
];

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

export function getAllTranslations(key: string): string[] {
  const translations: string[] = [];

  for (const locale of Object.keys(messages)) {
    const localeMessages = messages[locale as keyof typeof messages];
    const value = getNestedValue(localeMessages as Record<string, unknown>, key);

    if (value) {
      translations.push(value.toLowerCase());
    }
  }

  return translations;
}

export function normalizeSettingsSearchTerm(searchTerm: string): string {
  return searchTerm.trim().toLowerCase();
}

export function matchesAnyLocale(key: string, searchTerm: string): boolean {
  const normalizedSearch = normalizeSettingsSearchTerm(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  return getAllTranslations(key).some(translation => translation.includes(normalizedSearch));
}

function applyShortcutModifierAliases(value: string): string {
  return value
    .replaceAll('commandorcontrol', 'ctrl')
    .replaceAll('control', 'ctrl')
    .replaceAll('windows', 'win')
    .replaceAll('command', 'win')
    .replaceAll('super', 'win')
    .replaceAll('meta', 'win')
    .replaceAll('cmd', 'win');
}

function normalizeShortcutCombinationText(value: string): string {
  const compact = value
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/(?<=[\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, '+');

  return applyShortcutModifierAliases(compact);
}

function splitShortcutComboParts(normalizedCombo: string): string[] {
  const parts: string[] = [];
  let currentPart = '';

  for (const character of normalizedCombo) {
    if (character === '+') {
      if (currentPart) {
        parts.push(currentPart);
        currentPart = '';
      }
      else {
        parts.push('+');
      }
    }
    else {
      currentPart += character;
    }
  }

  if (currentPart) {
    parts.push(currentPart);
  }

  return parts;
}

export function getShortcutCombinationSearchTexts(formattedLabel: string): string[] {
  if (!formattedLabel) {
    return [];
  }

  const texts = [formattedLabel];

  for (const [displayToken, alias] of SHORTCUT_DISPLAY_ALIASES) {
    if (formattedLabel.includes(displayToken)) {
      texts.push(formattedLabel.replaceAll(displayToken, alias));
    }
  }

  return texts;
}

function isShortcutPartMatch(comboPart: string, queryPart: string): boolean {
  if (comboPart === queryPart) {
    return true;
  }

  return queryPart.length >= 2 && comboPart.startsWith(queryPart);
}

function matchesNormalizedShortcutCombination(formattedKeys: string, searchTerm: string): boolean {
  if (!formattedKeys) {
    return false;
  }

  const normalizedQuery = normalizeShortcutCombinationText(normalizeSettingsSearchTerm(searchTerm));

  if (!normalizedQuery) {
    return false;
  }

  const normalizedCombo = normalizeShortcutCombinationText(formattedKeys);

  if (normalizedCombo === normalizedQuery) {
    return true;
  }

  const compactCombo = normalizedCombo.replaceAll('+', '');
  const compactQuery = normalizedQuery.replaceAll('+', '');

  if (normalizedQuery.includes('+') && compactQuery.length > 0 && normalizedCombo.includes(normalizedQuery)) {
    return true;
  }

  if (!normalizedQuery.includes('+') && compactQuery.length >= 3 && compactCombo.includes(compactQuery)) {
    return true;
  }

  const queryParts = splitShortcutComboParts(normalizedQuery);
  const comboParts = splitShortcutComboParts(normalizedCombo);

  if (queryParts.length === 0 || comboParts.length === 0) {
    return false;
  }

  if (queryParts.length > 1) {
    return queryParts.every(queryPart =>
      comboParts.some(comboPart => isShortcutPartMatch(comboPart, queryPart)),
    );
  }

  const [singlePart] = queryParts;
  const mainKey = comboParts[comboParts.length - 1];

  if (singlePart.length >= 3) {
    return comboParts.some(comboPart => isShortcutPartMatch(comboPart, singlePart) || comboPart.includes(singlePart));
  }

  return comboParts.some(comboPart => comboPart === singlePart)
    || (singlePart.length >= 2 && mainKey.includes(singlePart));
}

export function matchesShortcutCombination(formattedKeys: string, searchTerm: string): boolean {
  return getShortcutCombinationSearchTexts(formattedKeys).some(combinationText =>
    matchesNormalizedShortcutCombination(combinationText, searchTerm),
  );
}

export function shortcutSearchItemMatches(
  item: SettingsShortcutSearchItem,
  searchTerm: string,
): boolean {
  const normalizedSearch = normalizeSettingsSearchTerm(searchTerm);

  if (!normalizedSearch) {
    return true;
  }

  if (item.labelKey && matchesAnyLocale(item.labelKey, normalizedSearch)) {
    return true;
  }

  if (item.titles?.some(title => title.toLowerCase().includes(normalizedSearch))) {
    return true;
  }

  return item.combinations.some(combination =>
    matchesShortcutCombination(combination, normalizedSearch),
  );
}

export function filterItemsForSettingsSearch<T>(
  items: T[],
  searchTerm: string,
  itemMatches: (item: T) => boolean,
  sectionKeys: readonly string[] = SHORTCUTS_SECTION_SEARCH_KEYS,
): T[] {
  const normalizedSearch = normalizeSettingsSearchTerm(searchTerm);

  if (!normalizedSearch) {
    return items;
  }

  const matchingItems = items.filter(itemMatches);

  if (matchingItems.length > 0) {
    return matchingItems;
  }

  const sectionMatches = sectionKeys.some(key => matchesAnyLocale(key, normalizedSearch));
  return sectionMatches ? items : matchingItems;
}

export function filterSettingsSections<T extends SettingsSectionSearchFields>(
  sections: T[],
  searchTerm: string,
  currentTab: string,
  extraSectionMatchers: Partial<Record<string, (normalizedSearch: string) => boolean>> = {},
): T[] {
  const normalizedSearch = normalizeSettingsSearchTerm(searchTerm);

  if (!normalizedSearch) {
    return sections.filter(section => section.category === currentTab);
  }

  return sections.filter((section) => {
    if (matchesAnyLocale(section.titleKey, normalizedSearch)) {
      return true;
    }

    if (matchesAnyLocale(section.tags, normalizedSearch)) {
      return true;
    }

    return extraSectionMatchers[section.key]?.(normalizedSearch) ?? false;
  });
}
