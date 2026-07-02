// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export type BinaryPathValidationResult = 'valid' | 'invalid' | 'pending';

export async function validateBinaryPath(pathValue: string): Promise<boolean> {
  const trimmedPath = pathValue.trim();

  if (!trimmedPath) {
    return false;
  }

  try {
    return await invoke<boolean>('path_is_regular_file', { path: trimmedPath });
  }
  catch {
    return false;
  }
}

export async function validateBinaryPaths(paths: string[]): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>();

  await Promise.all(paths.map(async (pathValue) => {
    const isValid = await validateBinaryPath(pathValue);
    results.set(pathValue, isValid);
  }));

  return results;
}
