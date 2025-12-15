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
    appUserDataSettingsDir: '',
  });

  async function init() {
    const promises = Object.keys(userPathsFunctions).map(async (key) => {
      try {
        userPaths.value[key as keyof UserPaths] = await userPathsFunctions[key as keyof UserPathsFunctions]();
      }
      catch (error) {
        userPaths.value[key as keyof UserPaths] = '';
      }
    });
    await Promise.allSettled(promises);

    setCustomPaths();
  }

  function setCustomPaths() {
    customPaths.value.appUserDataDir = `${userPaths.value.appDataDir}/user-data`;
    customPaths.value.appUserDataSettingsName = 'user-settings.json';
    customPaths.value.appUserDataSettingsDir = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataSettingsName}`;
  }

  return {
    userPaths,
    customPaths,
    init,
  };
});
