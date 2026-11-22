// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { formatBytes } from '@/modules/navigator/components/file-browser/utils';
import type { DirSizeInfo } from '@/stores/runtime/dir-sizes';

export const UNKNOWN_DIR_SIZE = '—';

export type DirSizeHint = 'partial' | 'unreadable' | 'skipped';

export interface SettledDirSizeDisplay {
  text: string;
  hint: DirSizeHint | null;
}

export const DIR_SIZE_HINT_MESSAGE_KEYS: Record<DirSizeHint, string> = {
  partial: 'dirSizeHints.partial',
  unreadable: 'dirSizeHints.unreadable',
  skipped: 'dirSizeHints.skipped',
};

export function getSettledDirSizeDisplay(
  sizeInfo: Pick<DirSizeInfo, 'status' | 'size' | 'skippedCount'> | null | undefined,
): SettledDirSizeDisplay | null {
  if (!sizeInfo) {
    return null;
  }

  if (sizeInfo.status === 'Complete') {
    return {
      text: formatBytes(sizeInfo.size),
      hint: (sizeInfo.skippedCount ?? 0) > 0 ? 'skipped' : null,
    };
  }

  if (sizeInfo.status === 'Partial') {
    return {
      text: `${formatBytes(sizeInfo.size)}+`,
      hint: 'partial',
    };
  }

  if (sizeInfo.status === 'Error') {
    return {
      text: UNKNOWN_DIR_SIZE,
      hint: 'unreadable',
    };
  }

  return null;
}
