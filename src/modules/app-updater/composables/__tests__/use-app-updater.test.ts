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

  it('does not auto-check or show toast when automatic updates are disabled', async () => {
    userSettingsStoreState.userSettings.appUpdates.autoCheck = false;

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { initAutoCheck } = useAppUpdater();

    await initAutoCheck();

    expect(invokeMock).not.toHaveBeenCalled();
    expect(toastCustomMock).not.toHaveBeenCalled();
  });

  it('dismisses update toast when automatic updates are turned off', async () => {
    invokeMock.mockResolvedValue({
      updateAvailable: true,
      latestVersion: '2.1.0',
      releaseUrl: 'https://example.com/release',
      installerDownloadUrl: 'https://example.com/installer.exe',
      installerFileName: 'Sigma-File-Manager-2.1.0-windows-setup.exe',
    });

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates, onAutoCheckSettingChanged } = useAppUpdater();

    await checkForUpdates();
    await onAutoCheckSettingChanged(false);

    expect(toastDismissMock).toHaveBeenCalledWith('app-update-2.1.0');
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

describe('useAppUpdater site manifest fields', () => {
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

  it('carries notes, sha256 and source through to UpdateInfo', async () => {
    invokeMock.mockResolvedValue({
      updateAvailable: true,
      latestVersion: '2.2.0',
      releaseUrl: 'https://www.aiec.fun/alpha-file-manager/',
      installerDownloadUrl:
        'https://www.aiec.fun/alpha-file-manager/Alpha_File_Manager_2.2.0_x64-setup.exe',
      installerFileName: 'Alpha_File_Manager_2.2.0_x64-setup.exe',
      notes: 'v2.2.0 —— 目录树刷新修复',
      pubDate: '2026-10-10T01:16:52Z',
      sha256: '1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635',
      source: 'aiec.fun',
    });

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates } = useAppUpdater();

    const result = await checkForUpdates();

    expect(result).not.toBeNull();
    expect(result?.notes).toBe('v2.2.0 —— 目录树刷新修复');
    expect(result?.sha256).toBe(
      '1b6a64f7a8d29fb0ab102e402294b674cb4cc30656ab21243aa759c0ef9c8635',
    );
    expect(result?.source).toBe('aiec.fun');
    expect(result?.releaseUrl).toBe('https://www.aiec.fun/alpha-file-manager/');
  });

  it('passes expectedSha256 to the download command', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'check_for_updates') {
        return {
          updateAvailable: true,
          latestVersion: '2.2.0',
          releaseUrl: 'https://www.aiec.fun/alpha-file-manager/',
          installerDownloadUrl: 'https://www.aiec.fun/alpha-file-manager/app.exe',
          installerFileName: 'app.exe',
          notes: 'x',
          sha256: 'abc123',
          source: 'aiec.fun',
        };
      }

      return 'C:/Users/test/Downloads/app.exe';
    });

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates, downloadReleaseInstaller } = useAppUpdater();

    const info = await checkForUpdates();
    expect(info).not.toBeNull();
    await downloadReleaseInstaller(info!);

    expect(invokeMock).toHaveBeenCalledWith('download_release_installer', expect.objectContaining({
      downloadUrl: 'https://www.aiec.fun/alpha-file-manager/app.exe',
      fileName: 'app.exe',
      expectedSha256: 'abc123',
    }));
  });

  it('sends null expectedSha256 when the source provides no digest', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'check_for_updates') {
        return {
          updateAvailable: true,
          latestVersion: '2.3.0',
          releaseUrl: 'https://www.aiec.fun/alpha-file-manager/',
          installerDownloadUrl: 'https://www.aiec.fun/alpha-file-manager/app.exe',
          installerFileName: 'app.exe',
          notes: null,
          sha256: null,
          source: 'GitHub',
        };
      }

      return 'C:/Users/test/Downloads/app.exe';
    });

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates, downloadReleaseInstaller } = useAppUpdater();

    const info = await checkForUpdates();
    await downloadReleaseInstaller(info!);

    expect(invokeMock).toHaveBeenCalledWith('download_release_installer', expect.objectContaining({
      expectedSha256: null,
    }));
  });

  it('treats a source error as failure instead of reporting an update', async () => {
    invokeMock.mockRejectedValue(
      '主源(aiec.fun)失败: 请求失败: timeout; 兜底源(GitHub)也失败: 请求失败: timeout',
    );

    const { useAppUpdater } = await import('@/modules/app-updater/composables/use-app-updater');
    const { checkForUpdates, updateAvailable, lastCheckError } = useAppUpdater();

    const result = await checkForUpdates();

    expect(result).toBeNull();
    expect(updateAvailable.value).toBe(false);
    // 错误文案必须点名是哪个源挂了，否则用户看到「GitHub 报错」却其实挂的是站点
    expect(lastCheckError.value).toContain('aiec.fun');
    expect(lastCheckError.value).toContain('GitHub');
  });
});
