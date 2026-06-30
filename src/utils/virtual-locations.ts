// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { DirContents, DirEntry, ReadDirOptions } from '@/types/dir-entry';
import type { DriveEntryMetadata, DriveInfo } from '@/types/drive-info';
import normalizePath, {
  getParentPath,
  getPathDisplayName,
} from '@/utils/normalize-path';
import { isProtectedSystemPath } from '@/utils/is-protected-system-path';
import {
  isUnderUnixSystemMount,
  isWindowsLocationsScopePath,
} from '@/utils/system-mount-roots';
import {
  isVirtualLocationPath,
  LOCATIONS_VIRTUAL_PATH,
} from '@/utils/virtual-path-constants';
import { createDriveEntryMetadata } from '@/utils/drive-icon';

export { isVirtualLocationPath, LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

export function virtualLocationPathExists(path: string): boolean {
  return isVirtualLocationPath(path);
}

export function getVirtualLocationDisplayName(path: string, translate: (key: string) => string): string | null {
  if (!isVirtualLocationPath(path)) {
    return null;
  }

  return translate('locations');
}

export function driveInfoToDirEntry(drive: DriveInfo): DirEntry {
  const normalizedPath = normalizePath(drive.path);
  const displayName = drive.name.trim() || getPathDisplayName(normalizedPath) || normalizedPath;

  return {
    name: displayName,
    path: normalizedPath,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: drive.total_space,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
    drive_metadata: createDriveEntryMetadata(drive),
  };
}

export function createLocationsDirEntry(): DirEntry {
  return {
    name: '',
    path: LOCATIONS_VIRTUAL_PATH,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
  };
}

export function buildLocationsDirectoryFromDrives(drives: DriveInfo[]): DirContents {
  const entries = drives.map(drive => driveInfoToDirEntry(drive));
  const directoryCount = entries.length;

  return {
    path: LOCATIONS_VIRTUAL_PATH,
    entries,
    total_count: directoryCount,
    dir_count: directoryCount,
    file_count: 0,
    opened_directory_times: {
      modified_time: 0,
      accessed_time: 0,
      created_time: 0,
    },
  };
}

function formatLocationsDriveDisplaySignaturePart(
  path: string,
  name: string,
  size: number,
  driveMetadata: DriveEntryMetadata | undefined,
): string {
  return [
    normalizePath(path),
    name,
    String(size),
    driveMetadata?.drive_type ?? '',
    driveMetadata?.is_removable ? '1' : '0',
  ].join('\x1f');
}

export function getLocationsDriveListDisplaySignature(drives: DriveInfo[]): string {
  return drives
    .map((drive) => {
      const entry = driveInfoToDirEntry(drive);
      return formatLocationsDriveDisplaySignaturePart(
        entry.path,
        entry.name,
        entry.size,
        entry.drive_metadata,
      );
    })
    .sort()
    .join('\0');
}

export function getLocationsEntriesDisplaySignature(entries: DirEntry[]): string {
  return entries
    .map(entry => formatLocationsDriveDisplaySignaturePart(
      entry.path,
      entry.name,
      entry.size,
      entry.drive_metadata,
    ))
    .sort()
    .join('\0');
}

export async function readLocationsDirectory(): Promise<DirContents> {
  const drives = await invoke<DriveInfo[]>('get_system_drives');
  return buildLocationsDirectoryFromDrives(drives);
}

export async function resolveDirectoryContents(
  path: string,
  options?: ReadDirOptions,
): Promise<DirContents> {
  if (isVirtualLocationPath(path)) {
    return readLocationsDirectory();
  }

  return invoke<DirContents>('read_dir', {
    path,
    options,
  });
}

export async function resolveDirEntry(
  path: string,
  timeoutMs?: number,
): Promise<DirEntry | null> {
  if (isVirtualLocationPath(path)) {
    return createLocationsDirEntry();
  }

  try {
    return await invoke<DirEntry>('get_dir_entry_with_timeout', {
      path,
      timeoutMs,
    });
  }
  catch {
    return null;
  }
}

export async function getLocationsDrivePaths(): Promise<string[]> {
  const contents = await readLocationsDirectory();
  return contents.entries.map(entry => entry.path);
}

export function getNavigableParentPath(path: string, platform: string | null): string | null {
  const normalizedPath = normalizePath(path);

  if (isVirtualLocationPath(normalizedPath)) {
    return null;
  }

  const pathWithoutTrailingSlash = normalizedPath.replace(/\/+$/, '');

  if (isProtectedSystemPath(pathWithoutTrailingSlash, platform)) {
    return LOCATIONS_VIRTUAL_PATH;
  }

  return getParentPath(normalizedPath);
}

export function shouldPrependLocationsCrumb(path: string, platform: string | null): boolean {
  const normalizedPath = normalizePath(path);

  if (isVirtualLocationPath(normalizedPath)) {
    return true;
  }

  if (platform === 'windows') {
    return isWindowsLocationsScopePath(normalizedPath);
  }

  return isUnderUnixSystemMount(normalizedPath);
}
