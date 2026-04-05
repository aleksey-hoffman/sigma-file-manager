// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { i18n } from '@/localization';

export function basenameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function sourceDisplayNameFromPaths(sourcePaths: string[]): string {
  if (sourcePaths.length === 0) {
    return '';
  }

  if (sourcePaths.length === 1) {
    return basenameFromPath(sourcePaths[0]);
  }

  return i18n.global.t('statusCenter.selectedItemsCount', { count: sourcePaths.length });
}
