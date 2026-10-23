// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-23：移植自 upstream `3eca4c17`（仪表盘重设计）。
// 用途：仪表盘卡片在文件名旁边显示条目大小。
// 文件逐个 stat，目录取批量统计的结果；取不到一律显示「—」而不是 0 B，
// 因为「0」会被读成「这是个空文件/空目录」，那是错的信息。

import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

export const UNKNOWN_DASHBOARD_ITEM_SIZE = '—';

export interface DashboardDirectorySizeInfo {
  status: 'Complete' | 'Error' | 'Loading';
  size: number;
}

export function formatDashboardFileSize(size: number | null | undefined): string {
  // FORK-MODIFICATION：upstream 只判了 `typeof size !== 'number'`，
  // 于是 NaN 会一路走到 formatBytes 里变成字符串「NaN B」——
  // 界面上会出现一个谁也看不懂的大小。多加一道有限性判断。
  if (typeof size !== 'number' || !Number.isFinite(size)) {
    return UNKNOWN_DASHBOARD_ITEM_SIZE;
  }

  return formatBytes(size);
}

export function formatDashboardDirectorySize(
  sizeInfo: DashboardDirectorySizeInfo | undefined,
): string {
  if (!sizeInfo || sizeInfo.status !== 'Complete') {
    return UNKNOWN_DASHBOARD_ITEM_SIZE;
  }

  return formatBytes(sizeInfo.size);
}
