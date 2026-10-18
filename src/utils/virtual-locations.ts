// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { DirContents, DirEntry, ReadDirOptions } from '@/types/dir-entry';
import type { DriveInfo } from '@/types/drive-info';
import normalizePath, {
  canonicalizePath,
  getParentPath,
  getPathDisplayName,
  isUncShareRootPath,
  isWslPath,
} from '@/utils/normalize-path';
import { isProtectedSystemPath } from '@/utils/is-protected-system-path';
import { getRemoteParentPath, isRemotePath } from '@/utils/remote-paths';
import { readRemoteDirectory, statRemoteEntry } from '@/utils/remote-directory';
import {
  isUnderUnixSystemMount,
  isWindowsLocationsScopePath,
} from '@/utils/system-mount-roots';
import {
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  isWslHostVirtualPath,
  LOCATIONS_VIRTUAL_PATH,
  WSL_HOST_VIRTUAL_PATH,
} from '@/utils/virtual-path-constants';
import { createDriveEntryMetadata } from '@/utils/drive-icon';

export {
  isVirtualDirectoryPath,
  isVirtualLocationPath,
  isWslHostVirtualPath,
  LOCATIONS_VIRTUAL_PATH,
  WSL_HOST_VIRTUAL_PATH,
} from '@/utils/virtual-path-constants';

export function virtualLocationPathExists(path: string): boolean {
  return isVirtualDirectoryPath(path);
}

export function getVirtualLocationDisplayName(path: string, translate: (key: string) => string): string | null {
  if (isVirtualLocationPath(path)) {
    return translate('locations');
  }

  if (isWslHostVirtualPath(path)) {
    return getPathDisplayName(WSL_HOST_VIRTUAL_PATH);
  }

  return null;
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

function createVirtualDirectoryEntry(path: string, name: string, itemCount: number | null = null): DirEntry {
  return {
    name,
    path,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: itemCount,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
  };
}

export function createLocationsDirEntry(): DirEntry {
  return createVirtualDirectoryEntry(LOCATIONS_VIRTUAL_PATH, '');
}

export function createWslHostDirEntry(distributionCount: number | null = null): DirEntry {
  return createVirtualDirectoryEntry(
    WSL_HOST_VIRTUAL_PATH,
    getPathDisplayName(WSL_HOST_VIRTUAL_PATH),
    distributionCount,
  );
}

export function isWslDistributionDrive(drive: DriveInfo): boolean {
  const normalizedPath = normalizePath(drive.path);
  return isWslPath(normalizedPath) && isUncShareRootPath(normalizedPath);
}

export function getWslDistributionDrives(drives: DriveInfo[]): DriveInfo[] {
  return drives.filter(drive => isWslDistributionDrive(drive));
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

function formatLocationsEntryDisplaySignature(entry: DirEntry): string {
  return [
    normalizePath(entry.path),
    entry.name,
    String(entry.size),
    entry.drive_metadata?.drive_type ?? '',
    entry.drive_metadata?.is_removable ? '1' : '0',
    entry.item_count === null ? '' : String(entry.item_count),
  ].join('\x1f');
}

export function getLocationsDriveListDisplaySignature(drives: DriveInfo[]): string {
  return buildLocationsDirectoryFromDrives(drives).entries
    .map(entry => formatLocationsEntryDisplaySignature(entry))
    .sort()
    .join('\0');
}

export function getLocationsEntriesDisplaySignature(entries: DirEntry[]): string {
  return entries
    .map(entry => formatLocationsEntryDisplaySignature(entry))
    .sort()
    .join('\0');
}

export async function readLocationsDirectory(): Promise<DirContents> {
  const drives = await invoke<DriveInfo[]>('get_system_drives');
  return buildLocationsDirectoryFromDrives(drives);
}

export function buildWslHostDirectoryFromDrives(drives: DriveInfo[]): DirContents {
  const entries = getWslDistributionDrives(drives).map(drive => driveInfoToDirEntry(drive));
  const directoryCount = entries.length;

  return {
    path: WSL_HOST_VIRTUAL_PATH,
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

export async function readWslHostDirectory(): Promise<DirContents> {
  const drives = await invoke<DriveInfo[]>('get_system_drives');
  return buildWslHostDirectoryFromDrives(drives);
}

export function buildVirtualDirectoryFromDrives(path: string, drives: DriveInfo[]): DirContents | null {
  if (isVirtualLocationPath(path)) {
    return buildLocationsDirectoryFromDrives(drives);
  }

  if (isWslHostVirtualPath(path)) {
    return buildWslHostDirectoryFromDrives(drives);
  }

  return null;
}

export async function resolveDirectoryContents(
  path: string,
  options?: ReadDirOptions,
): Promise<DirContents> {
  if (isVirtualLocationPath(path)) {
    return readLocationsDirectory();
  }

  if (isWslHostVirtualPath(path)) {
    return readWslHostDirectory();
  }

  // FORK-MODIFICATION 2026-10-18：远程分支（阶段 2 需求 1）。
  //
  // 改动前 `sfm://remote/...` 落到下面的本地 `read_dir`，Rust 拿它去 `fs::metadata`
  // 必然失败；导航器再把这个失败当「路径打不开」静默跳到默认目录 ——
  // 用户看到的就是「点远程连接，右栏变成 C:\Users\...」。这不是渲染问题，是一次静默兜底。
  //
  // `options` 刻意**不传**：它控制的是本地盘的快捷方式目标、硬链接计数与条目数统计，
  // 远程 provider 一个都给不出。把本地语义的开关塞给远程命令，
  // 只会让后端多出一堆「收到但必须忽略」的字段。
  if (isRemotePath(path)) {
    return readRemoteDirectory(path);
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

  if (isWslHostVirtualPath(path)) {
    return createWslHostDirEntry();
  }

  // 远程路径没有「本地 stat 超时」这回事 —— 超时是本地盘慢目录的缓解手段，
  // 远程的慢来自网络与服务器，塞一个本地阈值进去只会让人误以为它在防什么。
  if (isRemotePath(path)) {
    return statRemoteEntry(path);
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

  if (isWslHostVirtualPath(normalizedPath)) {
    return LOCATIONS_VIRTUAL_PATH;
  }

  // 远程分支必须排在 `canonicalizePath` 之前。canonicalizePath 会把尾斜杠剥掉、
  // 后续 getParentPath 只按字符串切分，于是 `sfm://remote` 的父级会变成 `sfm:/`，
  // 含 `..` 的路径会原样带出 `..` —— 两个都是用户从没去过的垃圾路径。
  if (isRemotePath(normalizedPath)) {
    // 非法远程路径（含 `.` / `..` 段）在这里返回 null，即「无处可上」。
    // 刻意不放行到本地解析：那等于凭空编造一个目录。阶段 1 的 command 会给出显式错误。
    return getRemoteParentPath(normalizedPath);
  }

  const canonicalPath = canonicalizePath(normalizedPath);

  if (platform === 'windows'
    && isWslPath(canonicalPath)
    && isUncShareRootPath(canonicalPath)) {
    return WSL_HOST_VIRTUAL_PATH;
  }

  if (isProtectedSystemPath(canonicalPath, platform)) {
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
