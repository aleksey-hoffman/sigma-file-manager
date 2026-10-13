// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { Component } from 'vue';
import { HardDriveIcon, NetworkIcon, UsbIcon } from '@lucide/vue';
import UbuntuWslIcon from '@/components/icons/ubuntu-wsl-icon.vue';
import type { DirEntry } from '@/types/dir-entry';
import type { DriveEntryMetadata, DriveInfo } from '@/types/drive-info';

// FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 视图按盘符序号排序
// (C → D → E → F ...)。取 path 的第一个字母(A-Z)换算成序号,
// 非盘符路径(WSL `//wsl.localhost/...` / UNC `//server/share`)返回 0,排到盘符之后。
export function getDriveLetterIndex(path: string): number {
  const match = /^([A-Za-z]):/.exec(path.trim());
  if (!match) return 0;
  return match[1].toUpperCase().charCodeAt(0) - 64; // 'A' -> 1
}

export function createDriveEntryMetadata(drive: DriveInfo): DriveEntryMetadata {
  return {
    drive_type: drive.drive_type,
    is_removable: drive.is_removable,
    is_mounted: drive.is_mounted,
    mount_point: drive.mount_point,
    device_path: drive.device_path,
    // FORK-MODIFICATION: 验收反馈 2026-10-13 — 见 DriveEntryMetadata 的字段说明。
    available_space: drive.available_space,
    drive_letter_index: getDriveLetterIndex(drive.path),
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

// FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 视图卡片要显示"磁盘空余空间"
// 而不是"X 项 · 总容量"。返回值语义与 getDriveEntryVolumeSizeBytes 一致（null = 不是磁盘）。
export function getDriveEntryAvailableSpaceBytes(entry: DirEntry): number | null {
  if (!entry.drive_metadata) {
    return null;
  }

  if (typeof entry.drive_metadata.available_space === 'number'
    && entry.drive_metadata.available_space >= 0) {
    return entry.drive_metadata.available_space;
  }

  // 老数据（没带 available_space）回落到 entry.size，保持原有显示。
  return entry.size > 0 ? entry.size : null;
}
