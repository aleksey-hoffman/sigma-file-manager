// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const {
  getVersionMock,
  invokeMock,
  listenMock,
  openUrlMock,
  platformStoreState,
  toastCustomMock,
  toastDismissMock,
  toastErrorMock,
  userSettingsSetMock,
  userSettingsStoreState,
} = vi.hoisted(() => {
  const userSettings = {
    appUpdates: {
      autoCheck: true,
      lastCheckTimestamp: 0,
    },
  };

  return {
    getVersionMock: vi.fn(async () => '2.0.0'),
    invokeMock: vi.fn(),
    listenMock: vi.fn(async () => vi.fn()),
    openUrlMock: vi.fn(),
    platformStoreState: {
      appUpdatesManagedExternally: false,
    },
    toastCustomMock: vi.fn(),
    toastDismissMock: vi.fn(),
    toastErrorMock: vi.fn(),
    userSettingsSetMock: vi.fn(async () => undefined),
    userSettingsStoreState: {
      userSettings,
      set: vi.fn(async () => undefined),
    },
  };
});

userSettingsStoreState.set = userSettingsSetMock;

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: getVersionMock,
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: listenMock,
}));

vi.mock('@tauri-apps/plugin-opener', () => ({
  openUrl: openUrlMock,
}));

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/components/ui/toaster', () => ({
  toast: {
    custom: toastCustomMock,
    dismiss: toastDismissMock,
    error: toastErrorMock,
  },
  ToastProgress: {},
  ToastStatic: {},
}));

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => platformStoreState,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreState,
}));

describe('useAppUpdater external update management', () => {
  beforeEach(() => {
    vi.resetModules();
    getVersionMock.mockReset().mockResolvedValue('2.0.0');
    invokeMock.mockReset();
    listenMock.mockReset().mockResolvedValue(vi.fn());
    openUrlMock.mockReset();
    toastCustomMock.mockReset();
    toastDismissMock.mockReset();
    toastErrorMock.mockReset();
    userSettingsSetMock.mockReset().mockResolvedValue(undefined);
    userSettingsStoreState.userSettings.appUpdates.autoCheck = true;
    userSettingsStoreState.userSettings.appUpdates.lastCheckTimestamp = 0;
    platformStoreState.appUpdatesManagedExternally = false;
  });

  it('skips update checks when updates are managed externally', async () => {
    platformStoreState.appUpdatesManagedExternally = true;

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates } = useAppUpdater();

    await expect(checkForUpdates()).resolves.toBeNull();

    expect(getVersionMock).not.toHaveBeenCalled();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(userSettingsSetMock).not.toHaveBeenCalled();
  });

  it('does not start auto-checking for externally managed builds', async () => {
    platformStoreState.appUpdatesManagedExternally = true;

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { initAutoCheck } = useAppUpdater();

    await initAutoCheck();

    expect(getVersionMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastCustomMock).not.toHaveBeenCalled();
    expect(userSettingsSetMock).not.toHaveBeenCalled();
  });

  it('blocks installer downloads for externally managed builds', async () => {
    platformStoreState.appUpdatesManagedExternally = true;

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { downloadReleaseInstaller } = useAppUpdater();

    await downloadReleaseInstaller({
      latestVersion: '2.0.1',
      currentVersion: '2.0.0',
      releaseUrl: 'https://example.com/release',
      installerDownloadUrl: 'https://example.com/installer.exe',
      installerFileName: 'sigma-file-manager-setup.exe',
    });

    expect(invokeMock).not.toHaveBeenCalled();
    expect(listenMock).not.toHaveBeenCalled();
    expect(toastCustomMock).not.toHaveBeenCalled();
    expect(toastErrorMock).not.toHaveBeenCalled();
  });
});
