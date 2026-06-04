// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type {
  ShortcutId,
  ShortcutKeys,
  ShortcutUserAlternateChordSlots,
  UserShortcuts,
} from '@/types/user-settings';
import { setAppKeybindingConflictChecker } from '@/modules/extensions/api';
import { getSelectedEntries } from '@/modules/extensions/context';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import {
  KEYBOARD_MAIN_KEY_UNUSABLE,
  shortcutMainKeyDisplayLabel,
} from '@/localization/shortcut-main-key-label';
import { isDialogOpened, isInputFieldActive } from '@/utils/dom-interaction-state';

export type { ShortcutId, ShortcutKeys, UserShortcuts };
export type { UserShortcutStoredValue, ShortcutUserAlternateChordSlots } from '@/types/user-settings';

export type ShortcutConditions = {
  inputFieldIsActive?: boolean;
  dialogIsOpened?: boolean;
  dirItemIsSelected?: boolean;
};

export type ShortcutDefinition = {
  id: ShortcutId;
  bindingSlot?: number;
  alternateChordRow?: boolean;
  userDefinedAlternateChord?: boolean;
  labelKey: string;
  defaultKeys: ShortcutKeys;
  scope: 'global' | 'navigator' | 'settings';
  conditions: ShortcutConditions;
  isReadOnly: boolean;
};

type BuiltinNavigationPageRouteName = 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions';

type BuiltinNavigationPageShortcut = {
  id: ShortcutId;
  routeName: BuiltinNavigationPageRouteName;
  labelKey: string;
  defaultKeys: ShortcutKeys;
};

export const BUILTIN_NAVIGATION_PAGE_SHORTCUTS: BuiltinNavigationPageShortcut[] = [
  {
    id: 'switchToHomePage',
    routeName: 'home',
    labelKey: 'shortcuts.switchToHomePage',
    defaultKeys: {
      alt: true,
      key: '1',
    },
  },
  {
    id: 'switchToNavigatorPage',
    routeName: 'navigator',
    labelKey: 'shortcuts.switchToNavigatorPage',
    defaultKeys: {
      alt: true,
      key: '2',
    },
  },
  {
    id: 'switchToDashboardPage',
    routeName: 'dashboard',
    labelKey: 'shortcuts.switchToDashboardPage',
    defaultKeys: {
      alt: true,
      key: '3',
    },
  },
  {
    id: 'switchToSettingsPage',
    routeName: 'settings',
    labelKey: 'shortcuts.switchToSettingsPage',
    defaultKeys: {
      alt: true,
      key: '4',
    },
  },
  {
    id: 'switchToExtensionsPage',
    routeName: 'extensions',
    labelKey: 'shortcuts.switchToExtensionsPage',
    defaultKeys: {
      alt: true,
      key: '5',
    },
  },
];

