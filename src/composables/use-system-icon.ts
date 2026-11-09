// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watchEffect, type Ref } from 'vue';
import { fetchSystemIconCached, getCachedSystemIcon } from './system-icon-cache';

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

  const systemIconSrc = ref<string | null>(null);
  const isSystemIconPending = ref(false);

  watchEffect(async (onCleanup) => {
    let isCurrentRequest = true;

    onCleanup(() => {
      isCurrentRequest = false;
    });

    if (!useSystemIcons.value) {
      systemIconSrc.value = null;
      isSystemIconPending.value = false;
      return;
    }

    const request = {
      path: path.value,
      isDir: isDir.value,
      extension: extension.value,
      size: size.value,
    };

    const cachedIconSrc = getCachedSystemIcon(request);

    if (cachedIconSrc !== undefined) {
      systemIconSrc.value = cachedIconSrc;
      isSystemIconPending.value = false;
      return;
    }

    systemIconSrc.value = null;
    isSystemIconPending.value = true;
    const iconSrc = await fetchSystemIconCached(request);

    if (isCurrentRequest
      && request.path === path.value
      && request.isDir === isDir.value
      && request.extension === extension.value
      && request.size === size.value) {
      systemIconSrc.value = iconSrc;
      isSystemIconPending.value = false;
    }
  });

  return {
    systemIconSrc,
    isSystemIconPending,
    useSystemIcons,
  };
}
