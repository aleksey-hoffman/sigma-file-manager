// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface SystemStats {
  name: string;
  long_os_version: string;
  host_name: string;
  kernel_version: string;
  os_version: string;
  total_memory: number;
  available_memory: number;
  used_memory: number;
}

export interface StorageStats {
  kind: string;
  name: string;
  file_system: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  used_space: number;
  is_removable: boolean;
}
