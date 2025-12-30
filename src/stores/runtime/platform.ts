// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { platform, type Platform } from '@tauri-apps/plugin-os';

export const usePlatformStore = defineStore('platform', () => {
  const currentPlatform = ref<Platform | null>(null);

  const isWindows = computed(() => currentPlatform.value === 'windows');
  const isMacOS = computed(() => currentPlatform.value === 'macos');
  const isLinux = computed(() => currentPlatform.value === 'linux');
  const isUnix = computed(() => isMacOS.value || isLinux.value);

  async function init() {
    try {
      currentPlatform.value = await platform();
    }
    catch (error) {
      console.error('Failed to detect platform:', error);
      currentPlatform.value = 'windows';
    }
  }

  return {
    currentPlatform,
    isWindows,
    isMacOS,
    isLinux,
    isUnix,
    init,
  };
});

