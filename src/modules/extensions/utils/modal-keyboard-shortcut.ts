// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { KeyboardShortcut } from '@/types/extension';

export const ENTER_KEY_LABEL = '⏎';

export const OTHER_ACTIONS_KEYBOARD_SHORTCUT: KeyboardShortcut = {
  key: 'Enter',
  modifiers: ['ctrl'],
};

export function keyboardShortcutMatches(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  const modifiers = shortcut.modifiers ?? [];
  const needsCtrl = modifiers.includes('ctrl');
  const needsShift = modifiers.includes('shift');
  const needsAlt = modifiers.includes('alt');
  const needsMeta = modifiers.includes('meta');

  if (event.ctrlKey !== needsCtrl) {
    return false;
  }

  if (event.shiftKey !== needsShift) {
    return false;
  }

  if (event.altKey !== needsAlt) {
    return false;
  }

  if (event.metaKey !== needsMeta) {
    return false;
  }

  return event.key.toLowerCase() === shortcut.key.toLowerCase()
    || event.code.toLowerCase() === shortcut.key.toLowerCase();
}

export function isOtherActionsKeyboardShortcut(event: KeyboardEvent): boolean {
  return keyboardShortcutMatches(event, OTHER_ACTIONS_KEYBOARD_SHORTCUT);
}

export function isUnmodifiedEnterKey(event: KeyboardEvent): boolean {
  return event.key === 'Enter'
    && !event.ctrlKey
    && !event.shiftKey
    && !event.altKey
    && !event.metaKey;
}

export function formatShortcutKeyLabel(key: string): string {
  if (key.toLowerCase() === 'enter') {
    return ENTER_KEY_LABEL;
  }

  return key.toUpperCase();
}

export function formatKeyboardShortcut(shortcut: KeyboardShortcut): string[] {
  const parts: string[] = [];
  const modifiers = shortcut.modifiers ?? [];

  if (modifiers.includes('ctrl')) {
    parts.push('Ctrl');
  }

  if (modifiers.includes('shift')) {
    parts.push('Shift');
  }

  if (modifiers.includes('alt')) {
    parts.push('Alt');
  }

  if (modifiers.includes('meta')) {
    parts.push('⌘');
  }

  const keyName = formatShortcutKeyLabel(shortcut.key);
  parts.push(keyName);

  return parts;
}

export function formatOtherActionsShortcut(): string[] {
  return formatKeyboardShortcut(OTHER_ACTIONS_KEYBOARD_SHORTCUT);
}
