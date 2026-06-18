// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export type CopyMoveOperationType = 'copy' | 'move';

export type CopyMoveJobOutcome = {
  success: boolean;
  copiedCount: number;
  cancelled: boolean;
  sourcePathIsDir: boolean[];
};

export async function resolveSourcePathIsDir(sourcePaths: string[]): Promise<boolean[]> {
  try {
    return await invoke<boolean[]>('paths_are_directories', {
      paths: sourcePaths,
    });
  }
  catch {
    return sourcePaths.map(() => true);
  }
}
