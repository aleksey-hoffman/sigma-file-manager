// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import normalizePath, {
  getParentPath,
  getPathLeafName,
  isWindowsDriveRootPath,
} from '@/utils/normalize-path';

export const ALWAYS_HIDDEN_WINDOWS_DRIVE_ROOT_ENTRY_NAMES = new Set([
  '$recycle.bin',
  'config.msi',
  'system volume information',
  'onedrivetemp',
  'recovery',
  'hiberfil.sys',
  'pagefile.sys',
  'swapfile.sys',
  'dumpstack.log.tmp',
  'documents and settings',
]);

export function isAlwaysHiddenWindowsSystemEntry(path: string, entryName?: string): boolean {
  const normalizedPath = normalizePath(path);
  const parentPath = getParentPath(normalizedPath);

  if (!parentPath || !isWindowsDriveRootPath(parentPath)) {
    return false;
  }

  const name = (entryName ?? getPathLeafName(normalizedPath)).toLowerCase();

  return ALWAYS_HIDDEN_WINDOWS_DRIVE_ROOT_ENTRY_NAMES.has(name);
}
