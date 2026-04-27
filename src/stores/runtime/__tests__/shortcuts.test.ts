// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

const {
  setAppKeybindingConflictCheckerMock,
  executeCommandMock,
  extensionKeybindings,
  userSettingsStoreMock,
} = vi.hoisted(() => ({
  extensionKeybindings: [] as Array<{
    extensionId: string;
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
  executeCommandMock: vi.fn(),
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
    keybindings: extensionKeybindings,
    executeCommand: executeCommandMock,
  }),
}));

vi.mock('@/modules/extensions/api', () => ({
  setAppKeybindingConflictChecker: setAppKeybindingConflictCheckerMock,
}));

vi.mock('@/modules/extensions/context', () => ({
  getSelectedEntries: () => [],
  getCurrentPath: () => '',
}));

import { useShortcutsStore } from '@/stores/runtime/shortcuts';

describe('shortcuts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    extensionKeybindings.splice(0, extensionKeybindings.length);
    userSettingsStoreMock.userSettings.shortcuts = {};
    userSettingsStoreMock.setUserSettingsStorage.mockReset();
    setAppKeybindingConflictCheckerMock.mockReset();
    executeCommandMock.mockReset();
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

  it('matches Ctrl+Shift+C for copying the current directory path', async () => {
    const shortcutsStore = useShortcutsStore();
    const copyCurrentDirectoryPathHandler = vi.fn();

    shortcutsStore.registerHandler('copyCurrentDirectoryPath', copyCurrentDirectoryPathHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'C',
      code: 'KeyC',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(copyCurrentDirectoryPathHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not trigger app or extension shortcuts while capture is active', async () => {
    const shortcutsStore = useShortcutsStore();
    const zoomInHandler = vi.fn();

    shortcutsStore.registerHandler('uiZoomIncrease', zoomInHandler);
    extensionKeybindings.push({
      extensionId: 'test.extension',
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
    expect(executeCommandMock).not.toHaveBeenCalled();
  });

  it('executes a registered shortcut action without matching keyboard keys', async () => {
    userSettingsStoreMock.userSettings.shortcuts = {
      toggleCommandPalette: {
        ctrl: true,
        alt: true,
        key: 'k',
      },
    };

    const shortcutsStore = useShortcutsStore();
    const toggleCommandPaletteHandler = vi.fn();

    shortcutsStore.registerHandler('toggleCommandPalette', toggleCommandPaletteHandler);

    const defaultShortcutEvent = new KeyboardEvent('keydown', {
      key: 'P',
      code: 'KeyP',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(defaultShortcutEvent)).resolves.toBe(false);
    expect(toggleCommandPaletteHandler).not.toHaveBeenCalled();

    await expect(shortcutsStore.executeShortcut('toggleCommandPalette')).resolves.toBe(true);
    expect(toggleCommandPaletteHandler).toHaveBeenCalledTimes(1);
  });

  it('executes extension shortcuts from the effective extensions store keybindings', async () => {
    const shortcutsStore = useShortcutsStore();

    extensionKeybindings.push({
      extensionId: 'test.extension',
      commandId: 'test.extension.command',
      keys: {
        ctrl: true,
        shift: true,
        key: 'e',
      },
      when: 'always',
    });

    const event = new KeyboardEvent('keydown', {
      key: 'E',
      code: 'KeyE',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(executeCommandMock).toHaveBeenCalledWith('test.extension.command');
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents default synchronously for the reload directory shortcut before async work', async () => {
    const shortcutsStore = useShortcutsStore();

    const event = new KeyboardEvent('keydown', {
      key: 'F5',
      code: 'F5',
      bubbles: true,
      cancelable: true,
    });

    const handlePromise = shortcutsStore.handleKeydown(event);

    expect(event.defaultPrevented).toBe(true);

    await expect(handlePromise).resolves.toBe(false);
  });
});
