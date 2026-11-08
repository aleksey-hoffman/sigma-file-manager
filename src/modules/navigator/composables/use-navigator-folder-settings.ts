// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { clearNavigatorFolderSettings } from '@/modules/navigator/utils/persist-navigator-folder-settings';
import {
  hasNavigatorFolderSettings,
  resolveNavigatorFolderSettings,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';

export function useNavigatorFolderSettings(getActivePath: () => string | undefined) {
  const userSettingsStore = useUserSettingsStore();
  const activePath = computed(() => getActivePath() ?? '');
  const applied = computed(() => resolveNavigatorFolderSettings(
    userSettingsStore.userSettings.navigator,
    activePath.value,
  ));
  const hasFolderSettings = computed(() => (
    Boolean(activePath.value)
    && hasNavigatorFolderSettings(userSettingsStore.userSettings.navigator, activePath.value)
  ));

  function clearFolderSettings() {
    return clearNavigatorFolderSettings(activePath.value);
  }

  return {
    applied,
    clearFolderSettings,
    hasFolderSettings,
  };
}
