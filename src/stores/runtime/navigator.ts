// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { toLocalTime } from '@/utils/date-time';
import type { DirEntry } from '@/types/dir-entry';
import type { Runtime } from '@/types/runtime';

export const useNavigatorStore = defineStore('navigator', () => {
  const userSettingsStore = useUserSettingsStore();

  const { t } = useI18n();

  const runtime = ref<Runtime>({
    navigator: {
      infoPanel: {
        properties: [],
      },
    },
  });

  async function updateInfoPanel(dirEntry: DirEntry | null | undefined) {
    if (!dirEntry) {
      return;
    }

    setInfoPanelData(dirEntry);
  }

  async function setInfoPanelData(dirEntry: DirEntry) {
    runtime.value.navigator.infoPanel.properties = [
      {
        propName: 'path',
        title: t('path'),
        value: dirEntry.path,
        tooltip: 'copyPathTooltip',
      },
      {
        propName: 'dateCreated',
        title: t('sorting.typeShortTitles.dateCreated'),
        value: toLocalTime(new Date(dirEntry.created_time), userSettingsStore.userSettings.dateTime),
        tooltip: `${t('toCopy')}: ${'copyShortcut'}`,
      },
      {
        propName: 'dateModified',
        title: t('sorting.typeShortTitles.dateModified'),
        value: toLocalTime(new Date(dirEntry.modified_time), userSettingsStore.userSettings.dateTime),
        tooltip: `${t('toCopy')}: ${'copyShortcut'}`,
      },
      {
        propName: 'dateAccessed',
        title: t('sorting.typeShortTitles.dateAccessed'),
        value: toLocalTime(new Date(dirEntry.accessed_time), userSettingsStore.userSettings.dateTime),
        tooltip: `${t('toCopy')}: ${'copyShortcut'}`,
      },
    ];
  }

  return {
    runtime,
    updateInfoPanel,
  };
});
