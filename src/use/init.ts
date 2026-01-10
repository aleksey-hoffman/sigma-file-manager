// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useUserPathsStore } from '@/stores/storage/user-paths';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import { usePlatformStore } from '@/stores/runtime/platform';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { disableWebViewFeatures } from '@/utils/disable-web-view-features';

export function useInit() {
  const userSettingsStore = useUserSettingsStore();
  const workspacesStore = useWorkspacesStore();
  const userPathsStore = useUserPathsStore();
  const platformStore = usePlatformStore();
  const globalSearchStore = useGlobalSearchStore();

  async function init() {
    await platformStore.init();
    await userPathsStore.init();
    await userSettingsStore.init();
    await workspacesStore.init();
    await globalSearchStore.initOnLaunch();
    disableWebViewFeatures();
  }

  return {
    init,
  };
}
