// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import cloneDeep from 'lodash.clonedeep';
import {defineStore} from 'pinia';
import {Store as Storage} from 'tauri-plugin-store-api';
import {ref} from 'vue';
import {useTheme} from 'vuetify';
import type {UserSettings, LocalizationLanguage} from '@/types/user-settings';

export const useUserSettingsStore = defineStore('userSettings', () => {
  const appTheme = useTheme();

  const userSettingsStorage = ref<Storage | null>(null);
  const userSettingsDefault = ref<UserSettings | null>();
  const userSettings = ref<UserSettings>({
    language: {
      name: 'English',
      locale: 'en',
      isCorrected: true,
      isRtl: false
    },
    theme: {
      type: 'dark'
    },
    transparentToolbars: false,
    dateTime: {
      month: 'short',
      regionalFormat: {
        code: 'en',
        name: 'English'
      },
      autoDetectRegionalFormat: true,
      hour12: false,
      properties: {
        showSeconds: false,
        showMilliseconds: false
      }
    },
    navigator: {
      layout: {
        type: {
          title: 'gridLayout',
          name: 'grid'
        },
        dirItemOptions: {
          title: {
            height: 32
          },
          directory: {
            height: 48
          },
          file: {
            height: 48
          }
        }
      },
      infoPanel: {
        show: false
      }
    }
  });

  async function loadUserSettings() {
    try {
      let settings = await userSettingsStorage.value?.entries();
      settings?.forEach(entry => {
        userSettings[entry[0]] = entry[1];
      });
    } catch (error) {
      console.error('Failed to load user settings:', error);
    }
  }

  async function initUserSettings() {
    if (!userSettingsStorage.value) {
      userSettingsStorage.value = new Storage('user-data/user-settings.json');
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
    } catch (error) {
      console.error(`Failed to save to storage: ${key}: ${value}`);
    }
  }

  async function changeLanguage(newLanguage: LocalizationLanguage) {
    userSettings.value.language = newLanguage;
    await setUserSettingsStorage('language', newLanguage);
  }

  async function changeTheme() {
    userSettings.value.theme.type = userSettings.value.theme.type === 'dark' ? 'light' : 'dark';
    appTheme.global.name.value = appTheme.global.name.value === 'dark' ? 'light' : 'dark';
    await setUserSettingsStorage('theme', userSettings.value.theme.type);
  }

  async function toggleInfoPanel() {
    userSettings.value.navigator.infoPanel.show = !userSettings.value.navigator.infoPanel.show;
    await setUserSettingsStorage('navigator.infoPanel.show', userSettings.value.navigator.infoPanel.show);
  }

  async function init() {
    await initUserSettings();
    await loadUserSettings();
  }

  init();

  return {
    userSettings,
    userSettingsDefault,
    setUserSettingsStorage,
    changeLanguage,
    changeTheme,
    toggleInfoPanel
  };
});