// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export async function isDefaultFileManager(): Promise<boolean> {
  return await invoke<boolean>('is_default_file_manager');
}

export async function setDefaultFileManager(enabled: boolean): Promise<boolean> {
  return await invoke<boolean>('set_default_file_manager', { enabled });
}
