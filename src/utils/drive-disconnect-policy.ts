// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';
import type { DriveEntryMetadata } from '@/types/drive-info';

export type DisconnectDriveTarget = {
  devicePath: string;
  mountPoint: string;
  driveType: string;
};

export type DisconnectDriveResult = {
  success: boolean;
  error?: string;
};

export function canDisconnectDriveMetadata(
  metadata: DriveEntryMetadata,
  platform: string | null,
): boolean {
  if (!metadata.is_mounted) {
    return false;
  }

  if (metadata.drive_type === 'Network') {
    return true;
  }

  if (metadata.drive_type === 'WSL') {
    return false;
  }

  if (platform === 'windows') {
    return false;
  }

  return metadata.is_removable;
}

export function canDisconnectDriveEntry(
  entry: DirEntry,
  platform: string | null,
): boolean {
  if (!entry.is_dir) {
    return false;
  }

  return entry.drive_metadata
    ? canDisconnectDriveMetadata(entry.drive_metadata, platform)
    : false;
}

export function getDisconnectDriveTarget(entry: DirEntry): DisconnectDriveTarget | null {
  const metadata = entry.drive_metadata;

  if (!metadata) {
    return null;
  }

  return {
    devicePath: metadata.device_path,
    mountPoint: metadata.mount_point,
    driveType: metadata.drive_type,
  };
}
