// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { DirEntry } from '@/types/dir-entry';

interface OpenWithResult {
  success: boolean;
  error: string | null;
}

export async function openNativeProperties(entries: DirEntry[]): Promise<OpenWithResult> {
  const filePaths = entries.map(entry => entry.path);

  return invoke<OpenWithResult>('open_native_properties', { filePaths });
}
