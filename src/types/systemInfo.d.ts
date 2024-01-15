// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export interface SystemStats {
  name: string;
  long_os_version: string;
  host_name: string;
  kernel_version: string;
  os_version: string;
}

export interface CpuStats {
  cpu_brand: string;
  cpu_threads: number;
}

export interface StorageStats {
  type: string;
  name: string;
  file_system: string;
  mount_point: string;
  s_mount_point: string;
  total_space: number;
  available_space: number;
  used_space: number;
  is_removable: boolean;
}

export interface MemoryStats {
  total_space: number;
  available_space: number;
  used_space: number;
}