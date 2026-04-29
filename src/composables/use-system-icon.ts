// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watchEffect, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const systemIconCache = new Map<string, string | null>();
const systemIconInFlight = new Map<string, Promise<string | null>>();

interface SystemIconParams {
  path: Ref<string> | (() => string);
  isDir: Ref<boolean> | (() => boolean);
  extension: Ref<string | null> | (() => string | null);
  size: Ref<number> | (() => number);
  enabled?: Ref<boolean> | (() => boolean);
}

export function useSystemIcon(params: SystemIconParams) {
  const path = computed(() => (typeof params.path === 'function' ? params.path() : params.path.value));
  const isDir = computed(() => (typeof params.isDir === 'function' ? params.isDir() : params.isDir.value));
  const extension = computed(() => (typeof params.extension === 'function' ? params.extension() : params.extension.value));
  const size = computed(() => (typeof params.size === 'function' ? params.size() : params.size.value));
  const useSystemIcons = computed(() => {
    if (!params.enabled) {
      return true;
    }

    return typeof params.enabled === 'function'
      ? params.enabled()
      : params.enabled.value;
  });

  const cacheKey = computed(() => {
    const entryType = isDir.value ? 'dir' : 'file';
    return `${entryType}:${path.value.toLowerCase()}:${size.value}`;
  });

  const systemIconSrc = ref<string | null>(null);

  async function fetchSystemIcon(): Promise<string | null> {
    const iconSize = Math.max(8, Math.min(256, Math.round(size.value)));
    const requestCacheKey = cacheKey.value;
    const requestPath = path.value;
    const requestIsDir = isDir.value;
    const requestExtension = extension.value;
    const cached = systemIconCache.get(requestCacheKey);

    if (cached !== undefined) {
      return cached;
    }

    const existingRequest = systemIconInFlight.get(requestCacheKey);

    if (existingRequest) {
      return await existingRequest;
    }

    const requestPromise = invoke<string | null>('get_system_icon', {
      path: requestPath,
      isDir: requestIsDir,
      extension: requestExtension,
      size: iconSize,
    })
      .then((result) => {
        systemIconCache.set(requestCacheKey, result);
        return result;
      })
      .catch(() => {
        systemIconCache.set(requestCacheKey, null);
        return null;
      })
      .finally(() => {
        systemIconInFlight.delete(requestCacheKey);
      });

    systemIconInFlight.set(requestCacheKey, requestPromise);
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
