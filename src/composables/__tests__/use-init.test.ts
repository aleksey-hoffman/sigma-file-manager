// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

const {
  appWindowInitMainWindowStateListenersMock,
  applyLaunchAtStartupPreferenceMock,
  archiveJobsEnsureEventListenersMock,
  backgroundMediaRefreshCustomBackgroundsMock,
  checkAndShowChangelogMock,
  copyMoveJobsEnsureEventListenersMock,
  deleteJobsEnsureEventListenersMock,
  disableWebViewFeaturesMock,
  extensionsInitMock,
  getDirEntryMock,
  globalSearchInitOnLaunchMock,
  globalShortcutsInitMock,
  hideWindowMock,
  initAutoCheckMock,
  invokeMock,
  openOrFocusTabGroupMock,
  platformInitMock,
  quickViewEnsureMainWindowDisplayedPathListenerMock,
  removeAppSplashMock,
  resolveLaunchTargetsFromArgsMock,
  routerPushMock,
  setPendingLaunchRevealMock,
  shortcutsInitMock,
  showWindowMock,
  terminalsInitMock,
  userPathsInitMock,
  userSettingsInitMock,
  userStatsInitMock,
  userStatsRunDeferredMaintenanceMock,
  workspacesInitMock,
  workspacesLoadCurrentTabGroupMock,
} = vi.hoisted(() => ({
  appWindowInitMainWindowStateListenersMock: vi.fn(),
  applyLaunchAtStartupPreferenceMock: vi.fn(),
  archiveJobsEnsureEventListenersMock: vi.fn(),
  backgroundMediaRefreshCustomBackgroundsMock: vi.fn(),
  checkAndShowChangelogMock: vi.fn(),
  copyMoveJobsEnsureEventListenersMock: vi.fn(),
  deleteJobsEnsureEventListenersMock: vi.fn(),
  disableWebViewFeaturesMock: vi.fn(),
  extensionsInitMock: vi.fn(),
  getDirEntryMock: vi.fn(),
  globalSearchInitOnLaunchMock: vi.fn(),
  globalShortcutsInitMock: vi.fn(),
  hideWindowMock: vi.fn(),
  initAutoCheckMock: vi.fn(),
  invokeMock: vi.fn(),
  openOrFocusTabGroupMock: vi.fn(),
  platformInitMock: vi.fn(),
  quickViewEnsureMainWindowDisplayedPathListenerMock: vi.fn(),
  removeAppSplashMock: vi.fn(),
  resolveLaunchTargetsFromArgsMock: vi.fn(),
  routerPushMock: vi.fn(),
  setPendingLaunchRevealMock: vi.fn(),
  shortcutsInitMock: vi.fn(),
  showWindowMock: vi.fn(),
  terminalsInitMock: vi.fn(),
  userPathsInitMock: vi.fn(),
  userSettingsInitMock: vi.fn(),
  userStatsInitMock: vi.fn(),
  userStatsRunDeferredMaintenanceMock: vi.fn(),
  workspacesInitMock: vi.fn(),
  workspacesLoadCurrentTabGroupMock: vi.fn(),
}));

vi.mock('vue', async () => {
  const actual = await vi.importActual<typeof import('vue')>('vue');
  return {
    ...actual,
    nextTick: () => Promise.resolve(),
    onMounted: () => {},
    onUnmounted: () => {},
  };
});

vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: routerPushMock,
  }),
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => () => {}),
}));

vi.mock('@tauri-apps/api/webviewWindow', () => ({
  getCurrentWebviewWindow: () => ({
    label: 'main',
  }),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    label: 'main',
    show: showWindowMock,
    hide: hideWindowMock,
    setFocus: vi.fn(),
  }),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    init: userPathsInitMock,
  }),
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    init: userSettingsInitMock,
    userSettings: {
      launchAtStartup: false,
      launchAtStartupHidden: false,
    },
  }),
}));

vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => ({
    init: userStatsInitMock,
    runDeferredMaintenance: userStatsRunDeferredMaintenanceMock,
  }),
}));

