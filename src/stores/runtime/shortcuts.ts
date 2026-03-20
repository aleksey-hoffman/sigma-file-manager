// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { ShortcutId, ShortcutKeys, UserShortcuts } from '@/types/user-settings';
import {
  getKeybindingRegistrations,
  getCommandRegistrations,
  getContextMenuRegistrations,
  setAppKeybindingConflictChecker,
  parseKeybindingString,
} from '@/modules/extensions/api';
import { getSelectedEntries, getCurrentPath } from '@/modules/extensions/context';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import {
  KEYBOARD_MAIN_KEY_UNUSABLE,
  shortcutMainKeyDisplayLabel,
} from '@/localization/shortcut-main-key-label';

export type { ShortcutId, ShortcutKeys, UserShortcuts };

export type ShortcutConditions = {
  inputFieldIsActive?: boolean;
  dialogIsOpened?: boolean;
  dirItemIsSelected?: boolean;
};

export type ShortcutDefinition = {
  id: ShortcutId;
  labelKey: string;
  defaultKeys: ShortcutKeys;
  scope: 'global' | 'navigator' | 'settings';
  conditions: ShortcutConditions;
  isReadOnly: boolean;
};

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
    id: 'navigateBack',
    labelKey: 'shortcuts.navigateBack',
    defaultKeys: {
      key: 'Backspace',
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
];

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

  if (keyDisplay === ' ') {
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
  const parts: string[] = [];

  if (keys.ctrl) parts.push('Ctrl');
  if (keys.alt) parts.push('Alt');
  if (keys.meta) parts.push('Win');
  if (keys.shift) parts.push('Shift');

  parts.push(formatShortcutMainKeyForDisplay(keys.key));

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

function matchesShortcut(event: KeyboardEvent, keys: ShortcutKeys): boolean {
  const eventCtrl = event.ctrlKey || event.metaKey;
  const expectedCtrl = keys.ctrl || keys.meta || false;

  if (eventCtrl !== expectedCtrl) return false;
  if (event.altKey !== (keys.alt || false)) return false;
  if (event.shiftKey !== (keys.shift || false)) return false;

  const eventKey = event.key.toLowerCase();
  const expectedKey = keys.key.toLowerCase();

  if (expectedKey === ' ' && event.code === 'Space') return true;

  if (/^[0-9]$/.test(expectedKey) && event.code === `Digit${expectedKey}`) {
    return true;
  }

  const codeLower = event.code.toLowerCase();
  return eventKey === expectedKey || codeLower === `key${expectedKey}`;
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

function isInputFieldActive(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || (activeElement as HTMLElement).isContentEditable;
}

function isDialogOpened(): boolean {
  const dialogs = document.querySelectorAll('[role="dialog"]');

  for (const dialog of dialogs) {
    if (!dialog.classList.contains('sigma-ui-popover-content')) {
      return true;
    }
  }

  return false;
}

type ShortcutHandler = () => void | boolean | Promise<void | boolean>;

type HandlerRegistration = {
  handler: ShortcutHandler;
  checkItemSelected?: () => boolean;
};

export const useShortcutsStore = defineStore('shortcuts', () => {
  const userSettingsStore = useUserSettingsStore();
  const extensionsStore = useExtensionsStore();

  const definitions = ref<ShortcutDefinition[]>(DEFAULT_SHORTCUTS);
  const handlers = ref<Map<ShortcutId, HandlerRegistration>>(new Map());
  const isInitialized = ref(false);
  const isListenerActive = ref(false);

  const userShortcuts = computed({
    get: () => userSettingsStore.userSettings.shortcuts ?? {},
    set: async (value: UserShortcuts) => {
      userSettingsStore.userSettings.shortcuts = value;
      await userSettingsStore.setUserSettingsStorage('shortcuts', value);
    },
  });

  function getShortcutKeys(shortcutId: ShortcutId): ShortcutKeys {
    const userKeys = userShortcuts.value[shortcutId];
    if (userKeys) return userKeys;

    const definition = definitions.value.find(definitionItem => definitionItem.id === shortcutId);

    return definition?.defaultKeys ?? { key: '' };
  }

  function getShortcutLabel(shortcutId: ShortcutId): string {
    return formatShortcutKeys(getShortcutKeys(shortcutId));
  }

  function getShortcutDefinition(shortcutId: ShortcutId): ShortcutDefinition | undefined {
    return definitions.value.find(definitionItem => definitionItem.id === shortcutId);
  }

  function isCustomized(shortcutId: ShortcutId): boolean {
    return userShortcuts.value[shortcutId] !== undefined;
  }

  function getSource(shortcutId: ShortcutId): 'system' | 'user' {
    return isCustomized(shortcutId) ? 'user' : 'system';
  }

  async function setShortcut(shortcutId: ShortcutId, keys: ShortcutKeys): Promise<void> {
    const newShortcuts = {
      ...userShortcuts.value,
      [shortcutId]: keys,
    };
    userShortcuts.value = newShortcuts;
  }

  async function resetShortcut(shortcutId: ShortcutId): Promise<void> {
    const newShortcuts = { ...userShortcuts.value };
    delete newShortcuts[shortcutId];
    userShortcuts.value = newShortcuts;
  }

  async function resetAllShortcuts(): Promise<void> {
    userShortcuts.value = {};
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

  function findMatchingShortcut(event: KeyboardEvent): ShortcutId | null {
    for (const definition of definitions.value) {
      const keys = getShortcutKeys(definition.id);

      if (matchesShortcut(event, keys)) {
        return definition.id;
      }
    }

    return null;
  }

  function findAllMatchingShortcuts(event: KeyboardEvent): ShortcutId[] {
    const matchingShortcuts: ShortcutId[] = [];

    for (const definition of definitions.value) {
      const keys = getShortcutKeys(definition.id);

      if (matchesShortcut(event, keys)) {
        matchingShortcuts.push(definition.id);
      }
    }

    return matchingShortcuts;
  }

  function findConflictingShortcut(keys: ShortcutKeys, excludeShortcutId?: ShortcutId): ShortcutDefinition | null {
    const keysLabel = formatShortcutKeys(keys);

    for (const definition of definitions.value) {
      if (definition.id === excludeShortcutId) continue;

      const existingLabel = getShortcutLabel(definition.id);

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

  async function handleExtensionKeybindings(event: KeyboardEvent): Promise<boolean> {
    const keybindings = getKeybindingRegistrations();

    for (const registration of keybindings) {
      if (!matchesShortcut(event, registration.keys)) continue;

      if (!checkExtensionKeybindingCondition(registration.when)) continue;

      const commandRegistrations = getCommandRegistrations();
      const commandReg = commandRegistrations.find(
        cmd => cmd.command.id === registration.commandId,
      );

      if (commandReg) {
        event.preventDefault();
        event.stopPropagation();

        try {
          await commandReg.handler();
        }
        catch (error) {
          console.error(`Failed to execute extension command ${registration.commandId}:`, error);
        }

        return true;
      }

      const contextMenuRegistrations = getContextMenuRegistrations();
      const contextMenuReg = contextMenuRegistrations.find(
        item => item.item.id === registration.commandId,
      );

      if (contextMenuReg) {
        event.preventDefault();
        event.stopPropagation();

        try {
          const selectedEntries = getSelectedEntries().map(entry => ({
            path: entry.path,
            name: entry.name,
            isDirectory: entry.isDirectory,
            size: entry.size ?? undefined,
            extension: entry.extension ?? undefined,
          }));
          const menuContext = {
            currentPath: getCurrentPath() || '',
            selectedEntries,
          };
          await contextMenuReg.handler(menuContext);
        }
        catch (error) {
          console.error(`Failed to execute extension context menu ${registration.commandId}:`, error);
        }

        return true;
      }
    }

    for (const extension of extensionsStore.enabledExtensions) {
      const manifestKeybindings = extension.manifest.contributes?.keybindings ?? [];

      for (const keybinding of manifestKeybindings) {
        const parsedKeys = parseKeybindingString(keybinding.key);

        if (!parsedKeys.key) continue;
        if (!matchesShortcut(event, parsedKeys)) continue;
        if (!checkExtensionKeybindingCondition(keybinding.when)) continue;

        event.preventDefault();
        event.stopPropagation();

        const fullCommandId = `${extension.id}.${keybinding.command}`;

        try {
          await extensionsStore.executeCommand(fullCommandId);
        }
        catch (error) {
          console.error(`Failed to execute extension command ${fullCommandId}:`, error);
        }

        return true;
      }
    }

    return false;
  }

  async function handleKeydown(event: KeyboardEvent): Promise<boolean> {
    const extensionHandled = await handleExtensionKeybindings(event);
    if (extensionHandled) return true;

    const matchingShortcutIds = findAllMatchingShortcuts(event);
    if (matchingShortcutIds.length === 0) return false;

    for (const shortcutId of matchingShortcutIds) {
      const definition = getShortcutDefinition(shortcutId);
      if (!definition) continue;

      const registration = handlers.value.get(shortcutId);
      if (!registration) continue;

      if (!checkConditions(definition, registration)) {
        continue;
      }

      const result = registration.handler();

      if (result instanceof Promise) {
        event.preventDefault();
        event.stopPropagation();
        const asyncResult = await result;
        return asyncResult !== false;
      }
      else {
        if (result !== false) {
          event.preventDefault();
          event.stopPropagation();
        }

        return result !== false;
      }
    }

    return false;
  }

  function globalKeydownHandler(event: KeyboardEvent): void {
    handleKeydown(event);
  }

  function startGlobalListener(): void {
    if (isListenerActive.value) return;
    document.addEventListener('keydown', globalKeydownHandler, { capture: true });
    isListenerActive.value = true;
  }

  function stopGlobalListener(): void {
    if (!isListenerActive.value) return;
    document.removeEventListener('keydown', globalKeydownHandler, { capture: true });
    isListenerActive.value = false;
  }

  function hasConflictWithAppShortcut(keys: ShortcutKeys): boolean {
    for (const definition of definitions.value) {
      const shortcutKeys = getShortcutKeys(definition.id);

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
    isInitialized.value = false;
  }

  return {
    definitions,
    userShortcuts,
    isInitialized,
    getShortcutKeys,
    getShortcutLabel,
    getShortcutDefinition,
    isCustomized,
    getSource,
    setShortcut,
    resetShortcut,
    resetAllShortcuts,
    registerHandler,
    unregisterHandler,
    findMatchingShortcut,
    findConflictingShortcut,
    handleKeydown,
    startGlobalListener,
    stopGlobalListener,
    init,
    cleanup,
  };
});
