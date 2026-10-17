// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { Tab, TabGroup } from '@/types/workspaces';
import { swapTabGroupPaths } from '../swap-split-pane-paths';

function makeTab(path: string, overrides: Partial<Tab> = {}): Tab {
  return {
    id: `id-${path}`,
    name: 'stale-name',
    path,
    type: 'directory',
    dirEntries: [],
    selectedDirEntries: [],
    filterQuery: '',
    ...overrides,
  } as Tab;
}

describe('swapTabGroupPaths', () => {
  it('exchanges the paths of the two panes', () => {
    const tabGroup: TabGroup = [makeTab('C:/left'), makeTab('D:/right')];

    expect(swapTabGroupPaths(tabGroup)).toBe(true);
    expect(tabGroup.map(tab => tab.path)).toEqual(['D:/right', 'C:/left']);
  });

  it('keeps each pane identity and only swaps the path', () => {
    const left = makeTab('C:/left');
    const right = makeTab('D:/right');
    const leftId = left.id;
    const rightId = right.id;

    swapTabGroupPaths([left, right]);

    // id 是面板身份（scroll 恢复、activeTab 判定都靠它），互换路径不该换身份。
    expect(left.id).toBe(leftId);
    expect(right.id).toBe(rightId);
  });

  it('renames each tab to match its new path', () => {
    const tabGroup: TabGroup = [makeTab('C:/photos/2026'), makeTab('D:/archive')];

    swapTabGroupPaths(tabGroup);

    expect(tabGroup[0].name).toBe('archive');
    expect(tabGroup[1].name).toBe('2026');
  });

  it('clears stale entries, selection and filter query on both panes', () => {
    const left = makeTab('C:/left', {
      dirEntries: [{ name: 'old.txt' }] as Tab['dirEntries'],
      selectedDirEntries: [{ name: 'old.txt' }] as Tab['selectedDirEntries'],
      filterQuery: 'old',
    });
    const right = makeTab('D:/right', {
      dirEntries: [{ name: 'other.txt' }] as Tab['dirEntries'],
      selectedDirEntries: [{ name: 'other.txt' }] as Tab['selectedDirEntries'],
      filterQuery: 'other',
    });

    swapTabGroupPaths([left, right]);

    for (const tab of [left, right]) {
      expect(tab.dirEntries).toEqual([]);
      expect(tab.selectedDirEntries).toEqual([]);
      expect(tab.filterQuery).toBe('');
    }
  });

  it('does nothing when both panes already show the same directory', () => {
    const tabGroup: TabGroup = [makeTab('C:/same'), makeTab('C:/same')];

    expect(swapTabGroupPaths(tabGroup)).toBe(false);
    expect(tabGroup.map(tab => tab.path)).toEqual(['C:/same', 'C:/same']);
  });

  it('does not clear per-pane state when the swap is refused', () => {
    const left = makeTab('C:/same', { filterQuery: 'keep-me' });
    const right = makeTab('C:/same', { filterQuery: 'keep-me-too' });

    expect(swapTabGroupPaths([left, right])).toBe(false);
    expect(left.filterQuery).toBe('keep-me');
    expect(right.filterQuery).toBe('keep-me-too');
  });

  it('refuses a single-pane group and leaves it untouched', () => {
    const tabGroup: TabGroup = [makeTab('C:/only')];

    expect(swapTabGroupPaths(tabGroup)).toBe(false);
    expect(tabGroup[0].path).toBe('C:/only');
  });

  it('refuses a missing tab group without throwing', () => {
    expect(swapTabGroupPaths(null)).toBe(false);
    expect(swapTabGroupPaths(undefined)).toBe(false);
  });

  it('is its own inverse when applied twice', () => {
    const tabGroup: TabGroup = [makeTab('C:/left'), makeTab('D:/right')];
    const before = tabGroup.map(tab => tab.path);

    swapTabGroupPaths(tabGroup);
    swapTabGroupPaths(tabGroup);

    expect(tabGroup.map(tab => tab.path)).toEqual(before);
  });
});
