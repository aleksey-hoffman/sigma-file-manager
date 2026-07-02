// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function shouldPreserveModalValues(options?: { preserveValues?: boolean }): boolean {
  return options?.preserveValues !== false;
}

export function mergeModalFormValues<T extends Record<string, unknown>>(
  nextValues: T,
  currentValues: Record<string, unknown>,
  preserveValues: boolean,
): T {
  if (!preserveValues) {
    return nextValues;
  }

  const mergedValues = { ...nextValues };

  for (const key of Object.keys(mergedValues)) {
    if (key in currentValues) {
      mergedValues[key] = currentValues[key];
    }
  }

  return mergedValues;
}
