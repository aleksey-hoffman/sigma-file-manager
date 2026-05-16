// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { reactive } from 'vue';

const getCurrentWebviewWindowMock = vi.fn();

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => getCurrentWebviewWindowMock(),
  WebviewWindow: {
    getByLabel: vi.fn(),
  },
}));

const registerMock = vi.fn();
const unregisterMock = vi.fn();
const unregisterAllMock = vi.fn();

vi.mock('@tauri-apps/plugin-global-shortcut', () => ({
  register: (...args: unknown[]) => registerMock(...args),
  unregister: (...args: unknown[]) => unregisterMock(...args),
  unregisterAll: (...args: unknown[]) => unregisterAllMock(...args),
}));

const invokeMock = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

const consoleWarnMock = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const userSettingsStoreMock = {
  userSettings: reactive({
    globalShortcuts: {},
  }),
  setUserSettingsStorage: vi.fn(),
};

const extensionGlobalShortcuts = [] as Array<{
  extensionId: string;
  commandId: string;
  commandTitle: string;
  keys: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
    key: string;
  };
  source: 'system' | 'user';
}>;

const executeCommandMock = vi.fn();

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => ({
    installedExtensions: [
      {
        id: 'sigma.excalidraw',
        manifest: {
          name: 'Excalidraw',
        },
      },
    ],
    getGlobalCommandShortcuts: () => extensionGlobalShortcuts,
    executeCommand: executeCommandMock,
  }),
}));

import { useGlobalShortcutsStore } from '@/stores/runtime/global-shortcuts';

