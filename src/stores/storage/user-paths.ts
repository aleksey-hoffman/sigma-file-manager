// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref } from 'vue';
import userStorageFiles from '@shared/user-storage-files.json';
import { userPathsFunctions } from '@/data/user-paths';
import type { CustomPaths, UserPaths, UserPathsFunctions } from '@/data/user-paths';
import normalizePath from '@/utils/normalize-path';

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
    appUserDataExtensionsName: '',
    appUserDataExtensionsPath: '',
    appStorageCustomBackgroundsPath: '',
    appUserDataSourceBackgroundsPath: '',
  });

  const platformSpecificPaths = new Set(['runtimeDir', 'fontDir', 'executableDir', 'templateDir']);

  async function init() {
    try {
      const promises = Object.keys(userPathsFunctions).map(async (key) => {
        try {
          const resolvedPath = await userPathsFunctions[key as keyof UserPathsFunctions]();
          userPaths.value[key as keyof UserPaths] = normalizePath(resolvedPath);
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
    const fileNames = userStorageFiles.fileNames;
    customPaths.value.appUserDataDir = `${userPaths.value.appDataDir}/${userStorageFiles.userDataDirName}`;
    customPaths.value.appUserDataSettingsName = fileNames.userSettings;
    customPaths.value.appUserDataSettingsPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataSettingsName}`;
    customPaths.value.appUserDataWorkspacesName = fileNames.workspaces;
    customPaths.value.appUserDataWorkspacesPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataWorkspacesName}`;
    customPaths.value.appUserDataStatsName = fileNames.userStats;
    customPaths.value.appUserDataStatsPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataStatsName}`;
    customPaths.value.appUserDataExtensionsName = fileNames.extensions;
    customPaths.value.appUserDataExtensionsPath = `${customPaths.value.appUserDataDir}/${customPaths.value.appUserDataExtensionsName}`;
    customPaths.value.appStorageCustomBackgroundsPath = `${customPaths.value.appUserDataDir}/media/custom-backgrounds`;
    customPaths.value.appUserDataSourceBackgroundsPath = `${customPaths.value.appUserDataDir}/media/source-backgrounds`;
  }

  return {
    userPaths,
    customPaths,
    init,
  };
});
