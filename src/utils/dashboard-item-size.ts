// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { formatBytes } from '@/modules/navigator/components/file-browser/utils';

export const UNKNOWN_DASHBOARD_ITEM_SIZE = '—';

export interface DashboardDirectorySizeInfo {
  status: 'Complete' | 'Error' | 'Loading';
  size: number;
}

export function formatDashboardFileSize(size: number | null | undefined): string {
  if (typeof size !== 'number') {
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
