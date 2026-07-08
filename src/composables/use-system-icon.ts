// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watchEffect, type Ref } from 'vue';
import { fetchSystemIconCached } from './system-icon-cache';

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

  watchEffect(async (onCleanup) => {
    let isCurrentRequest = true;

    onCleanup(() => {
      isCurrentRequest = false;
    });

    if (!useSystemIcons.value) {
      systemIconSrc.value = null;
      return;
    }

    const requestPath = path.value;
    const requestIsDir = isDir.value;
    const requestExtension = extension.value;
    const requestSize = size.value;
    const iconSrc = await fetchSystemIconCached({
      path: requestPath,
      isDir: requestIsDir,
      extension: requestExtension,
      size: requestSize,
    });

    if (isCurrentRequest
      && requestPath === path.value
      && requestIsDir === isDir.value
      && requestExtension === extension.value
      && requestSize === size.value) {
      systemIconSrc.value = iconSrc;
    }
  });

  return {
    systemIconSrc,
    useSystemIcons,
  };
}
