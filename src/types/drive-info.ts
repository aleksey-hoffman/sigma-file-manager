// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type DriveInfo = {
  name: string;
  path: string;
  mount_point: string;
  file_system: string;
  drive_type: string;
  total_space: number;
  available_space: number;
  used_space: number;
  percent_used: number;
  is_removable: boolean;
  is_read_only: boolean;
  is_mounted: boolean;
  device_path: string;
};

export type DriveEntryMetadata = {
  drive_type: string;
  is_removable: boolean;
  is_mounted: boolean;
  mount_point: string;
  device_path: string;
  // FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 视图要显示"磁盘空余空间"。
  // DirEntry.size 已经被 driveInfoToDirEntry 占用为 total_space(排序 / 列宽用),
  // 这里补一个 available_space 让 UI 能单独显示余量。缺失时 UI 回落到 size。
  available_space?: number;
  // 盘符序号(C=1 / D=2 ...),供"按盘符排序"用;非盘符路径(WSL / 网络)为 null。
  // 0 表示"不是盘符" —— 排序时统一排到盘符后面。
  drive_letter_index?: number;
};

export type MountableDevice = {
  name: string;
  device_path: string;
  file_system: string;
  size: number;
};
