// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { InfoPanelAutoPreviewFileTypes, InfoPanelPreviewFileType } from '@/types/user-settings';

export const DEFAULT_AUTO_PREVIEW_MAX_SIZE_MB = 25;

export const AUTO_PREVIEW_MAX_SIZE_MB_OPTIONS = [10, 25, 50, 100, 250, 0] as const;

export const INFO_PANEL_PREVIEW_FILE_TYPES: readonly InfoPanelPreviewFileType[] = [
  'image',
  'video',
  'audio',
  'pdf',
  'text',
];

export type InfoPanelPreviewBlockReason = 'disabled' | 'tooLarge';

const BYTES_PER_MB = 1024 * 1024;

export function resolveInfoPanelPreviewBlockReason(params: {
  fileType: InfoPanelPreviewFileType;
  fileSizeBytes: number;
  autoPreviewFileTypes: InfoPanelAutoPreviewFileTypes;
  autoPreviewMaxSizeMb: number;
  imageUsesOriginalFile: boolean;
}): InfoPanelPreviewBlockReason | null {
  if (params.autoPreviewFileTypes[params.fileType] === false) {
    return 'disabled';
  }

  const loadsWholeFile = params.fileType === 'pdf'
    || (params.fileType === 'image' && params.imageUsesOriginalFile);

  if (
    loadsWholeFile
    && params.autoPreviewMaxSizeMb > 0
    && params.fileSizeBytes > params.autoPreviewMaxSizeMb * BYTES_PER_MB
  ) {
    return 'tooLarge';
  }

  return null;
}