const DEFAULT_SHORTCUTS: ShortcutDefinition[] = [
  {
    id: 'toggleGlobalSearch',
    labelKey: 'shortcuts.showHideGlobalSearch',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'f',
    },
    scope: 'global',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'toggleFilter',
    labelKey: 'shortcuts.focusUnfocusFilterField',
    defaultKeys: {
      ctrl: true,
      key: 'f',
    },
    scope: 'navigator',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'reloadCurrentDirectory',
    labelKey: 'shortcuts.reloadCurrentDirectory',
    defaultKeys: {
      key: 'F5',
    },
    scope: 'navigator',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'toggleSettingsSearch',
    labelKey: 'shortcuts.focusUnfocusSettingsSearch',
    defaultKeys: {
      ctrl: true,
      key: 'f',
    },
    scope: 'settings',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'toggleCommandPalette',
    labelKey: 'shortcuts.toggleCommandPalette',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'p',
    },
    scope: 'global',
    conditions: {},
    isReadOnly: false,
  },
  {
    id: 'toggleAddressBar',
    labelKey: 'shortcuts.toggleAddressBar',
    defaultKeys: {
      ctrl: true,
      key: 'l',
    },
    scope: 'navigator',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'openEntry',
    labelKey: 'shortcuts.openEntry',
    defaultKeys: {
      ctrl: true,
      key: 'p',
    },
    scope: 'navigator',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  ...BUILTIN_NAVIGATION_PAGE_SHORTCUTS.map((shortcut): ShortcutDefinition => ({
    id: shortcut.id,
    labelKey: shortcut.labelKey,
    defaultKeys: shortcut.defaultKeys,
    scope: 'global',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  })),
  {
    id: 'navigatePageBack',
    labelKey: 'shortcuts.navigatePageBack',
    defaultKeys: {
      key: '',
    },
    scope: 'global',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigatePageForward',
    labelKey: 'shortcuts.navigatePageForward',
    defaultKeys: {
      key: '',
    },
    scope: 'global',
    conditions: {
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'toggleSplitView',
    labelKey: 'shortcuts.toggleSplitView',
    defaultKeys: {
      ctrl: true,
      key: 's',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'createNewFile',
    labelKey: 'shortcuts.createNewFileInCurrentDirectory',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'm',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'createNewDirectory',
    labelKey: 'shortcuts.createNewDirectoryInTheCurrentDirectory',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'n',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'copyCurrentDirectoryPath',
    labelKey: 'shortcuts.copyCurrentDirectoryPathToClipboard',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'c',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'openCopiedPath',
    labelKey: 'shortcuts.openCopiedPath',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 'v',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'copy',
    labelKey: 'shortcuts.setSelectedItemsForCopying',
    defaultKeys: {
      ctrl: true,
      key: 'c',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'cut',
    labelKey: 'shortcuts.setSelectedItemsForMoving',
    defaultKeys: {
      ctrl: true,
      key: 'x',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'paste',
    labelKey: 'shortcuts.transferPreparedForCopying',
    defaultKeys: {
      ctrl: true,
      key: 'v',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'selectAll',
    labelKey: 'shortcuts.selectAllItemsInCurrentDirectory',
    defaultKeys: {
      ctrl: true,
      key: 'a',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'delete',
    labelKey: 'shortcuts.moveSelectedItemsToTrash',
    defaultKeys: {
      key: 'Delete',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'deletePermanently',
    labelKey: 'shortcuts.deleteSelectedItemsFromDrive',
    defaultKeys: {
      shift: true,
      key: 'Delete',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'rename',
    labelKey: 'shortcuts.renameSelectedItems',
    defaultKeys: {
      key: 'F2',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true,
    },
    isReadOnly: false,
  },
  {
    id: 'escape',
    labelKey: 'shortcuts.closeOpenedDialogOverlay',
    defaultKeys: {
      key: 'Escape',
    },
    scope: 'global',
    conditions: {},
    isReadOnly: true,
  },
  {
    id: 'quickView',
    labelKey: 'shortcuts.openCloseSelectedFileInQuickView',
    defaultKeys: {
      key: ' ',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true,
    },
    isReadOnly: false,
  },
  {
    id: 'print',
    labelKey: 'shortcuts.printSelectedFile',
    defaultKeys: {
      ctrl: true,
      key: 'o',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true,
    },
    isReadOnly: false,
  },
  {
    id: 'properties',
    labelKey: 'shortcuts.openNativeProperties',
    defaultKeys: {
      alt: true,
      key: 'Enter',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true,
    },
    isReadOnly: false,
  },
  {
    id: 'openNewTab',
    labelKey: 'shortcuts.openCurrentDirInNewTab',
    defaultKeys: {
      ctrl: true,
      key: 't',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'closeCurrentTab',
    labelKey: 'shortcuts.closeCurrentTab',
    defaultKeys: {
      ctrl: true,
      key: 'w',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'restoreLastClosedTab',
    labelKey: 'shortcuts.restoreLastClosedTab',
    defaultKeys: {
      ctrl: true,
      shift: true,
      key: 't',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'openTerminal',
    labelKey: 'shortcuts.openCurrentDirInTerminal',
    defaultKeys: {
      alt: true,
      key: 't',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'openTerminalAdmin',
    labelKey: 'shortcuts.openCurrentDirInTerminalAsAdmin',
    defaultKeys: {
      alt: true,
      shift: true,
      key: 't',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateUp',
    labelKey: 'shortcuts.navigateUp',
    defaultKeys: {
      key: 'ArrowUp',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateDown',
    labelKey: 'shortcuts.navigateDown',
    defaultKeys: {
      key: 'ArrowDown',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateLeft',
    labelKey: 'shortcuts.navigateLeft',
    defaultKeys: {
      key: 'ArrowLeft',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateRight',
    labelKey: 'shortcuts.navigateRight',
    defaultKeys: {
      key: 'ArrowRight',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'openSelected',
    labelKey: 'shortcuts.openSelectedEntry',
    defaultKeys: {
      key: 'Enter',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
      dirItemIsSelected: true,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateHistoryBack',
    bindingSlot: 0,
    labelKey: 'shortcuts.navigateHistoryBack',
    defaultKeys: {
      alt: true,
      key: 'ArrowLeft',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateHistoryBack',
    bindingSlot: 1,
    alternateChordRow: true,
    labelKey: 'shortcuts.navigateHistoryBack',
    defaultKeys: {
      key: 'MouseButton4',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateHistoryForward',
    bindingSlot: 0,
    labelKey: 'shortcuts.navigateHistoryForward',
    defaultKeys: {
      alt: true,
      key: 'ArrowRight',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'navigateHistoryForward',
    bindingSlot: 1,
    alternateChordRow: true,
    labelKey: 'shortcuts.navigateHistoryForward',
    defaultKeys: {
      key: 'MouseButton5',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'goUpDirectory',
    labelKey: 'shortcuts.goUpDirectory',
    defaultKeys: {
      alt: true,
      key: 'ArrowUp',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'switchToLeftPane',
    labelKey: 'shortcuts.switchToLeftPane',
    defaultKeys: {
      ctrl: true,
      key: 'ArrowLeft',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'switchToRightPane',
    labelKey: 'shortcuts.switchToRightPane',
    defaultKeys: {
      ctrl: true,
      key: 'ArrowRight',
    },
    scope: 'navigator',
    conditions: {
      inputFieldIsActive: false,
      dialogIsOpened: false,
    },
    isReadOnly: false,
  },
  {
    id: 'uiZoomIncrease',
    labelKey: 'shortcuts.uiZoomIncrease',
    defaultKeys: {
      ctrl: true,
      key: '=',
    },
    scope: 'global',
    conditions: {},
    isReadOnly: false,
  },
  {
    id: 'uiZoomDecrease',
    labelKey: 'shortcuts.uiZoomDecrease',
    defaultKeys: {
      ctrl: true,
      key: '-',
    },
    scope: 'global',
    conditions: {},
    isReadOnly: false,
  },
  {
    id: 'toggleFullscreen',
    labelKey: 'shortcuts.toggleFullScreen',
    defaultKeys: {
      key: 'F11',
    },
    scope: 'global',
    conditions: {},
    isReadOnly: false,
  },
];

function mergeShortcutDefinitionsWithUserAlternateRows(
  baseDefinitions: ShortcutDefinition[],
  userAlternateChordSlots: ShortcutUserAlternateChordSlots,
): ShortcutDefinition[] {
  const merged: ShortcutDefinition[] = [];
  let baseWalkIndex = 0;

  while (baseWalkIndex < baseDefinitions.length) {
    const currentShortcutId = baseDefinitions[baseWalkIndex].id;

    while (
      baseWalkIndex < baseDefinitions.length
      && baseDefinitions[baseWalkIndex].id === currentShortcutId
    ) {
      merged.push(baseDefinitions[baseWalkIndex]);
      baseWalkIndex += 1;
    }

    const extraSlots = userAlternateChordSlots[currentShortcutId];
    if (!extraSlots?.length) continue;

    const primaryTemplate = baseDefinitions.find(
      definition =>
        definition.id === currentShortcutId
        && (definition.bindingSlot ?? 0) === 0,
    );

    if (!primaryTemplate) continue;

    for (const bindingSlot of extraSlots) {
      merged.push({
        id: primaryTemplate.id,
        bindingSlot,
        labelKey: primaryTemplate.labelKey,
        defaultKeys: { key: '' },
        scope: primaryTemplate.scope,
        conditions: { ...primaryTemplate.conditions },
        isReadOnly: primaryTemplate.isReadOnly,
        alternateChordRow: true,
        userDefinedAlternateChord: true,
      });
    }
  }

  return merged;
}

const MODIFIER_ONLY_KEYBOARD_CODES = new Set([
  'MetaLeft',
  'MetaRight',
  'OSLeft',
  'OSRight',
  'ControlLeft',
  'ControlRight',
  'ShiftLeft',
  'ShiftRight',
  'AltLeft',
  'AltRight',
]);

export function isModifierPhysicalKeyCode(code: string): boolean {
  return MODIFIER_ONLY_KEYBOARD_CODES.has(code);
}

const F_KEYCODE_TO_LABEL: Record<number, string> = (() => {
  const table: Record<number, string> = {};

  for (let functionKeyNumber = 1; functionKeyNumber <= 12; functionKeyNumber += 1) {
    table[111 + functionKeyNumber] = `F${functionKeyNumber}`;
  }

  return table;
})();

const OEM_KEYCODE_CHROMIUM: Record<number, string> = {
  186: ';',
  187: '=',
  188: ',',
  189: '-',
  190: '.',
  191: '/',
  192: '`',
  219: '[',
  220: '\\',
  221: ']',
  222: '\'',
};

function isBadResolvedMainKey(value: string): boolean {
  return value === '' || value === 'Unidentified' || KEYBOARD_MAIN_KEY_UNUSABLE.has(value);
}

function mainKeyFromLegacyKeyCode(event: KeyboardEvent): string | null {
  const keyCode = event.keyCode || event.which;
  if (!keyCode) return null;

  const location = event.location;

  if (location === KeyboardEvent.DOM_KEY_LOCATION_NUMPAD) {
    if (keyCode >= 96 && keyCode <= 105) {
      return String(keyCode - 96);
    }

    if (keyCode === 106) return '*';
    if (keyCode === 107) return '+';
    if (keyCode === 109) return '-';
    if (keyCode === 110) return '.';
    if (keyCode === 111) return '/';
    if (keyCode === 13) return 'Enter';
  }

  if (keyCode >= 48 && keyCode <= 57) {
    return String.fromCharCode(keyCode);
  }

  if (keyCode >= 65 && keyCode <= 90) {
    return String.fromCharCode(keyCode).toLowerCase();
  }

  if (keyCode === 32) {
    return ' ';
  }

  const functionKeyLabel = F_KEYCODE_TO_LABEL[keyCode];

  if (functionKeyLabel) {
    return functionKeyLabel;
  }

  return OEM_KEYCODE_CHROMIUM[keyCode] ?? null;
}

function mainKeyFromPhysicalCode(code: string): string {
  if (!code || code === 'Unidentified') {
    return '';
  }

  if (code.startsWith('Key') && code.length === 4) {
    return code.slice(3).toLowerCase();
  }

  if (code.startsWith('Digit')) {
    return code.slice(5);
  }

  if (code === 'NumpadDecimal') return '.';
  if (code === 'NumpadAdd') return '+';
  if (code === 'NumpadSubtract') return '-';
  if (code === 'NumpadMultiply') return '*';
  if (code === 'NumpadDivide') return '/';
  if (code === 'NumpadEnter') return 'Enter';
  if (code === 'NumpadEqual') return '=';

  if (code.startsWith('Numpad')) {
    const numpadDigit = code.slice(6);
    if (/^\d$/.test(numpadDigit)) return numpadDigit;
  }

  const codeToKey: Record<string, string> = {
    Space: ' ',
    Minus: '-',
    Equal: '=',
    BracketLeft: '[',
    BracketRight: ']',
    Backslash: '\\',
    Semicolon: ';',
    Quote: '\'',
    Comma: ',',
    Period: '.',
    Slash: '/',
    Backquote: '`',
    IntlBackslash: '\\',
    ArrowUp: 'ArrowUp',
    ArrowDown: 'ArrowDown',
    ArrowLeft: 'ArrowLeft',
    ArrowRight: 'ArrowRight',
    Enter: 'Enter',
    Escape: 'Escape',
    Tab: 'Tab',
    Backspace: 'Backspace',
    Delete: 'Delete',
    Insert: 'Insert',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    CapsLock: 'CapsLock',
    ContextMenu: 'ContextMenu',
    Pause: 'Pause',
    ScrollLock: 'ScrollLock',
    PrintScreen: 'PrintScreen',
    NumLock: 'NumLock',
  };

  const mapped = codeToKey[code];
  if (mapped !== undefined) return mapped;

  if (/^F([1-9]|1[0-2])$/.test(code)) return code;

  return code;
}

export type ResolveShortcutKeyOptions = {
  preferPhysicalMainKey?: boolean;
};

export function resolveShortcutKeyFromKeyboardEvent(
  event: KeyboardEvent,
  options?: ResolveShortcutKeyOptions,
): string | null {
  if (isModifierPhysicalKeyCode(event.code)) {
    return null;
  }

  const code = event.code;
  const fromPhysical = mainKeyFromPhysicalCode(code);
  const preferPhysical = options?.preferPhysicalMainKey === true;

  if (
    preferPhysical
    && (code.startsWith('Key') || code.startsWith('Digit'))
    && !isBadResolvedMainKey(fromPhysical)
  ) {
    return fromPhysical;
  }

  const fromKey = event.key;

  if (!KEYBOARD_MAIN_KEY_UNUSABLE.has(fromKey)) {
    return fromKey;
  }

  if (!isBadResolvedMainKey(fromPhysical)) {
    return fromPhysical;
  }

  const fromLegacy = mainKeyFromLegacyKeyCode(event);

  if (fromLegacy && !isBadResolvedMainKey(fromLegacy)) {
    return fromLegacy;
  }

  return null;
}

function formatShortcutMainKeyForDisplay(rawKey: string): string {
  let keyDisplay = shortcutMainKeyDisplayLabel(rawKey);

  if (keyDisplay === 'MouseButton4') {
    keyDisplay = 'Mouse Button 4';
  }
  else if (keyDisplay === 'MouseButton5') {
    keyDisplay = 'Mouse Button 5';
  }
  else if (keyDisplay === ' ') {
    keyDisplay = 'Space';
  }
  else if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  }
  else if (keyDisplay === 'Delete') {
    keyDisplay = 'Del';
  }
  else if (keyDisplay === 'ArrowUp') {
    keyDisplay = '↑';
  }
  else if (keyDisplay === 'ArrowDown') {
    keyDisplay = '↓';
  }
  else if (keyDisplay === 'ArrowLeft') {
    keyDisplay = '←';
  }
  else if (keyDisplay === 'ArrowRight') {
    keyDisplay = '→';
  }

  return keyDisplay;
}

export function formatCaptureChordLabel(
  pressedCodes: ReadonlySet<string>,
  modifierEvent: KeyboardEvent,
): string {
  const parts: string[] = [];

  if (modifierEvent.ctrlKey) parts.push('Ctrl');
  if (modifierEvent.altKey) parts.push('Alt');
  if (modifierEvent.metaKey) parts.push('Win');
  if (modifierEvent.shiftKey) parts.push('Shift');

  const mainCodes = [...pressedCodes]
    .filter(code => !isModifierPhysicalKeyCode(code))
    .sort();

  for (const code of mainCodes) {
    const raw = mainKeyFromPhysicalCode(code);

    if (raw !== '') {
      parts.push(formatShortcutMainKeyForDisplay(raw));
    }
  }

  return parts.join('+');
}

export function formatShortcutKeys(keys: ShortcutKeys): string {
  if (!keys.key) {
    return '';
  }

  const parts: string[] = [];

  if (keys.ctrl) parts.push('Ctrl');
  if (keys.alt) parts.push('Alt');
  if (keys.meta) parts.push('Win');
  if (keys.shift) parts.push('Shift');

  let mainKeyForDisplay = keys.key;

  if ((keys.ctrl || keys.meta) && mainKeyForDisplay === '=' && !keys.shift) {
    mainKeyForDisplay = '+';
  }

  parts.push(formatShortcutMainKeyForDisplay(mainKeyForDisplay));

  return parts.join('+');
}

export function parseShortcutString(shortcutString: string): ShortcutKeys | null {
  const parts = shortcutString.split('+').map(part => part.trim().toLowerCase());

  if (parts.length === 0) return null;

  const keys: ShortcutKeys = { key: '' };

  for (let partIndex = 0; partIndex < parts.length - 1; partIndex++) {
    const modifier = parts[partIndex];
    if (modifier === 'ctrl' || modifier === 'control') keys.ctrl = true;
    else if (modifier === 'alt') keys.alt = true;
    else if (modifier === 'shift') keys.shift = true;
    else if (modifier === 'meta' || modifier === 'cmd' || modifier === 'win') keys.meta = true;
  }

  const lastPart = parts[parts.length - 1];
  keys.key = lastPart.charAt(0).toUpperCase() + lastPart.slice(1);

  if (keys.key === 'Del') keys.key = 'Delete';
  if (keys.key === 'Space') keys.key = ' ';

  return keys;
}

function mouseButtonToShortcutKey(button: number): string | null {
  if (button === 3) return 'MouseButton4';
  if (button === 4) return 'MouseButton5';

  return null;
}

function modifiersMatch(event: KeyboardEvent | MouseEvent, keys: ShortcutKeys): boolean {
  const eventCtrl = event.ctrlKey || event.metaKey;
  const expectedCtrl = keys.ctrl || keys.meta || false;

  if (eventCtrl !== expectedCtrl) return false;
  if (event.altKey !== (keys.alt || false)) return false;
  if (event.shiftKey !== (keys.shift || false)) return false;

  return true;
}

export function matchesShortcut(event: KeyboardEvent, keys: ShortcutKeys): boolean {
  if (!keys.key) return false;
  if (keys.key.startsWith('MouseButton')) return false;

  const eventCtrl = event.ctrlKey || event.metaKey;
  const expectedCtrl = keys.ctrl || keys.meta || false;

  if (eventCtrl !== expectedCtrl) return false;
  if (event.altKey !== (keys.alt || false)) return false;

  const eventKey = event.key.toLowerCase();
  const expectedKey = keys.key.toLowerCase();

  if (
    expectedKey === '='
    && (keys.ctrl || keys.meta)
    && !keys.alt
    && !keys.shift
  ) {
    if (eventKey === '=' || eventKey === '+' || event.code === 'NumpadAdd') {
      return true;
    }
  }

  if (
    expectedKey === '-'
    && (keys.ctrl || keys.meta)
    && !keys.alt
    && !keys.shift
  ) {
    if (eventKey === '-' || event.code === 'NumpadSubtract') {
      return true;
    }
  }

  if (event.shiftKey !== (keys.shift || false)) return false;

  if (expectedKey === ' ' && event.code === 'Space') return true;

  if (/^[0-9]$/.test(expectedKey) && event.code === `Digit${expectedKey}`) {
    return true;
  }

  const codeLower = event.code.toLowerCase();
  return eventKey === expectedKey || codeLower === `key${expectedKey}`;
}

function matchesMouseShortcut(event: MouseEvent, keys: ShortcutKeys): boolean {
  if (!keys.key) return false;
  if (!modifiersMatch(event, keys)) return false;

  const eventKey = mouseButtonToShortcutKey(event.button);
  return eventKey !== null && eventKey.toLowerCase() === keys.key.toLowerCase();
}

const ADDRESS_BAR_PATH_EDITOR_YIELD_NAVIGATOR_IDS: ReadonlySet<ShortcutId> = new Set([
  'goUpDirectory',
  'navigateHistoryBack',
  'navigateHistoryForward',
]);

const EARLY_PREVENT_DEFAULT_SHORTCUT_IDS: ReadonlySet<ShortcutId> = new Set([
  'copyCurrentDirectoryPath',
]);

function keyboardEventTouchesAddressBarPathEditor(event: KeyboardEvent): boolean {
  const composedPathSegments
    = typeof event.composedPath === 'function'
      ? [...event.composedPath()]
      : [];

  const candidateTargets = [...composedPathSegments];

  if (
    typeof event.target === 'object'
    && event.target !== null
    && !composedPathSegments.some(candidate => candidate === event.target)
  ) {
    candidateTargets.unshift(event.target);
  }

  for (const candidate of candidateTargets) {
    if (
      candidate instanceof Element
      && candidate.getAttribute('data-address-bar-editor-path') === 'open'
    ) {
      return true;
    }
  }

  return false;
}

export function formatConditionsLabel(conditions: ShortcutConditions): string {
  const conditionLabels: string[] = [];

  if (conditions.inputFieldIsActive === false) {
    conditionLabels.push('!inputFocused');
  }
  else if (conditions.inputFieldIsActive === true) {
    conditionLabels.push('inputFocused');
  }

  if (conditions.dialogIsOpened === false) {
    conditionLabels.push('!dialogOpen');
  }
  else if (conditions.dialogIsOpened === true) {
    conditionLabels.push('dialogOpen');
  }

  if (conditions.dirItemIsSelected === true) {
    conditionLabels.push('itemSelected');
  }
  else if (conditions.dirItemIsSelected === false) {
    conditionLabels.push('!itemSelected');
  }

  return conditionLabels.join(' && ') || '';
}

export function getSelectedTextForCopy(): string | null {
  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString();

  if (text.trim().length === 0) {
    return null;
  }

  return text;
}

type ShortcutHandler = () => void | boolean | Promise<void | boolean>;
type ShortcutHandlerResult = ReturnType<ShortcutHandler>;

type HandlerRegistration = {
  handler: ShortcutHandler;
  checkItemSelected?: () => boolean;
};

export const useShortcutsStore = defineStore('shortcuts', () => {
  const userSettingsStore = useUserSettingsStore();
  const extensionsStore = useExtensionsStore();

  const definitions = computed(() =>
    mergeShortcutDefinitionsWithUserAlternateRows(
      DEFAULT_SHORTCUTS,
      userSettingsStore.userSettings.shortcutUserAlternateChordSlots ?? {},
    ),
  );
  const handlers = ref<Map<ShortcutId, HandlerRegistration>>(new Map());
  const isInitialized = ref(false);
  const isListenerActive = ref(false);
  const isShortcutCaptureActive = ref(false);

  const userShortcuts = computed({
    get: () => userSettingsStore.userSettings.shortcuts ?? {},
    set: async (value: UserShortcuts) => {
      userSettingsStore.userSettings.shortcuts = value;
      await userSettingsStore.setUserSettingsStorage('shortcuts', value);
    },
  });

  async function persistShortcutUserAlternateChordSlots(next: ShortcutUserAlternateChordSlots): Promise<void> {
    const cleaned: ShortcutUserAlternateChordSlots = {};

    for (const shortcutId of Object.keys(next) as ShortcutId[]) {
      const slots = next[shortcutId];

      if (slots?.length) {
        cleaned[shortcutId] = slots;
      }
    }

    userSettingsStore.userSettings.shortcutUserAlternateChordSlots = cleaned;
    await userSettingsStore.setUserSettingsStorage('shortcutUserAlternateChordSlots', cleaned);
  }

  function getMaxBindingSlotIndex(shortcutId: ShortcutId): number {
    let maxSlot = 0;

    for (const definition of definitions.value) {
      if (definition.id !== shortcutId) continue;

      const slotIndex = definition.bindingSlot ?? 0;

      if (slotIndex > maxSlot) {
        maxSlot = slotIndex;
      }
    }

    return maxSlot;
  }

  function resolveShortcutBindingKeys(definition: ShortcutDefinition): ShortcutKeys {
    const bindingSlot = definition.bindingSlot ?? 0;
    const shortcutId = definition.id;
    const entry = userShortcuts.value[shortcutId];
    const defaultKeys = definition.defaultKeys;

    if (entry === undefined) {
      return defaultKeys;
    }

    if (!Array.isArray(entry)) {
      return bindingSlot === 0 ? entry : defaultKeys;
    }

    const slotValue = entry[bindingSlot];

    return slotValue != null ? slotValue : defaultKeys;
  }

  function getShortcutBindingLabel(definition: ShortcutDefinition): string {
    return formatShortcutKeys(resolveShortcutBindingKeys(definition));
  }

  function isShortcutBindingCustomized(definition: ShortcutDefinition): boolean {
    const bindingSlot = definition.bindingSlot ?? 0;
    const entry = userShortcuts.value[definition.id];

    if (entry === undefined) {
      return false;
    }

    if (!Array.isArray(entry)) {
      return bindingSlot === 0;
    }

    return entry[bindingSlot] != null;
  }

  function getShortcutBindingSource(definition: ShortcutDefinition): 'system' | 'user' {
    return isShortcutBindingCustomized(definition) ? 'user' : 'system';
  }

  function getPrimaryShortcutDefinition(shortcutId: ShortcutId): ShortcutDefinition | undefined {
    return definitions.value.find(
      definitionItem =>
        definitionItem.id === shortcutId
        && (definitionItem.bindingSlot ?? 0) === 0,
    );
  }

  function getShortcutKeys(shortcutId: ShortcutId): ShortcutKeys {
    const definition = getPrimaryShortcutDefinition(shortcutId);

    if (!definition) {
      return { key: '' };
    }

    return resolveShortcutBindingKeys(definition);
  }

  function getShortcutLabel(shortcutId: ShortcutId): string {
    return formatShortcutKeys(getShortcutKeys(shortcutId));
  }

  function getShortcutDefinition(shortcutId: ShortcutId): ShortcutDefinition | undefined {
    return getPrimaryShortcutDefinition(shortcutId);
  }

  function isCustomized(shortcutId: ShortcutId): boolean {
    return userShortcuts.value[shortcutId] !== undefined;
  }

  function getSource(shortcutId: ShortcutId): 'system' | 'user' {
    return isCustomized(shortcutId) ? 'user' : 'system';
  }

  async function setShortcut(
    shortcutId: ShortcutId,
    keys: ShortcutKeys,
    bindingSlot = 0,
  ): Promise<void> {
    const arrayLength = getMaxBindingSlotIndex(shortcutId) + 1;

    if (arrayLength <= 1) {
      const newShortcuts = {
        ...userShortcuts.value,
        [shortcutId]: keys,
      };
      userShortcuts.value = newShortcuts;
      return;
    }

    const current = userShortcuts.value[shortcutId];
    const nextArray: Array<ShortcutKeys | null> = Array.from({ length: arrayLength }, () => null);

    if (Array.isArray(current)) {
      for (let slotIndex = 0; slotIndex < arrayLength; slotIndex += 1) {
        nextArray[slotIndex] = current[slotIndex] ?? null;
      }
    }
    else if (current !== undefined) {
      nextArray[0] = current;
    }

    nextArray[bindingSlot] = keys;

    if (nextArray.every(slotValue => slotValue == null)) {
      const newShortcuts = { ...userShortcuts.value };
      delete newShortcuts[shortcutId];
      userShortcuts.value = newShortcuts;
      return;
    }

    userShortcuts.value = {
      ...userShortcuts.value,
      [shortcutId]: nextArray,
    };
  }

  async function resetShortcut(shortcutId: ShortcutId, bindingSlot?: number): Promise<void> {
    const arrayLength = getMaxBindingSlotIndex(shortcutId) + 1;

    if (bindingSlot === undefined) {
      const newShortcuts = { ...userShortcuts.value };
      delete newShortcuts[shortcutId];
      userShortcuts.value = newShortcuts;

      const clearedExtras: ShortcutUserAlternateChordSlots = {
        ...(userSettingsStore.userSettings.shortcutUserAlternateChordSlots ?? {}),
      };
      delete clearedExtras[shortcutId];
      await persistShortcutUserAlternateChordSlots(clearedExtras);
      return;
    }

    if (arrayLength <= 1) {
      const newShortcuts = { ...userShortcuts.value };
      delete newShortcuts[shortcutId];
      userShortcuts.value = newShortcuts;
      return;
    }

    const current = userShortcuts.value[shortcutId];
    const nextArray: Array<ShortcutKeys | null> = Array.from({ length: arrayLength }, () => null);

    if (Array.isArray(current)) {
      for (let slotIndex = 0; slotIndex < arrayLength; slotIndex += 1) {
        nextArray[slotIndex] = current[slotIndex] ?? null;
      }
    }
    else if (current !== undefined) {
      nextArray[0] = current;
    }

    nextArray[bindingSlot] = null;

    if (nextArray.every(slotValue => slotValue == null)) {
      const newShortcuts = { ...userShortcuts.value };
      delete newShortcuts[shortcutId];
      userShortcuts.value = newShortcuts;
      return;
    }

    userShortcuts.value = {
      ...userShortcuts.value,
      [shortcutId]: nextArray,
    };
  }

  function trimUserShortcutEntryToMaxSlot(shortcutId: ShortcutId): void {
    const maxSlotIndex = getMaxBindingSlotIndex(shortcutId);
    const arrayLength = maxSlotIndex + 1;
    const currentEntry = userShortcuts.value[shortcutId];

    if (!Array.isArray(currentEntry)) return;

    const trimmed = currentEntry.slice(0, arrayLength);

    if (trimmed.every(slotValue => slotValue == null)) {
      const newShortcuts = { ...userShortcuts.value };
      delete newShortcuts[shortcutId];
      userShortcuts.value = newShortcuts;
      return;
    }

    userShortcuts.value = {
      ...userShortcuts.value,
      [shortcutId]: trimmed,
    };
  }

  async function addUserAlternateChordBinding(
    shortcutId: ShortcutId,
    originDefinition: ShortcutDefinition,
  ): Promise<void> {
    const primaryTemplate = DEFAULT_SHORTCUTS.find(
      definition =>
        definition.id === shortcutId
        && (definition.bindingSlot ?? 0) === 0,
    );

    if (!primaryTemplate || primaryTemplate.isReadOnly) return;

    const slotsBefore = userSettingsStore.userSettings.shortcutUserAlternateChordSlots ?? {};
    const mergedBefore = mergeShortcutDefinitionsWithUserAlternateRows(DEFAULT_SHORTCUTS, slotsBefore);

    const originBindingSlot = originDefinition.bindingSlot ?? 0;

    const originIdx = mergedBefore.findIndex(
      definition =>
        definition.id === shortcutId
        && (definition.bindingSlot ?? 0) === originBindingSlot,
    );

    if (originIdx < 0) return;

    let endIdx = originIdx;

    while (
      endIdx + 1 < mergedBefore.length
      && mergedBefore[endIdx + 1].id === shortcutId
    ) {
      endIdx += 1;
    }

    const insertMergedIndex = endIdx + 1;

    const builtinCountForId = DEFAULT_SHORTCUTS.filter(definition => definition.id === shortcutId).length;
    const groupStart = mergedBefore.findIndex(definition => definition.id === shortcutId);

    if (groupStart < 0) return;

    const userVisualStart = groupStart + builtinCountForId;
    const rawInsertPosition = insertMergedIndex - userVisualStart;
    const current: ShortcutUserAlternateChordSlots = { ...slotsBefore };
    const userSlots = [...(current[shortcutId] ?? [])];

    const insertIntoUserArray = Math.max(0, Math.min(rawInsertPosition, userSlots.length));

    const maxBuiltinSlot = Math.max(
      0,
      ...DEFAULT_SHORTCUTS
        .filter(definition => definition.id === shortcutId)
        .map(definition => definition.bindingSlot ?? 0),
    );

    const maxFromUserSlots = userSlots.length ? Math.max(...userSlots) : -1;
    const maxSlotOverall = Math.max(maxBuiltinSlot, maxFromUserSlots);
    const newSlot = maxSlotOverall + 1;

    userSlots.splice(insertIntoUserArray, 0, newSlot);
    current[shortcutId] = userSlots;

    await persistShortcutUserAlternateChordSlots(current);
  }

  async function removeUserAlternateChordBindingRow(shortcutId: ShortcutId, bindingSlot: number): Promise<void> {
    await resetShortcut(shortcutId, bindingSlot);

    const current: ShortcutUserAlternateChordSlots = {
      ...(userSettingsStore.userSettings.shortcutUserAlternateChordSlots ?? {}),
    };
    const userSlots = [...(current[shortcutId] ?? [])];
    const filtered = userSlots.filter(slot => slot !== bindingSlot);

    if (filtered.length === userSlots.length) return;

    if (filtered.length) {
      current[shortcutId] = filtered;
    }
    else {
      delete current[shortcutId];
    }

    await persistShortcutUserAlternateChordSlots(current);
    trimUserShortcutEntryToMaxSlot(shortcutId);
  }

  async function resetAllShortcuts(): Promise<void> {
    userShortcuts.value = {};
    await persistShortcutUserAlternateChordSlots({});
  }

  function checkConditions(definition: ShortcutDefinition, registration?: HandlerRegistration): boolean {
    const { conditions } = definition;

    if (conditions.inputFieldIsActive !== undefined) {
      if (isInputFieldActive() !== conditions.inputFieldIsActive) {
        return false;
      }
    }

    if (conditions.dialogIsOpened !== undefined) {
      if (isDialogOpened() !== conditions.dialogIsOpened) {
        return false;
      }
    }

    if (conditions.dirItemIsSelected !== undefined && registration?.checkItemSelected) {
      if (registration.checkItemSelected() !== conditions.dirItemIsSelected) {
        return false;
      }
    }

    return true;
  }

  function registerHandler(
    shortcutId: ShortcutId,
    handler: ShortcutHandler,
    options?: { checkItemSelected?: () => boolean },
  ): void {
    handlers.value.set(shortcutId, {
      handler,
      checkItemSelected: options?.checkItemSelected,
    });
  }

  function unregisterHandler(shortcutId: ShortcutId): void {
    handlers.value.delete(shortcutId);
  }

  function setShortcutCaptureActive(isActive: boolean): void {
    isShortcutCaptureActive.value = isActive;
  }

  function callShortcutHandler(shortcutId: ShortcutId): ShortcutHandlerResult | null {
    const definition = getShortcutDefinition(shortcutId);
    if (!definition) return null;

    const registration = handlers.value.get(shortcutId);
    if (!registration) return null;

    if (!checkConditions(definition, registration)) {
      return null;
    }

    return registration.handler();
  }

  function canCallShortcutHandler(shortcutId: ShortcutId): boolean {
    const definition = getShortcutDefinition(shortcutId);
    if (!definition) return false;

    const registration = handlers.value.get(shortcutId);
    if (!registration) return false;

    return checkConditions(definition, registration);
  }

  async function executeShortcut(shortcutId: ShortcutId): Promise<boolean> {
    const result = callShortcutHandler(shortcutId);
    if (result === null) return false;

    if (result instanceof Promise) {
      const asyncResult = await result;
      return asyncResult !== false;
    }

    return result !== false;
  }

  function findMatchingShortcut(event: KeyboardEvent): ShortcutId | null {
    for (const definition of definitions.value) {
      const keys = resolveShortcutBindingKeys(definition);

      if (matchesShortcut(event, keys)) {
        return definition.id;
      }
    }

    return null;
  }

  function findAllMatchingShortcuts(event: KeyboardEvent): ShortcutId[] {
    const matchingShortcuts: ShortcutId[] = [];

    for (const definition of definitions.value) {
      const keys = resolveShortcutBindingKeys(definition);

      if (matchesShortcut(event, keys)) {
        matchingShortcuts.push(definition.id);
      }
    }

    return matchingShortcuts;
  }

  function findAllMatchingMouseShortcuts(event: MouseEvent): ShortcutId[] {
    const matchingShortcuts: ShortcutId[] = [];

    for (const definition of definitions.value) {
      const keys = resolveShortcutBindingKeys(definition);

      if (matchesMouseShortcut(event, keys)) {
        matchingShortcuts.push(definition.id);
      }
    }

    return matchingShortcuts;
  }

  function findConflictingShortcut(
    keys: ShortcutKeys,
    excludeDefinition?: ShortcutDefinition,
  ): ShortcutDefinition | null {
    const keysLabel = formatShortcutKeys(keys);

    for (const definition of definitions.value) {
      if (
        excludeDefinition
        && definition.id === excludeDefinition.id
        && (definition.bindingSlot ?? 0) === (excludeDefinition.bindingSlot ?? 0)
      ) {
        continue;
      }

      const existingLabel = formatShortcutKeys(resolveShortcutBindingKeys(definition));

      if (existingLabel === keysLabel) {
        return definition;
      }
    }

    return null;
  }

  function checkExtensionKeybindingCondition(when?: string): boolean {
    if (!when || when === 'always') return true;

    const selectedEntries = getSelectedEntries();
    const hasSelection = selectedEntries.length > 0;
    const hasFiles = selectedEntries.some(entry => entry.isFile);
    const hasDirs = selectedEntries.some(entry => entry.isDirectory);

    switch (when) {
      case 'fileSelected':
        return hasFiles;
      case 'directorySelected':
        return hasDirs;
      case 'singleSelected':
        return selectedEntries.length === 1;
      case 'multipleSelected':
        return selectedEntries.length > 1;
      case 'navigatorFocused':
        return hasSelection;
      default:
        return true;
    }
  }

  async function executeExtensionKeybinding(commandId: string): Promise<void> {
    try {
      await extensionsStore.executeCommand(commandId);
    }
    catch (error) {
      console.error(`Failed to execute extension command ${commandId}:`, error);
    }
  }

  async function handleExtensionKeybindings(event: KeyboardEvent): Promise<boolean> {
    for (const keybinding of extensionsStore.keybindings) {
      if (!keybinding.keys.key) continue;
      if (!matchesShortcut(event, keybinding.keys)) continue;
      if (!checkExtensionKeybindingCondition(keybinding.when)) continue;

      event.preventDefault();
      event.stopPropagation();

      await executeExtensionKeybinding(keybinding.commandId);

      return true;
    }

    return false;
  }

  async function handleExtensionMouseKeybindings(event: MouseEvent): Promise<boolean> {
    for (const keybinding of extensionsStore.keybindings) {
      if (!keybinding.keys.key) continue;
      if (!matchesMouseShortcut(event, keybinding.keys)) continue;
      if (!checkExtensionKeybindingCondition(keybinding.when)) continue;

      event.preventDefault();
      event.stopPropagation();

      await executeExtensionKeybinding(keybinding.commandId);

      return true;
    }

    return false;
  }

  async function handleKeydown(event: KeyboardEvent): Promise<boolean> {
    if (isShortcutCaptureActive.value) {
      return false;
    }

    const reloadDirectoryKeys = getShortcutKeys('reloadCurrentDirectory');

    if (reloadDirectoryKeys.key && matchesShortcut(event, reloadDirectoryKeys)) {
      event.preventDefault();
      event.stopPropagation();
    }

    const matchingShortcutCandidates = findAllMatchingShortcuts(event);

    let matchingShortcutIds = matchingShortcutCandidates;

    if (keyboardEventTouchesAddressBarPathEditor(event)) {
      matchingShortcutIds = matchingShortcutCandidates.filter(candidateShortcutId =>
        !ADDRESS_BAR_PATH_EDITOR_YIELD_NAVIGATOR_IDS.has(candidateShortcutId),
      );
    }

    const shouldPreventDefaultEarly = matchingShortcutIds.some(shortcutId =>
      EARLY_PREVENT_DEFAULT_SHORTCUT_IDS.has(shortcutId) && canCallShortcutHandler(shortcutId),
    );

    if (shouldPreventDefaultEarly) {
      event.preventDefault();
      event.stopPropagation();
    }

    const extensionHandled = await handleExtensionKeybindings(event);
    if (extensionHandled) return true;

    if (matchingShortcutIds.length === 0) return false;

    for (const shortcutId of matchingShortcutIds) {
      const result = callShortcutHandler(shortcutId);
      if (result === null) continue;

      const isHandled = result instanceof Promise
        ? (await result) !== false
        : result !== false;

      if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
      }

      return isHandled;
    }

    return false;
  }

  async function handleMouseDown(event: MouseEvent): Promise<boolean> {
    if (isShortcutCaptureActive.value) {
      return false;
    }

    const extensionHandled = await handleExtensionMouseKeybindings(event);
    if (extensionHandled) return true;

    const matchingShortcutIds = findAllMatchingMouseShortcuts(event);
    if (matchingShortcutIds.length === 0) return false;

    for (const shortcutId of matchingShortcutIds) {
      const result = callShortcutHandler(shortcutId);
      if (result === null) continue;

      const isHandled = result instanceof Promise
        ? (await result) !== false
        : result !== false;

      if (isHandled) {
        event.preventDefault();
        event.stopPropagation();
      }

      return isHandled;
    }

    return false;
  }

  function globalKeydownHandler(event: KeyboardEvent): void {
    handleKeydown(event);
  }

  function globalMouseDownHandler(event: MouseEvent): void {
    handleMouseDown(event);
  }

  function startGlobalListener(): void {
    if (isListenerActive.value) return;
    document.addEventListener('keydown', globalKeydownHandler, { capture: true });
    document.addEventListener('mousedown', globalMouseDownHandler, { capture: true });
    isListenerActive.value = true;
  }

  function stopGlobalListener(): void {
    if (!isListenerActive.value) return;
    document.removeEventListener('keydown', globalKeydownHandler, { capture: true });
    document.removeEventListener('mousedown', globalMouseDownHandler, { capture: true });
    isListenerActive.value = false;
  }

  function hasConflictWithAppShortcut(keys: ShortcutKeys): boolean {
    for (const definition of definitions.value) {
      const shortcutKeys = resolveShortcutBindingKeys(definition);

      if (
        shortcutKeys.key.toLowerCase() === keys.key.toLowerCase()
        && (shortcutKeys.ctrl || false) === (keys.ctrl || false)
        && (shortcutKeys.alt || false) === (keys.alt || false)
        && (shortcutKeys.shift || false) === (keys.shift || false)
        && (shortcutKeys.meta || false) === (keys.meta || false)
      ) {
        return true;
      }
    }

    return false;
  }

  function init(): void {
    if (isInitialized.value) return;
    isInitialized.value = true;
    startGlobalListener();
    setAppKeybindingConflictChecker(hasConflictWithAppShortcut);
  }

  function cleanup(): void {
    stopGlobalListener();
    handlers.value.clear();
    isShortcutCaptureActive.value = false;
    isInitialized.value = false;
  }

  return {
    definitions,
    userShortcuts,
    isInitialized,
    getShortcutKeys,
    getShortcutLabel,
    getShortcutDefinition,
    resolveShortcutBindingKeys,
    getShortcutBindingLabel,
    getShortcutBindingSource,
    isShortcutBindingCustomized,
    isCustomized,
    getSource,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    addUserAlternateChordBinding,
    removeUserAlternateChordBindingRow,
    registerHandler,
    unregisterHandler,
    setShortcutCaptureActive,
    executeShortcut,
    findMatchingShortcut,
    findConflictingShortcut,
    handleKeydown,
    handleMouseDown,
    startGlobalListener,
    stopGlobalListener,
    init,
    cleanup,
  };
});
