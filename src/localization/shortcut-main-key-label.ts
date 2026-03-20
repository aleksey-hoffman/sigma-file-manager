// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { i18n } from './index';

export const KEYBOARD_MAIN_KEY_UNUSABLE = new Set(['', 'Unidentified', 'Dead', 'Process']);

export function shortcutMainKeyDisplayLabel(rawKey: string): string {
  if (!KEYBOARD_MAIN_KEY_UNUSABLE.has(rawKey)) {
    return rawKey;
  }
  return String(i18n.global.t('shortcutsUI.unknownMainKey'));
}
