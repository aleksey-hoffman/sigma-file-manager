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

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
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
});
