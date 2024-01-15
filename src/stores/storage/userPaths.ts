// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {ref} from 'vue';
import {defineStore} from 'pinia';
import {userPathsFunctions} from '@/data/userPaths';
import type {UserPaths} from '@/data/userPaths';

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
    videoDir: ''
  });

  async function init() {
    const promises = Object.keys(userPathsFunctions).map(async key => {
      try {
        userPaths.value[key] = await userPathsFunctions[key]();
      } catch (error) {
        userPaths.value[key] = '';
      }
    });
    await Promise.allSettled(promises);

  }

  return {
    userPaths,
    init
  };
});