vi.mock('@/stores/storage/workspaces', () => ({
  useWorkspacesStore: () => ({
    init: workspacesInitMock,
    loadCurrentTabGroup: workspacesLoadCurrentTabGroupMock,
    openOrFocusTabGroup: openOrFocusTabGroupMock,
    getDirEntry: getDirEntryMock,
    setPendingLaunchReveal: setPendingLaunchRevealMock,
  }),
}));

vi.mock('@/stores/runtime/platform', () => ({
  usePlatformStore: () => ({
    init: platformInitMock,
  }),
}));

vi.mock('@/stores/runtime/global-search', () => ({
  useGlobalSearchStore: () => ({
    isOpen: false,
    initOnLaunch: globalSearchInitOnLaunchMock,
    open: vi.fn(),
    close: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/app-window', () => ({
  useAppWindowStore: () => ({
    initMainWindowStateListeners: appWindowInitMainWindowStateListenersMock,
    disposeMainWindowStateListeners: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/shortcuts', () => ({
  useShortcutsStore: () => ({
    init: shortcutsInitMock,
    registerHandler: vi.fn(),
    unregisterHandler: vi.fn(),
  }),
}));

vi.mock('@/stores/runtime/global-shortcuts', () => ({
  useGlobalShortcutsStore: () => ({
    init: globalShortcutsInitMock,
  }),
}));

vi.mock('@/stores/runtime/terminals', () => ({
  useTerminalsStore: () => ({
    init: terminalsInitMock,
  }),
}));

vi.mock('@/stores/runtime/background-media', () => ({
  useBackgroundMediaStore: () => ({
    refreshCustomBackgrounds: backgroundMediaRefreshCustomBackgroundsMock,
  }),
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => ({
    init: extensionsInitMock,
  }),
}));

vi.mock('@/stores/runtime/archive-jobs', () => ({
  useArchiveJobsStore: () => ({
    ensureEventListeners: archiveJobsEnsureEventListenersMock,
  }),
}));

vi.mock('@/stores/runtime/delete-jobs', () => ({
  useDeleteJobsStore: () => ({
    ensureEventListeners: deleteJobsEnsureEventListenersMock,
  }),
}));

vi.mock('@/stores/runtime/copy-move-jobs', () => ({
  useCopyMoveJobsStore: () => ({
    ensureEventListeners: copyMoveJobsEnsureEventListenersMock,
  }),
}));

vi.mock('@/stores/runtime/quick-view', () => ({
  useQuickViewStore: () => ({
    ensureMainWindowDisplayedPathListener: quickViewEnsureMainWindowDisplayedPathListenerMock,
  }),
}));

vi.mock('@/utils/disable-web-view-features', () => ({
  disableWebViewFeatures: disableWebViewFeaturesMock,
}));

vi.mock('@/modules/changelog', () => ({
  useChangelog: () => ({
    checkAndShowChangelog: checkAndShowChangelogMock,
  }),
}));

vi.mock('@/modules/app-updater', () => ({
  useAppUpdater: () => ({
    initAutoCheck: initAutoCheckMock,
  }),
}));

vi.mock('@/utils/autostart-sync', () => ({
  applyLaunchAtStartupPreference: applyLaunchAtStartupPreferenceMock,
}));

vi.mock('@/utils/launch-directories', () => ({
  resolveLaunchTargetsFromArgs: resolveLaunchTargetsFromArgsMock,
}));

vi.mock('@/utils/ui-zoom', () => ({
  applyUiZoomStep: vi.fn(),
}));

vi.mock('@/utils/window-fullscreen', () => ({
  toggleMainWindowFullscreen: vi.fn(),
}));

vi.mock('@/utils/app-splash', () => ({
  removeAppSplash: removeAppSplashMock,
}));

describe('useInit startup restoration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    appWindowInitMainWindowStateListenersMock.mockReset();
    applyLaunchAtStartupPreferenceMock.mockReset().mockResolvedValue(undefined);
    archiveJobsEnsureEventListenersMock.mockReset().mockResolvedValue(undefined);
    backgroundMediaRefreshCustomBackgroundsMock.mockReset().mockResolvedValue(undefined);
    checkAndShowChangelogMock.mockReset().mockResolvedValue(undefined);
    copyMoveJobsEnsureEventListenersMock.mockReset().mockResolvedValue(undefined);
    deleteJobsEnsureEventListenersMock.mockReset().mockResolvedValue(undefined);
    disableWebViewFeaturesMock.mockReset();
    extensionsInitMock.mockReset().mockResolvedValue(undefined);
    getDirEntryMock.mockReset().mockResolvedValue(null);
    globalSearchInitOnLaunchMock.mockReset().mockResolvedValue(undefined);
    globalShortcutsInitMock.mockReset().mockResolvedValue(undefined);
    hideWindowMock.mockReset().mockResolvedValue(undefined);
    initAutoCheckMock.mockReset().mockResolvedValue(undefined);
    invokeMock.mockReset();
    openOrFocusTabGroupMock.mockReset().mockResolvedValue(undefined);
    platformInitMock.mockReset().mockResolvedValue(undefined);
    quickViewEnsureMainWindowDisplayedPathListenerMock.mockReset().mockResolvedValue(undefined);
    removeAppSplashMock.mockReset();
    resolveLaunchTargetsFromArgsMock.mockReset().mockResolvedValue([]);
    routerPushMock.mockReset().mockResolvedValue(undefined);
    setPendingLaunchRevealMock.mockReset();
    shortcutsInitMock.mockReset().mockResolvedValue(undefined);
    showWindowMock.mockReset().mockResolvedValue(undefined);
    terminalsInitMock.mockReset().mockResolvedValue(undefined);
    userPathsInitMock.mockReset().mockResolvedValue(undefined);
    userSettingsInitMock.mockReset().mockResolvedValue(undefined);
    userStatsInitMock.mockReset().mockResolvedValue(undefined);
    userStatsRunDeferredMaintenanceMock.mockReset().mockResolvedValue(undefined);
    workspacesInitMock.mockReset().mockResolvedValue(undefined);
    workspacesLoadCurrentTabGroupMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads the saved tab group before deferred launch targets', async () => {
    const callOrder: string[] = [];
    const launchContext = createLaunchContext({
      args: ['sigma-file-manager.exe', 'C:/Launch'],
    });

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_launch_context') {
        return launchContext;
      }

      return null;
    });

    workspacesLoadCurrentTabGroupMock.mockImplementation(async () => {
      callOrder.push('loadCurrentTabGroup');
    });

    openOrFocusTabGroupMock.mockImplementation(async (path: string) => {
      callOrder.push(`openOrFocusTabGroup:${path}`);
    });

    showWindowMock.mockImplementation(async () => {
      callOrder.push('showMainWindow');
    });

    resolveLaunchTargetsFromArgsMock.mockResolvedValue([
      {
        directoryPath: 'C:/Launch',
        focusPath: null,
      },
    ]);

    const { useInit } = await import('@/composables/use-init');
    const { init } = useInit();
    const initPromise = init();

    await flushAsyncWork();
    await initPromise;
    await flushAsyncWork();

    expect(workspacesInitMock).toHaveBeenCalledWith(undefined, { loadInitialTabGroup: false });
    expect(callOrder.indexOf('loadCurrentTabGroup')).toBeGreaterThan(-1);
    expect(callOrder.indexOf('openOrFocusTabGroup:C:/Launch')).toBeGreaterThan(-1);
    expect(callOrder.indexOf('loadCurrentTabGroup')).toBeLessThan(
      callOrder.indexOf('openOrFocusTabGroup:C:/Launch'),
    );
  });

  it('opens absorbed shell launch targets before the first window show', async () => {
    const callOrder: string[] = [];
    const launchContext = createLaunchContext({
      args: ['sigma-file-manager.exe', 'C:/Launch'],
      hadAbsorbedShellPaths: true,
    });

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_launch_context') {
        return launchContext;
      }

      return null;
    });

    workspacesLoadCurrentTabGroupMock.mockImplementation(async () => {
      callOrder.push('loadCurrentTabGroup');
    });

    openOrFocusTabGroupMock.mockImplementation(async (path: string) => {
      callOrder.push(`openOrFocusTabGroup:${path}`);
    });

    showWindowMock.mockImplementation(async () => {
      callOrder.push('showMainWindow');
    });

    resolveLaunchTargetsFromArgsMock.mockResolvedValue([
      {
        directoryPath: 'C:/Launch',
        focusPath: null,
      },
    ]);

    const { useInit } = await import('@/composables/use-init');
    const { init } = useInit();
    const initPromise = init();

    await flushAsyncWork();
    await initPromise;
    await flushAsyncWork();

    expect(workspacesLoadCurrentTabGroupMock).toHaveBeenCalledTimes(1);
    expect(openOrFocusTabGroupMock).toHaveBeenCalledTimes(1);
    expect(showWindowMock).toHaveBeenCalledTimes(1);
    expect(callOrder.indexOf('loadCurrentTabGroup')).toBeLessThan(callOrder.indexOf('showMainWindow'));
    expect(callOrder.indexOf('openOrFocusTabGroup:C:/Launch')).toBeLessThan(
      callOrder.indexOf('showMainWindow'),
    );
  });

  it('removes the app splash after init completes', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_launch_context') {
        return createLaunchContext({});
      }

      return null;
    });

    const { useInit } = await import('@/composables/use-init');
    const { init } = useInit();
    const initPromise = init();

    await flushAsyncWork();
    await initPromise;
    await flushAsyncWork();

    expect(showWindowMock).toHaveBeenCalledTimes(1);
    expect(hideWindowMock).not.toHaveBeenCalled();
    expect(removeAppSplashMock).toHaveBeenCalledTimes(1);
  });

  it('hides the main window when launched only with delegated shell paths', async () => {
    const launchContext = createLaunchContext({
      args: ['sigma-file-manager.exe'],
      hadDelegatedShellPaths: true,
    });

    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_launch_context') {
        return launchContext;
      }

      return null;
    });

    const { useInit } = await import('@/composables/use-init');
    const { init } = useInit();
    const initPromise = init();

    await flushAsyncWork();
    await initPromise;
    await flushAsyncWork();

    expect(hideWindowMock).toHaveBeenCalledTimes(1);
    expect(showWindowMock).not.toHaveBeenCalled();
    expect(removeAppSplashMock).toHaveBeenCalledTimes(1);
  });

  it('schedules background startup work after init resolves', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_launch_context') {
        return createLaunchContext({});
      }

      return null;
    });

    const callOrder: string[] = [];

    globalSearchInitOnLaunchMock.mockImplementation(async () => {
      callOrder.push('globalSearch');
    });

    const { useInit } = await import('@/composables/use-init');
    const { init, awaitBackgroundTasks } = useInit();

    const initPromise = init();
    await vi.runOnlyPendingTimersAsync();
    await initPromise;

    expect(callOrder).toEqual([]);

    const backgroundTasksPromise = awaitBackgroundTasks();
    await vi.runAllTimersAsync();
    await backgroundTasksPromise;

    expect(callOrder).toContain('globalSearch');
  });
});

function createLaunchContext(overrides: Partial<{
  args: string[];
  cwd: string | null;
  executableDir: string | null;
  hadAbsorbedShellPaths: boolean;
  hadDelegatedShellPaths: boolean;
}>) {
  return {
    args: ['sigma-file-manager.exe'],
    cwd: null,
    executableDir: null,
    hadAbsorbedShellPaths: false,
    hadDelegatedShellPaths: false,
    ...overrides,
  };
}

async function flushAsyncWork() {
  for (let attemptIndex = 0; attemptIndex < 5; attemptIndex += 1) {
    await Promise.resolve();
    await vi.runAllTimersAsync();
  }
}
