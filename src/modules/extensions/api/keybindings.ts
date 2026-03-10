// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionKeybinding, ExtensionKeybindingWhen } from '@/types/extension';
import type { ShortcutKeys } from '@/types/user-settings';

export type KeybindingRegistration = {
  extensionId: string;
  commandId: string;
  keys: ShortcutKeys;
  when?: ExtensionKeybindingWhen;
};

type KeybindingConflictChecker = (keys: ShortcutKeys) => boolean;

const keybindingRegistrations: KeybindingRegistration[] = [];
let appKeybindingConflictChecker: KeybindingConflictChecker | null = null;

export function setAppKeybindingConflictChecker(checker: KeybindingConflictChecker): void {
  appKeybindingConflictChecker = checker;
}

function hasConflictWithAppShortcuts(keys: ShortcutKeys): boolean {
  if (!appKeybindingConflictChecker) return false;
  return appKeybindingConflictChecker(keys);
}

function hasConflictWithOtherExtensions(keys: ShortcutKeys): boolean {
  return keybindingRegistrations.some((registration) => {
    return (
      registration.keys.key.toLowerCase() === keys.key.toLowerCase()
      && (registration.keys.ctrl || false) === (keys.ctrl || false)
      && (registration.keys.alt || false) === (keys.alt || false)
      && (registration.keys.shift || false) === (keys.shift || false)
      && (registration.keys.meta || false) === (keys.meta || false)
    );
  });
}

export function parseKeybindingString(keyString: string): ShortcutKeys {
  const parts = keyString.toLowerCase().split('+').map(part => part.trim());
  const keys: ShortcutKeys = { key: '' };

  for (let partIndex = 0; partIndex < parts.length; partIndex++) {
    const part = parts[partIndex];

    if (part === 'ctrl' || part === 'control') {
      keys.ctrl = true;
    }
    else if (part === 'alt') {
      keys.alt = true;
    }
    else if (part === 'shift') {
      keys.shift = true;
    }
    else if (part === 'meta' || part === 'cmd' || part === 'win') {
      keys.meta = true;
    }
    else {
      keys.key = part.length === 1 ? part : part.charAt(0).toUpperCase() + part.slice(1);
    }
  }

  return keys;
}

export function formatKeybindingKeys(keys: ShortcutKeys): string {
  return getKeybindingParts(keys).join('+');
}

export function getKeybindingParts(keys: ShortcutKeys): string[] {
  const parts: string[] = [];

  if (keys.ctrl) parts.push('Ctrl');
  if (keys.alt) parts.push('Alt');
  if (keys.shift) parts.push('Shift');
  if (keys.meta) parts.push('Meta');

  let keyDisplay = keys.key;

  if (keyDisplay.length === 1) {
    keyDisplay = keyDisplay.toUpperCase();
  }

  if (keyDisplay === 'Enter') {
    keyDisplay = '↵';
  }

  parts.push(keyDisplay);
  return parts;
}

export function registerExtensionKeybindings(extensionId: string, keybindings: ExtensionKeybinding[]): void {
  for (const keybinding of keybindings) {
    const commandId = `${extensionId}.${keybinding.command}`;
    const keys = parseKeybindingString(keybinding.key);

    if (hasConflictWithAppShortcuts(keys)) {
      console.warn(
        `[Extensions] Skipping keybinding "${keybinding.key}" for "${commandId}" - conflicts with app shortcut`,
      );
      keybindingRegistrations.push({
        extensionId,
        commandId,
        keys: { key: '' },
        when: keybinding.when,
      });
      continue;
    }

    if (hasConflictWithOtherExtensions(keys)) {
      console.warn(
        `[Extensions] Skipping keybinding "${keybinding.key}" for "${commandId}" - conflicts with another extension`,
      );
      keybindingRegistrations.push({
        extensionId,
        commandId,
        keys: { key: '' },
        when: keybinding.when,
      });
      continue;
    }

    keybindingRegistrations.push({
      extensionId,
      commandId,
      keys,
      when: keybinding.when,
    });
  }
}

export function getKeybindingRegistrations(): KeybindingRegistration[] {
  return [...keybindingRegistrations];
}

export function getKeybindingForCommand(commandId: string): KeybindingRegistration | undefined {
  return keybindingRegistrations.find(registration => registration.commandId === commandId);
}

export function getKeybindingForContextMenuItem(extensionId: string, contextMenuId: string): KeybindingRegistration | undefined {
  const commandId = `${extensionId}.${contextMenuId}`;
  return keybindingRegistrations.find(registration => registration.commandId === commandId);
}

export function clearKeybindingRegistrationsForExtension(extensionId: string): void {
  for (let keybindingIndex = keybindingRegistrations.length - 1; keybindingIndex >= 0; keybindingIndex--) {
    if (keybindingRegistrations[keybindingIndex].extensionId === extensionId) {
      keybindingRegistrations.splice(keybindingIndex, 1);
    }
  }
}

export function clearAllKeybindingRegistrations(): void {
  keybindingRegistrations.length = 0;
}
