// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import cloneDeep from 'lodash.clonedeep';
import { defineStore } from 'pinia';
import { LazyStore } from '@tauri-apps/plugin-store';
import { ref, watch } from 'vue';
import type { UserSettings, LocalizationLanguage, UserSettingsPath, UserSettingsValue } from '@/types/user-settings';
import { useTheme } from './use/use-theme';
import { useUserPathsStore } from './user-paths';
import { i18n } from '@/localization';

export const useUserSettingsStore = defineStore('userSettings', () => {
  const userPathsStore = useUserPathsStore();

  const userSettingsStorage = ref<LazyStore | null>(null);
  const userSettingsDefault = ref<UserSettings | null>();
  const userSettings = ref<UserSettings>({
    language: {
      name: 'English',
      locale: 'en',
      isCorrected: true,
      isRtl: false,
    },
    theme: 'dark',
    transparentToolbars: false,
    dateTime: {
      month: 'short',
      regionalFormat: {
        code: 'en',
        name: 'English',
      },
      autoDetectRegionalFormat: true,
      hour12: false,
      properties: {
        showSeconds: false,
        showMilliseconds: false,
      },
    },
    navigator: {
      layout: {
        type: {
          title: 'gridLayout',
          name: 'grid',
        },
        dirItemOptions: {
          title: {
            height: 32,
          },
          directory: {
            height: 48,
          },
          file: {
            height: 48,
          },
        },
      },
      infoPanel: {
        show: false,
      },
    },
  });

  const { setTheme } = useTheme(userSettings.value.theme);

  watch(() => userSettings.value.theme, (value) => {
    setTheme(value);
  });

  async function loadUserSettings() {
    try {
      const settings = await userSettingsStorage.value?.entries();
      settings?.forEach((entry) => {
        (userSettings.value as Record<string, unknown>)[entry[0]] = entry[1];
      });
    }
    catch (error) {
      console.error('Failed to load user settings:', error);
    }
  }

  async function initUserSettings() {
    if (!userSettingsStorage.value) {
      userSettingsStorage.value = await new LazyStore(userPathsStore.customPaths.appUserDataSettingsDir);

      await userSettingsStorage.value.save();
    }

    if (!userSettingsDefault.value) {
      userSettingsDefault.value = cloneDeep(userSettings.value);
    }
  }

  async function setUserSettingsStorage(key: string, value: unknown) {
    try {
      if (userSettingsStorage.value) {
        await userSettingsStorage.value.set(key, value);
        await userSettingsStorage.value.save();
      }
    }
    catch (error: unknown) {
      console.error(`Failed to save to storage: ${key}: ${value}`, error);
    }
  }

  async function setLanguage(newLanguage: LocalizationLanguage) {
    userSettings.value.language = newLanguage;
    await setUserSettingsStorage('language', newLanguage);
  }

  async function initTheme() {
    setTheme(userSettings.value.theme);
  }

  async function initLanguage() {
    i18n.global.locale.value = userSettings.value.language.locale as typeof i18n.global.locale.value;
  }

  async function toggleInfoPanel() {
    userSettings.value.navigator.infoPanel.show = !userSettings.value.navigator.infoPanel.show;
    await setUserSettingsStorage('navigator.infoPanel.show', userSettings.value.navigator.infoPanel.show);
  }

  async function set<P extends UserSettingsPath>(key: P, value: UserSettingsValue<P>) {
    const keys = key.split('.');
    let current: Record<string, unknown> = userSettings.value as Record<string, unknown>;

    for (let i = 0; i < keys.length - 1; i++) {
      current = current[keys[i]] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    await setUserSettingsStorage(key, value);
  }

  async function init() {
    await initUserSettings();
    await loadUserSettings();
    initTheme();
    initLanguage();
  }

  return {
    userSettings,
    userSettingsDefault,
    init,
    set,
    setUserSettingsStorage,
    setLanguage,
    toggleInfoPanel,
  };
});
