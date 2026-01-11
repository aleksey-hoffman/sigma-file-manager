// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import { userPathsFunctions } from '@/data/user-paths';
import type { CustomPaths, UserPaths, UserPathsFunctions } from '@/data/user-paths';

export const useUserPathsStore = defineStore('userPaths', () => {
  const userPaths = ref<UserPaths>({
    appCacheDir: '',
    appConfigDir: '',
    appDataDir: '',
    appLocalDataDir: '',
    appLogDir: '',
    audioDir: '',
    cacheDir: '',
    configDir: '',
    dataDir: '',
    desktopDir: '',
    documentDir: '',
    downloadDir: '',
    executableDir: '',
    fontDir: '',
    homeDir: '',
    localDataDir: '',
    pictureDir: '',
    publicDir: '',
    resourceDir: '',
    runtimeDir: '',
    templateDir: '',
    videoDir: '',
  });

  const customPaths = ref<CustomPaths>({
    appUserDataDir: '',
    appUserDataSettingsName: '',
    appUserDataSettingsPath: '',
    appUserDataWorkspacesName: '',
    appUserDataWorkspacesPath: '',
    appUserDataStatsName: '',
    appUserDataStatsPath: '',
  });

  const platformSpecificPaths = new Set(['runtimeDir', 'fontDir', 'executableDir', 'templateDir']);

  async function init() {
    try {
      const promises = Object.keys(userPathsFunctions).map(async (key) => {
        try {
          userPaths.value[key as keyof UserPaths] = await userPathsFunctions[key as keyof UserPathsFunctions]();
        }
        catch {
          if (!platformSpecificPaths.has(key)) {
            console.warn(`Failed to resolve path for ${key}`);
          }

          userPaths.value[key as keyof UserPaths] = '';
        }
      });
      await Promise.allSettled(promises);
      setCustomPaths();
    }
    catch (error) {
      console.error('Failed to initialize user paths:', error);
    }
  }

  function setCustomPaths() {
    customPaths.value.appUserDataDir = `${userPaths.value.appDataDir}/user-data`;
    customPaths.value.appUserDataSettingsName = 'user-settings.json';
    customPaths.value.appUserDataSettingsPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataSettingsName}`;
    customPaths.value.appUserDataWorkspacesName = 'workspaces.json';
    customPaths.value.appUserDataWorkspacesPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataWorkspacesName}`;
    customPaths.value.appUserDataStatsName = 'user-stats.json';
    customPaths.value.appUserDataStatsPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataStatsName}`;
  }

  return {
    userPaths,
    customPaths,
    init,
  };
});
