// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { formatBytes } from '@/modules/navigator/components/file-browser/utils';
import type { DirSizeInfo } from '@/stores/runtime/dir-sizes';
import { getSettledDirSizeDisplay, UNKNOWN_DIR_SIZE } from '@/utils/dir-size-display';

export const UNKNOWN_DASHBOARD_ITEM_SIZE = UNKNOWN_DIR_SIZE;

export function formatDashboardFileSize(size: number | null | undefined): string {
  if (typeof size !== 'number') {
    return UNKNOWN_DASHBOARD_ITEM_SIZE;
  }

  return formatBytes(size);
}

export function formatDashboardDirectorySize(
  sizeInfo: Pick<DirSizeInfo, 'status' | 'size' | 'skippedCount'> | undefined,
): string {
  return getSettledDirSizeDisplay(sizeInfo)?.text ?? UNKNOWN_DASHBOARD_ITEM_SIZE;
}
