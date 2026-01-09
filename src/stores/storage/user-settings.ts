// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import cloneDeep from 'lodash.clonedeep';
import { defineStore } from 'pinia';
import { LazyStore } from '@tauri-apps/plugin-store';
import { ref, computed } from 'vue';
import type { UserSettings, LocalizationLanguage, UserSettingsPath, UserSettingsValue } from '@/types/user-settings';
import { useTheme } from './use/use-theme';
import { useUserPathsStore } from './user-paths';
import { i18n } from '@/localization';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import {
  buildAllowedUserSettingsStorageKeys,
  migrateUserSettingsStorage,
  USER_SETTINGS_SCHEMA_VERSION_KEY,
} from '@/stores/schemas/user-settings';

export const useUserSettingsStore = defineStore('userSettings', () => {
  const userPathsStore = useUserPathsStore();

  const userSettingsStorage = ref<LazyStore | null>(null);
  const userSettingsDefault = ref<UserSettings | null>(null);
  const allowedUserSettingsStorageKeys = ref<Set<string>>(new Set());
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
      showHiddenFiles: false,
    },
    UIZoomLevel: 1.0,
    homeBannerIndex: 0,
    homeBannerPositions: {},
    driveCard: {
      showSpaceIndicator: true,
      spaceIndicatorStyle: 'linearVertical',
    },
    userDirectories: {},
  });

  const themeSettingRef = computed(() => userSettings.value.theme);
  const { setTheme } = useTheme(themeSettingRef);

  async function loadUserSettings() {
    try {
      const settings = await userSettingsStorage.value?.entries();

      if (!settings || settings.length === 0) {
        return;
      }

      for (const [key, value] of settings) {
        if (key === USER_SETTINGS_SCHEMA_VERSION_KEY) {
          continue;
        }

        if (!allowedUserSettingsStorageKeys.value.has(key)) {
          continue;
        }

        setNestedValue(userSettings.value as Record<string, unknown>, key, value);
      }
    }
    catch (error) {
      console.error('Failed to load user settings:', error);
    }
  }

  function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown) {
    const keys = path.split('.');
    let current = obj;

    for (let keyIndex = 0; keyIndex < keys.length - 1; keyIndex++) {
      const key = keys[keyIndex];

      if (current[key] === undefined || typeof current[key] !== 'object') {
        current[key] = {};
      }

      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  async function initUserSettings() {
    try {
      if (!userSettingsStorage.value) {
        userSettingsStorage.value = await new LazyStore(userPathsStore.customPaths.appUserDataSettingsPath);
        await userSettingsStorage.value.save();
      }

      if (!userSettingsDefault.value) {
        userSettingsDefault.value = cloneDeep(userSettings.value);
      }

      if (userSettingsDefault.value && allowedUserSettingsStorageKeys.value.size === 0) {
        allowedUserSettingsStorageKeys.value = buildAllowedUserSettingsStorageKeys(userSettingsDefault.value);
      }
    }
    catch (error) {
      console.error('Failed to initialize user settings storage:', error);
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

  function initTheme() {
    setTheme(userSettings.value.theme);
  }

  function initLanguage() {
    i18n.global.locale.value = userSettings.value.language.locale as typeof i18n.global.locale.value;
  }

  async function initZoom() {
    const webview = getCurrentWebview();
    const zoomLevel = userSettings.value.UIZoomLevel ?? 1.0;
    await webview.setZoom(zoomLevel);
  }

  async function toggleInfoPanel() {
    userSettings.value.navigator.infoPanel.show = !userSettings.value.navigator.infoPanel.show;
    await setUserSettingsStorage('navigator.infoPanel.show', userSettings.value.navigator.infoPanel.show);
  }

  async function set<P extends UserSettingsPath>(key: P, value: UserSettingsValue<P>) {
    const keys = key.split('.');
    let current: Record<string, unknown> = userSettings.value as Record<string, unknown>;

    for (let keyIndex = 0; keyIndex < keys.length - 1; keyIndex++) {
      current = current[keys[keyIndex]] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    await setUserSettingsStorage(key, value);
  }

  async function init() {
    await initUserSettings();

    if (userSettingsStorage.value) {
      await migrateUserSettingsStorage(userSettingsStorage.value);
    }

    await loadUserSettings();
    initTheme();
    initLanguage();
    await initZoom();
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
