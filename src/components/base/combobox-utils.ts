// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type ComboboxHighlightPayload = {
  ref: HTMLElement;
  value: unknown;
} | undefined;

export function getComboboxHighlightedOptionValue<T extends string>(
  payload: ComboboxHighlightPayload,
): T | null {
  const highlighted = payload?.value;

  if (
    highlighted
    && typeof highlighted === 'object'
    && 'value' in highlighted
    && typeof highlighted.value === 'string'
  ) {
    return highlighted.value as T;
  }

  return null;
}
