// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const {
  commandRegistrations,
  keybindingRegistrations,
  setAppKeybindingConflictCheckerMock,
  userSettingsStoreMock,
} = vi.hoisted(() => ({
  commandRegistrations: [] as Array<{
    command: {
      id: string;
      title: string;
    };
    handler: (...args: unknown[]) => Promise<unknown> | unknown;
  }>,
  keybindingRegistrations: [] as Array<{
    commandId: string;
    keys: {
      ctrl?: boolean;
      alt?: boolean;
      shift?: boolean;
      meta?: boolean;
      key: string;
    };
    when?: string;
  }>,
  setAppKeybindingConflictCheckerMock: vi.fn(),
  userSettingsStoreMock: {
    userSettings: {
      shortcuts: {},
    },
    setUserSettingsStorage: vi.fn(),
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => ({
    enabledExtensions: [],
    executeCommand: vi.fn(),
  }),
}));

vi.mock('@/modules/extensions/api', () => ({
  getKeybindingRegistrations: () => keybindingRegistrations,
  getCommandRegistrations: () => commandRegistrations,
  getContextMenuRegistrations: () => [],
  setAppKeybindingConflictChecker: setAppKeybindingConflictCheckerMock,
  parseKeybindingString: () => ({ key: '' }),
}));

vi.mock('@/modules/extensions/context', () => ({
  getSelectedEntries: () => [],
  getCurrentPath: () => '',
}));

import { useShortcutsStore } from '@/stores/runtime/shortcuts';

describe('shortcuts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    commandRegistrations.splice(0, commandRegistrations.length);
    keybindingRegistrations.splice(0, keybindingRegistrations.length);
    userSettingsStoreMock.userSettings.shortcuts = {};
    userSettingsStoreMock.setUserSettingsStorage.mockReset();
    setAppKeybindingConflictCheckerMock.mockReset();
    document.body.innerHTML = '';
  });

  it('matches Ctrl+Shift+= for the default zoom-in shortcut', async () => {
    const shortcutsStore = useShortcutsStore();
    const zoomInHandler = vi.fn();

    shortcutsStore.registerHandler('uiZoomIncrease', zoomInHandler);

    const event = new KeyboardEvent('keydown', {
      key: '+',
      code: 'Equal',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(zoomInHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps zoom and fullscreen shortcuts active while a dialog is open', async () => {
    const shortcutsStore = useShortcutsStore();
    const zoomInHandler = vi.fn();
    const zoomOutHandler = vi.fn();
    const fullscreenHandler = vi.fn();

    shortcutsStore.registerHandler('uiZoomIncrease', zoomInHandler);
    shortcutsStore.registerHandler('uiZoomDecrease', zoomOutHandler);
    shortcutsStore.registerHandler('toggleFullscreen', fullscreenHandler);

    document.body.innerHTML = '<div role="dialog"></div>';

    const zoomInEvent = new KeyboardEvent('keydown', {
      key: '+',
      code: 'Equal',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const zoomOutEvent = new KeyboardEvent('keydown', {
      key: '-',
      code: 'Minus',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const fullscreenEvent = new KeyboardEvent('keydown', {
      key: 'F11',
      code: 'F11',
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(zoomInEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(zoomOutEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(fullscreenEvent)).resolves.toBe(true);

    expect(zoomInHandler).toHaveBeenCalledTimes(1);
    expect(zoomOutHandler).toHaveBeenCalledTimes(1);
    expect(fullscreenHandler).toHaveBeenCalledTimes(1);
  });

  it('does not trigger app or extension shortcuts while capture is active', async () => {
    const shortcutsStore = useShortcutsStore();
    const zoomInHandler = vi.fn();
    const extensionHandler = vi.fn();

    shortcutsStore.registerHandler('uiZoomIncrease', zoomInHandler);
    commandRegistrations.push({
      command: {
        id: 'test.extension.command',
        title: 'Test Extension Command',
      },
      handler: extensionHandler,
    });
    keybindingRegistrations.push({
      commandId: 'test.extension.command',
      keys: {
        ctrl: true,
        key: 'k',
      },
    });

    shortcutsStore.setShortcutCaptureActive(true);

    const zoomInEvent = new KeyboardEvent('keydown', {
      key: '+',
      code: 'Equal',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const extensionEvent = new KeyboardEvent('keydown', {
      key: 'k',
      code: 'KeyK',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(zoomInEvent)).resolves.toBe(false);
    await expect(shortcutsStore.handleKeydown(extensionEvent)).resolves.toBe(false);

    expect(zoomInHandler).not.toHaveBeenCalled();
    expect(extensionHandler).not.toHaveBeenCalled();
  });
});
