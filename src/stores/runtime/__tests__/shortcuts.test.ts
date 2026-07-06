// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';

const {
  setAppKeybindingConflictCheckerMock,
  executeCommandMock,
  extensionKeybindings,
  userSettingsStoreMock,
  routerCurrentRouteMock,
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
  routerCurrentRouteMock: {
    value: { name: 'navigator' as string | symbol | null | undefined },
  },
}));

vi.mock('@/router', () => ({
  default: {
    currentRoute: routerCurrentRouteMock,
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

import {
  BUILTIN_NAVIGATION_PAGE_SHORTCUTS,
  formatShortcutKeys,
  useShortcutsStore,
} from '@/stores/runtime/shortcuts';

describe('shortcuts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    routerCurrentRouteMock.value = { name: 'navigator' };
    extensionKeybindings.splice(0, extensionKeybindings.length);
    userSettingsStoreMock.userSettings = reactive({
      shortcuts: {},
      shortcutUserAlternateChordSlots: {},
    });
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

  it('defines Alt+number shortcuts for built-in navigation pages', () => {
    const shortcutsStore = useShortcutsStore();

    expect(BUILTIN_NAVIGATION_PAGE_SHORTCUTS.map(shortcut => ({
      id: shortcut.id,
      routeName: shortcut.routeName,
      label: shortcutsStore.getShortcutLabel(shortcut.id),
    }))).toEqual([
      {
        id: 'switchToHomePage',
        routeName: 'home',
        label: 'Alt+1',
      },
      {
        id: 'switchToNavigatorPage',
        routeName: 'navigator',
        label: 'Alt+2',
      },
      {
        id: 'switchToDashboardPage',
        routeName: 'dashboard',
        label: 'Alt+3',
      },
      {
        id: 'switchToSettingsPage',
        routeName: 'settings',
        label: 'Alt+4',
      },
      {
        id: 'switchToExtensionsPage',
        routeName: 'extensions',
        label: 'Alt+5',
      },
    ]);
  });

  it('matches Alt+number for built-in navigation page shortcuts', async () => {
    const shortcutsStore = useShortcutsStore();
    const switchToNavigatorPageHandler = vi.fn();

    shortcutsStore.registerHandler('switchToNavigatorPage', switchToNavigatorPageHandler);

    const event = new KeyboardEvent('keydown', {
      key: '2',
      code: 'Digit2',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(switchToNavigatorPageHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('defines customizable mouse page and Alt+arrow pane navigation shortcuts', () => {
    const shortcutsStore = useShortcutsStore();

    expect(shortcutsStore.getShortcutLabel('navigatePageBack')).toBe('');
    expect(shortcutsStore.getShortcutLabel('navigatePageForward')).toBe('');
    expect(shortcutsStore.getShortcutLabel('navigateHistoryBack')).toBe('Alt+←');
    expect(shortcutsStore.getShortcutLabel('navigateHistoryForward')).toBe('Alt+→');
    expect(shortcutsStore.getShortcutLabel('goUpDirectory')).toBe('Alt+↑');
  });

  it('matches default address editor shortcuts', async () => {
    const shortcutsStore = useShortcutsStore();
    const toggleAddressBarHandler = vi.fn();
    const openEntryHandler = vi.fn();
    const printHandler = vi.fn();

    shortcutsStore.registerHandler('toggleAddressBar', toggleAddressBarHandler);
    shortcutsStore.registerHandler('openEntry', openEntryHandler);
    shortcutsStore.registerHandler('print', printHandler, { checkItemSelected: () => true });

    expect(shortcutsStore.getShortcutLabel('toggleAddressBar')).toBe('Ctrl+L');
    expect(shortcutsStore.getShortcutLabel('openEntry')).toBe('Ctrl+P');
    expect(shortcutsStore.getShortcutLabel('print')).toBe('Ctrl+O');

    const editAddressEvent = new KeyboardEvent('keydown', {
      key: 'l',
      code: 'KeyL',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const openEntryEvent = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const printEvent = new KeyboardEvent('keydown', {
      key: 'o',
      code: 'KeyO',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(editAddressEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(openEntryEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(printEvent)).resolves.toBe(true);
    expect(toggleAddressBarHandler).toHaveBeenCalledTimes(1);
    expect(openEntryHandler).toHaveBeenCalledTimes(1);
    expect(printHandler).toHaveBeenCalledTimes(1);
    expect(editAddressEvent.defaultPrevented).toBe(true);
    expect(openEntryEvent.defaultPrevented).toBe(true);
    expect(printEvent.defaultPrevented).toBe(true);
  });

  it('matches mouse shortcuts for page history navigation when assigned', async () => {
    const shortcutsStore = useShortcutsStore();
    const navigatePageBackHandler = vi.fn();
    const navigatePageForwardHandler = vi.fn();

    shortcutsStore.registerHandler('navigatePageBack', navigatePageBackHandler);
    shortcutsStore.registerHandler('navigatePageForward', navigatePageForwardHandler);
    await shortcutsStore.setShortcut('navigatePageBack', { key: 'MouseButton4' });
    await shortcutsStore.setShortcut('navigatePageForward', { key: 'MouseButton5' });

    const backEvent = new MouseEvent('mousedown', {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const forwardEvent = new MouseEvent('mousedown', {
      button: 4,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleMouseDown(backEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleMouseDown(forwardEvent)).resolves.toBe(true);
    expect(navigatePageBackHandler).toHaveBeenCalledTimes(1);
    expect(navigatePageForwardHandler).toHaveBeenCalledTimes(1);
    expect(backEvent.defaultPrevented).toBe(true);
    expect(forwardEvent.defaultPrevented).toBe(true);
  });

  it('allows app shortcuts to be unassigned', async () => {
    const shortcutsStore = useShortcutsStore();
    const navigatePageBackHandler = vi.fn();

    shortcutsStore.registerHandler('navigatePageBack', navigatePageBackHandler);
    await shortcutsStore.setShortcut('navigatePageBack', { key: '' });

    const backEvent = new MouseEvent('mousedown', {
      button: 3,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleMouseDown(backEvent)).resolves.toBe(false);
    expect(shortcutsStore.getShortcutLabel('navigatePageBack')).toBe('');
    expect(formatShortcutKeys({ key: '' })).toBe('');
    expect(navigatePageBackHandler).not.toHaveBeenCalled();
    expect(backEvent.defaultPrevented).toBe(false);
  });

  it('matches Alt+arrow shortcuts for navigator pane navigation', async () => {
    const shortcutsStore = useShortcutsStore();
    const navigateHistoryBackHandler = vi.fn();
    const navigateHistoryForwardHandler = vi.fn();
    const goUpDirectoryHandler = vi.fn();

    shortcutsStore.registerHandler('navigateHistoryBack', navigateHistoryBackHandler);
    shortcutsStore.registerHandler('navigateHistoryForward', navigateHistoryForwardHandler);
    shortcutsStore.registerHandler('goUpDirectory', goUpDirectoryHandler);

    const backEvent = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      code: 'ArrowLeft',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const forwardEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const upEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      code: 'ArrowUp',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(backEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(forwardEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(upEvent)).resolves.toBe(true);
    expect(navigateHistoryBackHandler).toHaveBeenCalledTimes(1);
    expect(navigateHistoryForwardHandler).toHaveBeenCalledTimes(1);
    expect(goUpDirectoryHandler).toHaveBeenCalledTimes(1);
    expect(backEvent.defaultPrevented).toBe(true);
    expect(forwardEvent.defaultPrevented).toBe(true);
    expect(upEvent.defaultPrevented).toBe(true);
  });

  it('matches default mouse back and forward for directory history alongside Alt+arrow', async () => {
    const shortcutsStore = useShortcutsStore();
    const navigateHistoryBackHandler = vi.fn();
    const navigateHistoryForwardHandler = vi.fn();

    shortcutsStore.registerHandler('navigateHistoryBack', navigateHistoryBackHandler);
    shortcutsStore.registerHandler('navigateHistoryForward', navigateHistoryForwardHandler);

    const mouseBackEvent = new MouseEvent('mousedown', {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const mouseForwardEvent = new MouseEvent('mousedown', {
      button: 4,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleMouseDown(mouseBackEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleMouseDown(mouseForwardEvent)).resolves.toBe(true);
    expect(navigateHistoryBackHandler).toHaveBeenCalledTimes(1);
    expect(navigateHistoryForwardHandler).toHaveBeenCalledTimes(1);
    expect(mouseBackEvent.defaultPrevented).toBe(true);
    expect(mouseForwardEvent.defaultPrevented).toBe(true);
  });

  it('applies setShortcut without binding slot only to binding slot 0 and leaves slot 1 defaults', async () => {
    const shortcutsStore = useShortcutsStore();

    await shortcutsStore.setShortcut('navigateHistoryBack', {
      ctrl: true,
      key: 'h',
    });

    expect(shortcutsStore.getShortcutLabel('navigateHistoryBack')).toBe('Ctrl+H');

    const mouseBackDefinition = shortcutsStore.definitions.find(
      definition =>
        definition.id === 'navigateHistoryBack'
        && (definition.bindingSlot ?? 0) === 1,
    );

    expect(mouseBackDefinition).toBeDefined();
    expect(shortcutsStore.resolveShortcutBindingKeys(mouseBackDefinition!)).toEqual({
      key: 'MouseButton4',
    });
  });

  it('applies setShortcut with binding slot 1 without changing slot 0 keys', async () => {
    const shortcutsStore = useShortcutsStore();

    await shortcutsStore.setShortcut(
      'navigateHistoryBack',
      {
        alt: true,
        key: 'h',
      },
      1,
    );

    expect(shortcutsStore.getShortcutLabel('navigateHistoryBack')).toBe('Alt+←');

    const mouseDefinition = shortcutsStore.definitions.find(
      definition =>
        definition.id === 'navigateHistoryBack'
        && (definition.bindingSlot ?? 0) === 1,
    );

    expect(mouseDefinition).toBeDefined();
    expect(shortcutsStore.resolveShortcutBindingKeys(mouseDefinition!)).toEqual({
      alt: true,
      key: 'h',
    });
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

  it('does not run navigator-scoped shortcuts when not on the navigator route', async () => {
    routerCurrentRouteMock.value = { name: 'home' };

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

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(false);
    expect(copyCurrentDirectoryPathHandler).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents Ctrl+Shift+C default behavior on non-navigator routes without a registered handler', async () => {
    routerCurrentRouteMock.value = { name: 'home' };

    const shortcutsStore = useShortcutsStore();

    const event = new KeyboardEvent('keydown', {
      key: 'C',
      code: 'KeyC',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(false);
    expect(event.defaultPrevented).toBe(true);
  });

  it('matches default create-new item shortcuts', async () => {
    const shortcutsStore = useShortcutsStore();
    const createNewFileHandler = vi.fn();
    const createNewDirectoryHandler = vi.fn();

    shortcutsStore.registerHandler('createNewFile', createNewFileHandler);
    shortcutsStore.registerHandler('createNewDirectory', createNewDirectoryHandler);

    expect(shortcutsStore.getShortcutLabel('createNewFile')).toBe('Ctrl+Shift+M');
    expect(shortcutsStore.getShortcutLabel('createNewDirectory')).toBe('Ctrl+Shift+N');

    const newFileEvent = new KeyboardEvent('keydown', {
      key: 'M',
      code: 'KeyM',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    const newDirectoryEvent = new KeyboardEvent('keydown', {
      key: 'N',
      code: 'KeyN',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(newFileEvent)).resolves.toBe(true);
    await expect(shortcutsStore.handleKeydown(newDirectoryEvent)).resolves.toBe(true);
    expect(createNewFileHandler).toHaveBeenCalledTimes(1);
    expect(createNewDirectoryHandler).toHaveBeenCalledTimes(1);
    expect(newFileEvent.defaultPrevented).toBe(true);
    expect(newDirectoryEvent.defaultPrevented).toBe(true);
  });

  it('prevents Ctrl+Shift+C default behavior before async shortcut handlers finish', async () => {
    const shortcutsStore = useShortcutsStore();

    let resolveHandler: (value: boolean) => void = () => {};

    const copyCurrentDirectoryPathHandler = vi.fn(() => new Promise<boolean>((resolve) => {
      resolveHandler = resolve;
    }));

    shortcutsStore.registerHandler('copyCurrentDirectoryPath', copyCurrentDirectoryPathHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'C',
      code: 'KeyC',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    const handledPromise = shortcutsStore.handleKeydown(event);

    expect(event.defaultPrevented).toBe(true);

    await Promise.resolve();
    expect(copyCurrentDirectoryPathHandler).toHaveBeenCalledTimes(1);

    resolveHandler(true);
    await expect(handledPromise).resolves.toBe(true);
  });

  it('matches Ctrl+Shift+V for opening the copied path', async () => {
    const shortcutsStore = useShortcutsStore();
    const openCopiedPathHandler = vi.fn();

    shortcutsStore.registerHandler('openCopiedPath', openCopiedPathHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'V',
      code: 'KeyV',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(openCopiedPathHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('matches Ctrl+Shift+T for restoring the last closed tab', async () => {
    const shortcutsStore = useShortcutsStore();
    const restoreLastClosedTabHandler = vi.fn();

    shortcutsStore.registerHandler('restoreLastClosedTab', restoreLastClosedTabHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(restoreLastClosedTabHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('prevents default when an async shortcut handler resolves true', async () => {
    const shortcutsStore = useShortcutsStore();
    const restoreLastClosedTabHandler = vi.fn(() => Promise.resolve(true));

    shortcutsStore.registerHandler('restoreLastClosedTab', restoreLastClosedTabHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(true);
    expect(restoreLastClosedTabHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not prevent default when an async shortcut handler resolves false', async () => {
    const shortcutsStore = useShortcutsStore();
    const restoreLastClosedTabHandler = vi.fn(() => Promise.resolve(false));

    shortcutsStore.registerHandler('restoreLastClosedTab', restoreLastClosedTabHandler);

    const event = new KeyboardEvent('keydown', {
      key: 'T',
      code: 'KeyT',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleKeydown(event)).resolves.toBe(false);
    expect(restoreLastClosedTabHandler).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(false);
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

  it('executes extension mouse shortcuts from the effective extensions store keybindings', async () => {
    const shortcutsStore = useShortcutsStore();

    extensionKeybindings.push({
      extensionId: 'test.extension',
      commandId: 'test.extension.mouse-command',
      keys: {
        alt: true,
        key: 'MouseButton4',
      },
      when: 'always',
    });

    const event = new MouseEvent('mousedown', {
      button: 3,
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    await expect(shortcutsStore.handleMouseDown(event)).resolves.toBe(true);
    expect(executeCommandMock).toHaveBeenCalledWith('test.extension.mouse-command');
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
