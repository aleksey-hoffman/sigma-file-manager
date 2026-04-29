// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watchEffect, type Ref } from 'vue';
import type { Component } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useSystemIcon } from './use-system-icon';
import { getDefaultFileIconComponent } from '@/modules/navigator/components/file-browser/utils';
import {
  BUILTIN_NAVIGATOR_ICON_THEME_IDS,
  normalizeNavigatorIconThemeId,
  parseNavigatorIconThemeId,
} from '@/types/icon-theme';
import { loadInstalledIconTheme } from '@/modules/icon-theme/extension-icon-themes';
import { resolveLoadedIconThemeIcon } from '@/modules/icon-theme/resolver';

interface NavigatorItemIconParams {
  path: Ref<string> | (() => string);
  name?: Ref<string | null> | (() => string | null);
  isDir: Ref<boolean> | (() => boolean);
  extension: Ref<string | null> | (() => string | null);
  size: Ref<number> | (() => number);
}

function readMaybeRef<T>(value: Ref<T> | (() => T) | undefined, fallback: T): T {
  if (!value) {
    return fallback;
  }

  return typeof value === 'function' ? value() : value.value;
}

function getPathSegments(path: string): string[] {
  return path
    .split(/[\\/]+/)
    .filter(segment => segment.length > 0);
}

export function useNavigatorItemIcon(params: NavigatorItemIconParams) {
  const userSettingsStore = useUserSettingsStore();
  const extensionsStore = useExtensionsStore();
  const loadedExtensionTheme = ref<Awaited<ReturnType<typeof loadInstalledIconTheme>>>(null);

  const path = computed(() => readMaybeRef(params.path, ''));
  const name = computed(() => {
    const explicitName = readMaybeRef(params.name, null);

    if (explicitName && explicitName.trim()) {
      return explicitName;
    }

    const segments = getPathSegments(path.value);
    return segments.length > 0 ? segments[segments.length - 1] : '';
  });
  const parentName = computed(() => {
    const segments = getPathSegments(path.value);

    if (segments.length < 2) {
      return null;
    }

    return segments[segments.length - 2] ?? null;
  });
  const isDir = computed(() => readMaybeRef(params.isDir, false));
  const extension = computed(() => readMaybeRef(params.extension, null));
  const size = computed(() => readMaybeRef(params.size, 32));
  const selectedIconTheme = computed(() => normalizeNavigatorIconThemeId(
    userSettingsStore.userSettings.navigator.iconTheme,
  ));
  const parsedTheme = computed(() => parseNavigatorIconThemeId(selectedIconTheme.value));
  const useSystemIcons = computed(() => {
    return parsedTheme.value?.kind === 'builtin'
      && parsedTheme.value.themeId === BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;
  });

  const { systemIconSrc } = useSystemIcon({
    path,
    isDir,
    extension,
    size,
    enabled: useSystemIcons,
  });

  watchEffect(async () => {
    if (parsedTheme.value?.kind !== 'extension') {
      loadedExtensionTheme.value = null;
      return;
    }

    const requestThemeId = selectedIconTheme.value;
    const loadedTheme = await loadInstalledIconTheme(
      extensionsStore.enabledExtensions,
      requestThemeId,
    );

    if (selectedIconTheme.value === requestThemeId) {
      loadedExtensionTheme.value = loadedTheme;
    }
  });

  const extensionThemeIconSrc = computed(() => {
    if (parsedTheme.value?.kind !== 'extension' || !loadedExtensionTheme.value) {
      return null;
    }

    return resolveLoadedIconThemeIcon(loadedExtensionTheme.value, {
      name: name.value,
      parentName: parentName.value,
      extension: extension.value,
      isDirectory: isDir.value,
    });
  });

  const iconSrc = computed(() => {
    if (useSystemIcons.value) {
      return systemIconSrc.value;
    }

    return extensionThemeIconSrc.value;
  });

  const fallbackIconComponent = computed<Component>(() => getDefaultFileIconComponent({
    isDirectory: isDir.value,
    extension: extension.value,
  }));

  return {
    iconSrc,
    fallbackIconComponent,
  };
}
