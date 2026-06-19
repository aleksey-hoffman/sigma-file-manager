// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Component } from 'vue';
import { HardDriveIcon, NetworkIcon, UsbIcon } from '@lucide/vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import type { DirEntry } from '@/types/dir-entry';
import type { DriveEntryMetadata, DriveInfo } from '@/types/drive-info';

export function createDriveEntryMetadata(drive: DriveInfo): DriveEntryMetadata {
  return {
    drive_type: drive.drive_type,
    is_removable: drive.is_removable,
  };
}

export function getDriveIconComponent(metadata: DriveEntryMetadata): Component {
  if (metadata.drive_type === 'WSL') {
    return UbuntuWslIcon;
  }

  if (metadata.drive_type === 'Network') {
    return NetworkIcon;
  }

  if (metadata.is_removable) {
    return UsbIcon;
  }

  return HardDriveIcon;
}

export function getDriveEntryVolumeSizeBytes(entry: DirEntry): number | null {
  if (!entry.drive_metadata || entry.size <= 0) {
    return null;
  }

  return entry.size;
}
