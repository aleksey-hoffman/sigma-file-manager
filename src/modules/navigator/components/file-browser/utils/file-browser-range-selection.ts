// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import { mergeBoxSelection } from './file-browser-box-selection-policy';

export function getEntriesInInclusiveRange(
  entries: readonly DirEntry[],
  fromEntry: DirEntry,
  toEntry: DirEntry,
): DirEntry[] {
  let startIndex = entries.findIndex(item => item.path === fromEntry.path);
  let endIndex = entries.findIndex(item => item.path === toEntry.path);

  if (startIndex === -1 || endIndex === -1) {
    return [];
  }

  if (startIndex > endIndex) {
    [startIndex, endIndex] = [endIndex, startIndex];
  }

  return entries.slice(startIndex, endIndex + 1);
}

export function applyRangeSelection(
  currentSelection: readonly DirEntry[],
  rangeEntries: readonly DirEntry[],
  additive: boolean,
): DirEntry[] {
  if (!additive) {
    return [...rangeEntries];
  }

  return mergeBoxSelection(currentSelection, rangeEntries);
}
