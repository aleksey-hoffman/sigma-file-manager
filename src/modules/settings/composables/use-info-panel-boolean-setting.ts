// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { UserSettingsNavigatorInfoPanel } from '@/types/user-settings';

type InfoPanelBooleanSettingKey = {
  [Key in keyof UserSettingsNavigatorInfoPanel]: UserSettingsNavigatorInfoPanel[Key] extends boolean ? Key : never;
}[keyof UserSettingsNavigatorInfoPanel];

export function useInfoPanelBooleanSetting(settingKey: InfoPanelBooleanSettingKey) {
  const userSettingsStore = useUserSettingsStore();
  const storagePath = `navigator.infoPanel.${settingKey}` as const;

  return computed({
    get: () => userSettingsStore.userSettings.navigator.infoPanel[settingKey],
    set: (value: boolean) => {
      userSettingsStore.set(storagePath, value);
    },
  });
}
