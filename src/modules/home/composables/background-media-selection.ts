// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type MediaSelectionState = {
  mediaId?: string;
  index?: number;
};

export type MediaSelectionOptionValue = {
  value: string;
};

export type ResolveMediaSelectionOptions<TOption extends MediaSelectionOptionValue> = {
  defaultMediaId: string;
  resolveMediaIdFromIndex?: (index: number, options: TOption[]) => string | null;
};

export function getMediaIdFromSelection<TOption extends MediaSelectionOptionValue>(
  selection: MediaSelectionState,
  options: ResolveMediaSelectionOptions<TOption>,
  optionList: TOption[],
): string {
  if (typeof selection.mediaId === 'string' && selection.mediaId.trim()) {
    return selection.mediaId;
  }

  const selectionIndex = typeof selection.index === 'number' ? selection.index : -1;

  if (selectionIndex >= 0) {
    const mediaId = options.resolveMediaIdFromIndex
      ? options.resolveMediaIdFromIndex(selectionIndex, optionList)
      : optionList[selectionIndex]?.value;

    if (typeof mediaId === 'string' && mediaId.trim()) {
      return mediaId;
    }
  }

  return options.defaultMediaId;
}

export function resolveMediaSelectionIndex<TOption extends MediaSelectionOptionValue>(
  selection: MediaSelectionState,
  options: ResolveMediaSelectionOptions<TOption>,
  optionList: TOption[],
): number {
  if (optionList.length === 0) {
    return 0;
  }

  const targetMediaId = getMediaIdFromSelection(selection, options, optionList);
  const selectionIndex = typeof selection.index === 'number' ? selection.index : -1;

  if (selectionIndex >= 0 && selectionIndex < optionList.length) {
    const optionAtIndex = optionList[selectionIndex];

    if (optionAtIndex && optionAtIndex.value === targetMediaId) {
      return selectionIndex;
    }
  }

  const foundIndex = optionList.findIndex(option => option.value === targetMediaId);

  if (foundIndex >= 0) {
    return foundIndex;
  }

  const defaultIndex = optionList.findIndex(option => option.value === options.defaultMediaId);

  return defaultIndex >= 0 ? defaultIndex : 0;
}

export function resolveOffsetMediaSelectionIndex<TOption extends MediaSelectionOptionValue>(
  selection: MediaSelectionState,
  offset: number,
  options: ResolveMediaSelectionOptions<TOption>,
  optionList: TOption[],
): number {
  if (optionList.length === 0) {
    return 0;
  }

  const currentSelectionIndex = resolveMediaSelectionIndex(selection, options, optionList);

  return ((currentSelectionIndex + offset) % optionList.length + optionList.length) % optionList.length;
}
