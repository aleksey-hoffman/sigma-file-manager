// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { nextTick, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useAppWindowStore } from '@/stores/runtime/app-window';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useGlobalShortcutsStore } from '@/stores/runtime/global-shortcuts';
import { useTerminalsStore } from '@/stores/runtime/terminals';
import { useBackgroundMediaStore } from '@/stores/runtime/background-media';
import { disableWebViewFeatures } from '@/utils/disable-web-view-features';
import { useChangelog } from '@/modules/changelog';
import { useAppUpdater } from '@/modules/app-updater';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useArchiveJobsStore } from '@/stores/runtime/archive-jobs';
import { useDeleteJobsStore } from '@/stores/runtime/delete-jobs';
import { useCopyMoveJobsStore } from '@/stores/runtime/copy-move-jobs';
import { useQuickViewStore } from '@/stores/runtime/quick-view';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SIGMA_AUTOSTART_CLI_FLAG } from '@/constants/autostart';
import { applyLaunchAtStartupPreference } from '@/utils/autostart-sync';
import {
  resolveLaunchTargetsFromArgs,
  type LaunchContext,
} from '@/utils/launch-directories';
import { applyUiZoomStep } from '@/utils/ui-zoom';
import { toggleMainWindowFullscreen } from '@/utils/window-fullscreen';
import { removeAppSplash } from '@/utils/app-splash';

const APP_LAUNCH_ARGS_EVENT = 'app-launch-args';
const STARTUP_BACKGROUND_REFRESH_TIMEOUT_MS = 1500;
const STARTUP_DIR_ENTRY_TIMEOUT_MS = 2000;

