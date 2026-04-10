// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';

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

const userSettingsStoreMock = {
  userSettings: {
    globalShortcuts: {},
  },
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
});
