// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { i18n } from '@/localization';

export const ARCHIVE_ERROR_CODE_DESTINATION_INSIDE_SELECTED_FOLDER
  = '__ARCHIVE_DESTINATION_INSIDE_SELECTED_FOLDER__';
export const ARCHIVE_ERROR_CODE_OUTPUT_ALREADY_EXISTS
  = '__ARCHIVE_OUTPUT_ALREADY_EXISTS__';

const LEGACY_EN_DESTINATION_INSIDE_SELECTED_FOLDER
  = 'Destination archive is inside a selected folder';

export function translateArchiveErrorMessage(raw: string): string {
  const trimmed = raw.trim();

  if (
    trimmed === ARCHIVE_ERROR_CODE_DESTINATION_INSIDE_SELECTED_FOLDER
    || trimmed === LEGACY_EN_DESTINATION_INSIDE_SELECTED_FOLDER
  ) {
    return i18n.global.t('fileBrowser.archive.errors.destinationInsideSelectedFolder');
  }

  if (trimmed === ARCHIVE_ERROR_CODE_OUTPUT_ALREADY_EXISTS) {
    return i18n.global.t('errors.errorPathAlreadyExists');
  }

  return raw;
}
