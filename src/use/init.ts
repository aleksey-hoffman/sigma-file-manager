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
import { initPlatformInfo } from '@/modules/extensions/api';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { SIGMA_AUTOSTART_CLI_FLAG } from '@/constants/autostart';
import { applyLaunchAtStartupPreference } from '@/utils/autostart-sync';

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
  const { checkAndShowChangelog } = useChangelog();
  const { initAutoCheck } = useAppUpdater();

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
  }

  function unregisterShortcutHandlers() {
    shortcutsStore.unregisterHandler('toggleGlobalSearch');
  }

  async function showMainWindow() {
    await nextTick();
    await new Promise(resolve => requestAnimationFrame(resolve));

    const currentWindow = getCurrentWindow();

    if (currentWindow.label === 'main') {
      const processArguments = await invoke<string[]>('get_app_args');
      const launchedFromOsAutostart = processArguments.includes(SIGMA_AUTOSTART_CLI_FLAG);
      const stayHiddenAfterAutostart = launchedFromOsAutostart
        && userSettingsStore.userSettings.launchAtStartupHidden;
      if (stayHiddenAfterAutostart) {
        return;
      }
      await currentWindow.show();
      await currentWindow.setFocus();
    }
  }

  async function init() {
    await platformStore.init();
    await userPathsStore.init();
    await userSettingsStore.init();
    try {
      await applyLaunchAtStartupPreference(userSettingsStore.userSettings.launchAtStartup);
    }
    catch (error) {
      console.error('Failed to apply launch at startup preference:', error);
    }
    await backgroundMediaStore.refreshCustomBackgrounds();
    await userStatsStore.init();
    await workspacesStore.init();
    await showMainWindow();
    await appWindowStore.initMainWindowStateListeners();
    await globalSearchStore.initOnLaunch();
    await shortcutsStore.init();
    await globalShortcutsStore.init();
    await terminalsStore.init();
    await initPlatformInfo();
    await extensionsStore.init();
    void archiveJobsStore.ensureEventListeners();
    await initAutoCheck();
    await checkAndShowChangelog();
    disableWebViewFeatures();
  }

  onMounted(() => {
    registerShortcutHandlers();
  });

  onUnmounted(() => {
    unregisterShortcutHandlers();
    appWindowStore.disposeMainWindowStateListeners();
  });

  return {
    init,
  };
}