describe('globalShortcuts store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    getCurrentWebviewWindowMock.mockReset();
    registerMock.mockReset();
    unregisterMock.mockReset();
    unregisterAllMock.mockReset();
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(undefined);
    userSettingsStoreMock.userSettings.globalShortcuts = {};
    userSettingsStoreMock.setUserSettingsStorage.mockReset();
    extensionGlobalShortcuts.splice(0, extensionGlobalShortcuts.length);
    executeCommandMock.mockReset();
    consoleWarnMock.mockClear();
  });

  it('does not register OS global shortcuts when the webview label is not main', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'quick-view' });
    registerMock.mockResolvedValue(undefined);

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    expect(registerMock).not.toHaveBeenCalled();
    expect(globalShortcutsStore.isInitialized).toBe(false);
  });

  it('registers OS global shortcuts when the webview label is main', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    expect(registerMock).toHaveBeenCalled();
    expect(globalShortcutsStore.isInitialized).toBe(true);
  });

  it('registers extension command shortcuts as OS global shortcuts', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    extensionGlobalShortcuts.push({
      extensionId: 'sigma.excalidraw',
      commandId: 'sigma.excalidraw.openPage',
      commandTitle: 'Open Excalidraw',
      keys: {
        ctrl: true,
        shift: true,
        key: 'e',
      },
      source: 'system',
    });

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    expect(registerMock).toHaveBeenCalledWith(
      'Control+Shift+E',
      expect.any(Function),
    );
    expect(globalShortcutsStore.extensionDefinitions).toHaveLength(1);
    expect(globalShortcutsStore.getExtensionShortcutLabel('sigma.excalidraw.openPage')).toBe('Ctrl+Shift+E');
  });

  it('clears stale OS registrations before registering extension global shortcuts', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
    extensionGlobalShortcuts.push({
      extensionId: 'sigma.excalidraw',
      commandId: 'sigma.excalidraw.openPage',
      commandTitle: 'Open Excalidraw',
      keys: {
        ctrl: true,
        shift: true,
        key: 'e',
      },
      source: 'system',
    });

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    expect(unregisterMock).toHaveBeenCalledWith('Control+Shift+E');
    expect(unregisterMock.mock.invocationCallOrder[1]).toBeLessThan(
      registerMock.mock.invocationCallOrder[1],
    );
    expect(registerMock).toHaveBeenCalledWith(
      'Control+Shift+E',
      expect.any(Function),
    );
  });

  it('does not let extension command shortcuts replace app-owned shortcuts', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
    extensionGlobalShortcuts.push({
      extensionId: 'sigma.excalidraw',
      commandId: 'sigma.excalidraw.openPage',
      commandTitle: 'Open Excalidraw',
      keys: {
        meta: true,
        shift: true,
        key: 'e',
      },
      source: 'system',
    });

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    const superShiftERegistrations = registerMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Super+Shift+E',
    );
    const superShiftEUnregistrations = unregisterMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Super+Shift+E',
    );

    expect(superShiftERegistrations).toHaveLength(1);
    expect(superShiftEUnregistrations).toHaveLength(1);
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('already registered for "launchApp"'),
    );
  });

  it('registers a skipped extension shortcut after the app shortcut frees its key', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
    extensionGlobalShortcuts.push({
      extensionId: 'sigma.excalidraw',
      commandId: 'sigma.excalidraw.openPage',
      commandTitle: 'Open Excalidraw',
      keys: {
        meta: true,
        shift: true,
        key: 'e',
      },
      source: 'system',
    });

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();
    await globalShortcutsStore.setShortcut('launchApp', {
      meta: true,
      shift: true,
      key: 'f',
    });

    const superShiftERegistrations = registerMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Super+Shift+E',
    );
    const restoredExtensionHandler = superShiftERegistrations[superShiftERegistrations.length - 1]?.[1] as (
      shortcutEvent: { state: string },
    ) => Promise<void>;

    expect(superShiftERegistrations).toHaveLength(2);

    await restoredExtensionHandler({ state: 'Pressed' });

    expect(executeCommandMock).toHaveBeenCalledWith('sigma.excalidraw.openPage');
  });

  it('lets an app shortcut reset reclaim its default from an extension shortcut', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
    userSettingsStoreMock.userSettings.globalShortcuts = {
      launchApp: 'Super+Shift+F',
    };
    extensionGlobalShortcuts.push({
      extensionId: 'sigma.excalidraw',
      commandId: 'sigma.excalidraw.openPage',
      commandTitle: 'Open Excalidraw',
      keys: {
        meta: true,
        shift: true,
        key: 'e',
      },
      source: 'system',
    });

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();
    await globalShortcutsStore.resetShortcut('launchApp');

    const superShiftERegistrations = registerMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Super+Shift+E',
    );
    const resetAppHandler = superShiftERegistrations[superShiftERegistrations.length - 1]?.[1] as (
      shortcutEvent: { state: string },
    ) => Promise<void>;

    expect(superShiftERegistrations).toHaveLength(2);

    await resetAppHandler({ state: 'Pressed' });

    expect(executeCommandMock).not.toHaveBeenCalled();
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('already registered for "launchApp"'),
    );
  });

  it('allows app global shortcuts to be unassigned', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();
    await globalShortcutsStore.unsetShortcut('launchApp');

    expect(globalShortcutsStore.getShortcutLabel('launchApp')).toBe('');
    expect(userSettingsStoreMock.userSettings.globalShortcuts).toEqual({
      launchApp: '',
    });
    expect(unregisterMock).toHaveBeenCalledWith('Super+Shift+E');
    expect(invokeMock).toHaveBeenLastCalledWith('update_tray_shortcut', {
      shortcut: '',
    });
  });

  it('does not let duplicate extension command shortcuts replace each other', async () => {
    getCurrentWebviewWindowMock.mockReturnValue({ label: 'main' });
    registerMock.mockResolvedValue(undefined);
    unregisterMock.mockResolvedValue(undefined);
    extensionGlobalShortcuts.push(
      {
        extensionId: 'sigma.excalidraw',
        commandId: 'sigma.excalidraw.openPage',
        commandTitle: 'Open Excalidraw',
        keys: {
          ctrl: true,
          shift: true,
          key: 'e',
        },
        source: 'system',
      },
      {
        extensionId: 'sigma.excalidraw',
        commandId: 'sigma.excalidraw.exportPage',
        commandTitle: 'Export Excalidraw',
        keys: {
          ctrl: true,
          shift: true,
          key: 'e',
        },
        source: 'system',
      },
    );

    const globalShortcutsStore = useGlobalShortcutsStore();
    await globalShortcutsStore.init();

    const controlShiftERegistrations = registerMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Control+Shift+E',
    );
    const controlShiftEHandler = controlShiftERegistrations[0]?.[1] as (shortcutEvent: { state: string }) => Promise<void>;

    expect(controlShiftERegistrations).toHaveLength(1);
    expect(consoleWarnMock).toHaveBeenCalledWith(
      expect.stringContaining('already registered for "sigma.excalidraw.openPage"'),
    );

    await controlShiftEHandler({ state: 'Pressed' });

    expect(executeCommandMock).toHaveBeenCalledWith('sigma.excalidraw.openPage');
    expect(executeCommandMock).not.toHaveBeenCalledWith('sigma.excalidraw.exportPage');

    const controlShiftEUnregistrationsBeforeChange = unregisterMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Control+Shift+E',
    );

    await globalShortcutsStore.setExtensionShortcut('sigma.excalidraw.exportPage', {
      ctrl: true,
      alt: true,
      key: 'e',
    });

    const controlShiftEUnregistrationsAfterChange = unregisterMock.mock.calls.filter(
      ([shortcut]) => shortcut === 'Control+Shift+E',
    );

    expect(controlShiftEUnregistrationsAfterChange).toHaveLength(controlShiftEUnregistrationsBeforeChange.length);
    expect(registerMock).toHaveBeenCalledWith(
      'Control+Alt+E',
      expect.any(Function),
    );
  });
});