export function useInit() {
  const router = useRouter();
  const userSettingsStore = useUserSettingsStore();
  const userStatsStore = useUserStatsStore();
  const workspacesStore = useWorkspacesStore();
  const userPathsStore = useUserPathsStore();
  const platformStore = usePlatformStore();
  const globalSearchStore = useGlobalSearchStore();
  const appWindowStore = useAppWindowStore();
  const shortcutsStore = useShortcutsStore();
  const globalShortcutsStore = useGlobalShortcutsStore();
  const terminalsStore = useTerminalsStore();
  const backgroundMediaStore = useBackgroundMediaStore();
  const extensionsStore = useExtensionsStore();
  const archiveJobsStore = useArchiveJobsStore();
  const deleteJobsStore = useDeleteJobsStore();
  const copyMoveJobsStore = useCopyMoveJobsStore();
  const quickViewStore = useQuickViewStore();
  const { checkAndShowChangelog } = useChangelog();
  const { initAutoCheck } = useAppUpdater();
  let appLaunchArgsUnlisten: UnlistenFn | null = null;
  const backgroundTasks = new Set<Promise<void>>();

  function isMainWebviewWindow(): boolean {
    return getCurrentWebviewWindow().label === 'main';
  }

  function registerShortcutHandlers() {
    shortcutsStore.registerHandler('toggleGlobalSearch', () => {
      if (!globalSearchStore.isOpen) {
        router.push({ name: 'navigator' });
        globalSearchStore.open();
      }
      else {
        globalSearchStore.close();
      }
    });
    shortcutsStore.registerHandler('uiZoomIncrease', () => {
      void applyUiZoomStep(1);
    });
    shortcutsStore.registerHandler('uiZoomDecrease', () => {
      void applyUiZoomStep(-1);
    });
    shortcutsStore.registerHandler('toggleFullscreen', () => {
      void toggleMainWindowFullscreen();
    });
  }

  function unregisterShortcutHandlers() {
    shortcutsStore.unregisterHandler('toggleGlobalSearch');
    shortcutsStore.unregisterHandler('uiZoomIncrease');
    shortcutsStore.unregisterHandler('uiZoomDecrease');
    shortcutsStore.unregisterHandler('toggleFullscreen');
  }

  function shouldKeepMainWindowHidden(
    launchContext: LaunchContext,
    openedLaunchTargets: boolean,
  ): boolean {
    if (openedLaunchTargets) {
      return false;
    }

    if (launchContext.hadAbsorbedShellPaths) {
      return false;
    }

    return launchContext.hadDelegatedShellPaths && launchContext.args.length <= 1;
  }

  async function revealMainWindow(
    launchContextOverride?: LaunchContext,
    openedLaunchTargets = false,
  ) {
    await nextTick();
    await new Promise(resolve => setTimeout(resolve, 0));

    const currentWindow = getCurrentWindow();

    if (currentWindow.label === 'main') {
      const launchContext = launchContextOverride ?? await invoke<LaunchContext>('get_launch_context');
      const launchedFromOsAutostart = launchContext.args.includes(SIGMA_AUTOSTART_CLI_FLAG);
      const stayHiddenAfterAutostart = launchedFromOsAutostart
        && userSettingsStore.userSettings.launchAtStartupHidden;
      const keepHidden = stayHiddenAfterAutostart
        || shouldKeepMainWindowHidden(launchContext, openedLaunchTargets);

      if (keepHidden) {
        await currentWindow.hide();
      }
      else {
        await currentWindow.show();
        await currentWindow.setFocus();
      }
    }

    removeAppSplash();
  }

  async function openDirectoriesFromLaunchArgs(launchContext: LaunchContext): Promise<boolean> {
    const launchTargets = await resolveLaunchTargetsFromArgs(
      launchContext,
      path => workspacesStore.getDirEntry({
        path,
        timeoutMs: STARTUP_DIR_ENTRY_TIMEOUT_MS,
      }),
    );

    if (launchTargets.length === 0) {
      return false;
    }

    await router.push({ name: 'navigator' });

    for (const launchTarget of launchTargets) {
      await workspacesStore.openOrFocusTabGroup(launchTarget.directoryPath);

      if (launchTarget.focusPath) {
        workspacesStore.setPendingLaunchReveal(
          launchTarget.directoryPath,
          launchTarget.focusPath,
        );
      }
    }

    return true;
  }

  async function registerAppLaunchArgsListener() {
    if (appLaunchArgsUnlisten || !isMainWebviewWindow()) {
      return;
    }

    appLaunchArgsUnlisten = await listen<LaunchContext>(APP_LAUNCH_ARGS_EVENT, async (event) => {
      const didOpenTargets = await openDirectoriesFromLaunchArgs(event.payload);

      if (didOpenTargets) {
        const currentWindow = getCurrentWindow();
        await currentWindow.show();
        await currentWindow.setFocus();
      }
    });
  }

  function unregisterAppLaunchArgsListener() {
    appLaunchArgsUnlisten?.();
    appLaunchArgsUnlisten = null;
  }

  function runInBackground(task: () => Promise<void>, errorMessage: string) {
    const backgroundTask: Promise<void> = new Promise<void>((resolve) => {
      setTimeout(() => {
        task().catch((error) => {
          console.error(errorMessage, error);
        }).finally(resolve);
      }, 0);
    }).finally(() => {
      backgroundTasks.delete(backgroundTask);
    });

    backgroundTasks.add(backgroundTask);
  }

  async function awaitBackgroundTasks() {
    await Promise.allSettled([...backgroundTasks]);
  }

  async function init() {
    const isMainWindow = isMainWebviewWindow();

    await platformStore.init();
    await userPathsStore.init();
    await userSettingsStore.init();

    try {
      await applyLaunchAtStartupPreference(userSettingsStore.userSettings.launchAtStartup);
    }
    catch (error) {
      console.error('Failed to apply launch at startup preference:', error);
    }

    let initialLaunchContext: LaunchContext | undefined;
    let openedInitialLaunchTargets = false;
    let loadedInitialTabGroup = false;

    await backgroundMediaStore.refreshCustomBackgrounds({
      timeoutMs: STARTUP_BACKGROUND_REFRESH_TIMEOUT_MS,
    });
    await userStatsStore.init();
    await workspacesStore.init(undefined, { loadInitialTabGroup: false });

    if (isMainWindow) {
      initialLaunchContext = await invoke<LaunchContext>('get_launch_context');

      if (initialLaunchContext.hadAbsorbedShellPaths) {
        try {
          await workspacesStore.loadCurrentTabGroup({
            dirEntryTimeoutMs: STARTUP_DIR_ENTRY_TIMEOUT_MS,
          });
          loadedInitialTabGroup = true;
          openedInitialLaunchTargets = await openDirectoriesFromLaunchArgs(initialLaunchContext);
        }
        catch (error) {
          console.error('Failed to prepare absorbed shell launch targets:', error);
        }
      }
    }

    await revealMainWindow(initialLaunchContext, openedInitialLaunchTargets);
    await appWindowStore.initMainWindowStateListeners();

    if (isMainWindow) {
      await shortcutsStore.init();
      await globalShortcutsStore.init();
    }

    disableWebViewFeatures();

    runInBackground(async () => {
      if (!loadedInitialTabGroup) {
        await workspacesStore.loadCurrentTabGroup({
          dirEntryTimeoutMs: STARTUP_DIR_ENTRY_TIMEOUT_MS,
        });
        loadedInitialTabGroup = true;
      }

      if (isMainWindow && initialLaunchContext && !openedInitialLaunchTargets) {
        openedInitialLaunchTargets = await openDirectoriesFromLaunchArgs(initialLaunchContext);

        if (openedInitialLaunchTargets) {
          await revealMainWindow(initialLaunchContext, true);
        }
      }
    }, 'Failed to restore startup tabs:');

    runInBackground(() => userStatsStore.runDeferredMaintenance(), 'Failed to run deferred user stats maintenance:');
    runInBackground(() => globalSearchStore.initOnLaunch(), 'Failed to initialize global search on launch:');
    runInBackground(() => terminalsStore.init(), 'Failed to initialize terminals:');
    runInBackground(() => extensionsStore.init(), 'Failed to initialize extensions:');
    runInBackground(() => archiveJobsStore.ensureEventListeners(), 'Failed to initialize archive jobs:');
    runInBackground(() => deleteJobsStore.ensureEventListeners(), 'Failed to initialize delete jobs:');
    runInBackground(() => copyMoveJobsStore.ensureEventListeners(), 'Failed to initialize copy and move jobs:');
    runInBackground(() => quickViewStore.ensureMainWindowDisplayedPathListener(), 'Failed to initialize quick view listener:');

    if (isMainWindow) {
      runInBackground(() => initAutoCheck(), 'Failed to initialize app updater:');
    }

    runInBackground(() => checkAndShowChangelog(), 'Failed to check changelog:');
  }

  onMounted(() => {
    if (isMainWebviewWindow()) {
      registerShortcutHandlers();
      void registerAppLaunchArgsListener();
    }
  });

  onUnmounted(() => {
    if (isMainWebviewWindow()) {
      unregisterShortcutHandlers();
      unregisterAppLaunchArgsListener();
    }

    appWindowStore.disposeMainWindowStateListeners();
  });

  return {
    init,
    awaitBackgroundTasks,
  };
}
