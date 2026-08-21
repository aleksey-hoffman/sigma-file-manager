// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  filterItemsForSettingsSearch,
  filterSettingsSections,
  matchesAnyLocale,
  matchesShortcutCombination,
  shortcutSearchItemMatches,
} from '@/modules/settings/utils/settings-search';

describe('settings search', () => {
  it('matches setting titles in any locale', () => {
    expect(matchesAnyLocale('shortcuts.setSelectedItemsForCopying', 'copy')).toBe(true);
    expect(matchesAnyLocale('shortcuts.setSelectedItemsForCopying', 'копирован')).toBe(true);
    expect(matchesAnyLocale('shortcuts.focusAppWindow', 'показать окно')).toBe(true);
    expect(matchesAnyLocale('shortcuts.focusAppWindow', 'theme')).toBe(false);
  });

  it('matches shortcut combinations with partial and alternate spellings', () => {
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl+c')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl + c')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl-c')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'control+c')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrlc')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl+')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+Shift+N', 'ctrl+sh')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+Shift+N', 'ctrl shift n')).toBe(true);
    expect(matchesShortcutCombination('Win+Shift+E', 'super+shift')).toBe(true);
    expect(matchesShortcutCombination('Win+Shift+E', 'cmd+shift+e')).toBe(true);
    expect(matchesShortcutCombination('Meta+K', 'win+k')).toBe(true);
    expect(matchesShortcutCombination('F5', 'f5')).toBe(true);
    expect(matchesShortcutCombination('Del', 'delete')).toBe(true);
    expect(matchesShortcutCombination('Alt+↑', 'arrowup')).toBe(true);
    expect(matchesShortcutCombination('Alt+↑', 'up')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'c')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl+v')).toBe(false);
    expect(matchesShortcutCombination('Ctrl+A', 'c')).toBe(false);
    expect(matchesShortcutCombination('Ctrl+C', '+')).toBe(false);
    expect(matchesShortcutCombination('Ctrl+C', '-')).toBe(false);
    expect(matchesShortcutCombination('Ctrl+-', '-')).toBe(true);
    expect(matchesShortcutCombination('Ctrl++', '+')).toBe(true);
    expect(matchesShortcutCombination('Ctrl++', 'ctrl++')).toBe(true);
    expect(matchesShortcutCombination('Ctrl+C', 'ctrl++')).toBe(false);
    expect(matchesShortcutCombination('', 'ctrl')).toBe(false);
  });

  it('matches shortcut search items by locale title or combination', () => {
    expect(shortcutSearchItemMatches({
      labelKey: 'shortcuts.setSelectedItemsForCopying',
      combinations: ['Ctrl+C'],
    }, 'копирован')).toBe(true);

    expect(shortcutSearchItemMatches({
      labelKey: 'shortcuts.setSelectedItemsForCopying',
      combinations: ['Ctrl+C'],
    }, 'ctrl+c')).toBe(true);

    expect(shortcutSearchItemMatches({
      titles: ['Convert video'],
      combinations: ['Alt+Shift+V'],
    }, 'convert')).toBe(true);

    expect(shortcutSearchItemMatches({
      labelKey: 'shortcuts.setSelectedItemsForCopying',
      combinations: ['Ctrl+C'],
    }, 'theme')).toBe(false);
  });

  it('shows the shortcuts section for title, tag, or matching shortcut data', () => {
    const sections = [
      {
        key: 'theme',
        titleKey: 'settings.homeBannerEffects.theme.title',
        tags: 'settingsTags.theme',
        category: 'appearance',
      },
      {
        key: 'shortcuts',
        titleKey: 'settingsTabs.shortcuts',
        tags: 'settingsTags.shortcuts',
        category: 'shortcuts',
      },
    ];

    expect(filterSettingsSections(sections, '', 'appearance').map(section => section.key)).toEqual(['theme']);
    expect(filterSettingsSections(sections, 'shortcuts', 'appearance').map(section => section.key)).toEqual(['shortcuts']);
    expect(filterSettingsSections(sections, 'шорткаты', 'appearance').map(section => section.key)).toEqual(['shortcuts']);
    expect(filterSettingsSections(sections, 'ctrl+c', 'appearance', {
      shortcuts: () => true,
    }).map(section => section.key)).toEqual(['shortcuts']);
    expect(filterSettingsSections(sections, 'ctrl+c', 'appearance', {
      shortcuts: () => false,
    })).toEqual([]);
  });

  it('filters shortcut rows unless the query matches the shortcuts section itself', () => {
    const rows = [
      {
        id: 'copy',
        labelKey: 'shortcuts.setSelectedItemsForCopying',
        combo: 'Ctrl+C',
      },
      {
        id: 'paste',
        labelKey: 'shortcuts.transferPreparedForCopying',
        combo: 'Ctrl+V',
      },
      {
        id: 'rename',
        labelKey: 'shortcuts.renameSelectedItems',
        combo: 'F2',
      },
    ];

    const matchingCopy = filterItemsForSettingsSearch(
      rows,
      'ctrl+c',
      row => shortcutSearchItemMatches({
        labelKey: row.labelKey,
        combinations: [row.combo],
      }, 'ctrl+c'),
    );

    expect(matchingCopy.map(row => row.id)).toEqual(['copy']);

    const matchingSection = filterItemsForSettingsSearch(
      rows,
      'shortcuts',
      row => shortcutSearchItemMatches({
        labelKey: row.labelKey,
        combinations: [row.combo],
      }, 'shortcuts'),
    );

    expect(matchingSection.map(row => row.id)).toEqual(['copy', 'paste', 'rename']);
  });
});
