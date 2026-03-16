// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watchEffect, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const systemIconCache = new Map<string, string | null>();
const systemIconInFlight = new Map<string, Promise<string | null>>();

interface SystemIconParams {
  path: Ref<string> | (() => string);
  isDir: Ref<boolean> | (() => boolean);
  extension: Ref<string | null> | (() => string | null);
  size: Ref<number> | (() => number);
}

export function useSystemIcon(params: SystemIconParams) {
  const userSettingsStore = useUserSettingsStore();

  const path = computed(() => (typeof params.path === 'function' ? params.path() : params.path.value));
  const isDir = computed(() => (typeof params.isDir === 'function' ? params.isDir() : params.isDir.value));
  const extension = computed(() => (typeof params.extension === 'function' ? params.extension() : params.extension.value));
  const size = computed(() => (typeof params.size === 'function' ? params.size() : params.size.value));

  const useSystemIcons = computed(() => (
    isDir.value
      ? userSettingsStore.userSettings.navigator.useSystemIconsForDirectories
      : userSettingsStore.userSettings.navigator.useSystemIconsForFiles
  ));

  const cacheKey = computed(() => {
    if (isDir.value) {
      return `dir:${path.value.toLowerCase()}:${size.value}`;
    }
    const extensionKey = (extension.value || '').toLowerCase();
    return `ext:${extensionKey}:${size.value}`;
  });

  const systemIconSrc = ref<string | null>(null);

  async function fetchSystemIcon(): Promise<string | null> {
    const iconSize = Math.max(8, Math.min(256, Math.round(size.value)));
    const cached = systemIconCache.get(cacheKey.value);

    if (cached !== undefined) {
      return cached;
    }

    const existingRequest = systemIconInFlight.get(cacheKey.value);

    if (existingRequest) {
      return await existingRequest;
    }

    const requestPromise = invoke<string | null>('get_system_icon', {
      path: path.value,
      isDir: isDir.value,
      extension: extension.value,
      size: iconSize,
    })
      .then((result) => {
        systemIconCache.set(cacheKey.value, result);
        return result;
      })
      .catch(() => {
        systemIconCache.set(cacheKey.value, null);
        return null;
      })
      .finally(() => {
        systemIconInFlight.delete(cacheKey.value);
      });

    systemIconInFlight.set(cacheKey.value, requestPromise);
    return await requestPromise;
  }

  watchEffect(async () => {
    if (!useSystemIcons.value) {
      systemIconSrc.value = null;
      return;
    }

    systemIconSrc.value = await fetchSystemIcon();
  });

  return {
    systemIconSrc,
    useSystemIcons,
  };
}
