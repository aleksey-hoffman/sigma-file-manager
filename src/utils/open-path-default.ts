// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export interface OpenPathDefaultResult {
  success: boolean;
  error?: string | null;
}

export async function openPathDefault(filePath: string): Promise<void> {
  const result = await invoke<OpenPathDefaultResult>('open_with_default', {
    filePath,
  });

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to open path');
  }
}
