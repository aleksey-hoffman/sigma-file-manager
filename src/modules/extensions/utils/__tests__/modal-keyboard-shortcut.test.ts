// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  ENTER_KEY_LABEL,
  formatKeyboardShortcut,
  formatOtherActionsShortcut,
  isOtherActionsKeyboardShortcut,
  isUnmodifiedEnterKey,
} from '@/modules/extensions/utils/modal-keyboard-shortcut';

describe('modal-keyboard-shortcut', () => {
  it('formats enter shortcuts with the return symbol', () => {
    expect(formatKeyboardShortcut({ key: 'Enter' })).toEqual([ENTER_KEY_LABEL]);
    expect(ENTER_KEY_LABEL).toBe('⏎');
  });

  it('formats the other actions shortcut', () => {
    expect(formatOtherActionsShortcut()).toEqual(['Ctrl', ENTER_KEY_LABEL]);
  });

  it('detects ctrl+enter as the other actions shortcut', () => {
    const matchingEvent = {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: true,
      shiftKey: false,
      altKey: false,
      metaKey: false,
    } as KeyboardEvent;

    expect(isOtherActionsKeyboardShortcut(matchingEvent)).toBe(true);
  });

  it('does not treat modified enter as plain enter', () => {
    const altEnterEvent = {
      key: 'Enter',
      code: 'Enter',
      ctrlKey: false,
      shiftKey: false,
      altKey: true,
      metaKey: false,
    } as KeyboardEvent;

    expect(isUnmodifiedEnterKey(altEnterEvent)).toBe(false);
  });
});
