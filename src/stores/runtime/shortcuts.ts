// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { ShortcutId, ShortcutKeys, UserShortcuts } from '@/types/user-settings';

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

export function formatShortcutKeys(keys: ShortcutKeys): string {
  const parts: string[] = [];

  if (keys.ctrl) parts.push('Ctrl');
  if (keys.alt) parts.push('Alt');
  if (keys.shift) parts.push('Shift');
  if (keys.meta) parts.push('Meta');

  let keyDisplay = keys.key;

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

  parts.push(keyDisplay);

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

  return eventKey === expectedKey || event.code.toLowerCase() === `key${expectedKey}`;
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

  async function handleKeydown(event: KeyboardEvent): Promise<boolean> {
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

  function init(): void {
    if (isInitialized.value) return;
    isInitialized.value = true;
    startGlobalListener();
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
