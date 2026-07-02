// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';

export type BoxSelectionMode = 'replace' | 'append' | 'invert';

export function resolveBoxSelectionModeFromPointerEvent(
  event: Pick<PointerEvent, 'altKey' | 'ctrlKey' | 'metaKey' | 'shiftKey'>,
): BoxSelectionMode {
  if (event.altKey) {
    return 'invert';
  }

  if (event.ctrlKey || event.metaKey || event.shiftKey) {
    return 'append';
  }

  return 'replace';
}

export function mergeBoxSelection(
  baseEntries: readonly DirEntry[],
  boxEntries: readonly DirEntry[],
): DirEntry[] {
  const mergedPaths = new Set(baseEntries.map(entry => entry.path));
  const mergedEntries = [...baseEntries];

  for (const entry of boxEntries) {
    if (mergedPaths.has(entry.path)) {
      continue;
    }

    mergedPaths.add(entry.path);
    mergedEntries.push(entry);
  }

  return mergedEntries;
}

export function invertBoxSelection(
  baseEntries: readonly DirEntry[],
  boxEntries: readonly DirEntry[],
): DirEntry[] {
  const basePaths = new Set(baseEntries.map(entry => entry.path));
  const boxPaths = new Set(boxEntries.map(entry => entry.path));
  const keptOutsideBox = baseEntries.filter(entry => !boxPaths.has(entry.path));
  const addedFromBox = boxEntries.filter(entry => !basePaths.has(entry.path));

  return [...keptOutsideBox, ...addedFromBox];
}

export function applyBoxSelectionMode(
  baseEntries: readonly DirEntry[],
  boxEntries: readonly DirEntry[],
  mode: BoxSelectionMode,
): DirEntry[] {
  switch (mode) {
    case 'replace':
      return [...boxEntries];
    case 'append':
      return mergeBoxSelection(baseEntries, boxEntries);
    case 'invert':
      return invertBoxSelection(baseEntries, boxEntries);

    default: {
      const exhaustiveCheck: never = mode;
      return exhaustiveCheck;
    }
  }
}

export function shouldClearSelectionOnBoxPointerUp(
  hadActiveBox: boolean,
  mode: BoxSelectionMode,
  button: number,
): boolean {
  return !hadActiveBox && mode === 'replace' && button === 0;
}

export function shouldPreserveBaseSelectionForBoxMode(mode: BoxSelectionMode): boolean {
  return mode === 'append' || mode === 'invert';
}
