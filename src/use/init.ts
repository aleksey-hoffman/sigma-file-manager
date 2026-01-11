// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { disableWebViewFeatures } from '@/utils/disable-web-view-features';

export function useInit() {
  const router = useRouter();
  const userSettingsStore = useUserSettingsStore();
  const userStatsStore = useUserStatsStore();
  const workspacesStore = useWorkspacesStore();
  const userPathsStore = useUserPathsStore();
  const platformStore = usePlatformStore();
  const globalSearchStore = useGlobalSearchStore();
  const shortcutsStore = useShortcutsStore();

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

  async function init() {
    await platformStore.init();
    await userPathsStore.init();
    await userSettingsStore.init();
    await userStatsStore.init();
    await workspacesStore.init();
    await globalSearchStore.initOnLaunch();
    shortcutsStore.init();
    disableWebViewFeatures();
  }

  onMounted(() => {
    registerShortcutHandlers();
  });

  onUnmounted(() => {
    unregisterShortcutHandlers();
  });

  return {
    init,
  };
}
