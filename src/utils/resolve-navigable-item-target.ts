// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export interface NavigableItemTarget {
  targetPath: string;
  opensAsFile: boolean;
}

export async function resolveWindowsDirectoryShortcutPath(path: string): Promise<string | null> {
  try {
    return await invoke<string | null>('resolve_windows_directory_shortcut', { path });
  }
  catch (error) {
    console.error('Failed to resolve Windows directory shortcut:', error);
    return null;
  }
}

export async function resolveNavigableItemTarget(
  path: string,
  isFile: boolean,
): Promise<NavigableItemTarget> {
  if (!isFile) {
    return {
      targetPath: path,
      opensAsFile: false,
    };
  }

  if (!path.toLowerCase().endsWith('.lnk')) {
    return {
      targetPath: path,
      opensAsFile: true,
    };
  }

  const resolvedDirectoryShortcutPath = await resolveWindowsDirectoryShortcutPath(path);

  if (resolvedDirectoryShortcutPath) {
    return {
      targetPath: resolvedDirectoryShortcutPath,
      opensAsFile: false,
    };
  }

  return {
    targetPath: path,
    opensAsFile: true,
  };
}
