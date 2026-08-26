// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface ListDropResult {
  removedIndex: number | null;
  addedIndex: number | null;
  payload: unknown;
}

export function applyDropResult<T>(items: T[], dropResult: ListDropResult): T[] {
  const { removedIndex, addedIndex, payload } = dropResult;

  if (removedIndex === null && addedIndex === null) {
    return items;
  }

  const result = [...items];
  let itemToAdd = payload as T;

  if (removedIndex !== null) {
    const [removedItem] = result.splice(removedIndex, 1);
    itemToAdd = removedItem;
  }

  if (addedIndex !== null) {
    result.splice(addedIndex, 0, itemToAdd);
  }

  return result;
}

export function haveSameKeys<T>(
  currentItems: T[],
  nextItems: T[],
  getKey: (item: T) => string,
): boolean {
  if (currentItems.length !== nextItems.length) {
    return false;
  }

  const currentKeys = currentItems.map(getKey).slice().sort();
  const nextKeys = nextItems.map(getKey).slice().sort();

  return currentKeys.every((key, index) => key === nextKeys[index]);
}

export function haveSameKeyOrder<T>(
  currentItems: T[],
  nextItems: T[],
  getKey: (item: T) => string,
): boolean {
  return currentItems.length === nextItems.length
    && currentItems.every((item, index) => getKey(item) === getKey(nextItems[index]));
}

export function reorderMatchingItems<T>(
  source: T[],
  nextSubset: T[],
  getKey: (item: T) => string,
): T[] {
  const subsetKeys = new Set(nextSubset.map(getKey));
  const queue = [...nextSubset];

  return source.map((item) => {
    if (!subsetKeys.has(getKey(item))) {
      return item;
    }

    return queue.shift() ?? item;
  });
}
