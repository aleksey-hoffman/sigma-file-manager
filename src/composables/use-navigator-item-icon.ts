// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watch, type Ref } from 'vue';
import type { Component } from 'vue';
import { HardDriveIcon } from '@lucide/vue';
import NavigatorItemIconPlaceholder from '@/components/icons/navigator-item-icon-placeholder.vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useNavigatorIconsStore } from '@/stores/runtime/navigator-icons';
import { useSystemIcon } from './use-system-icon';
import { getDefaultFileIconComponent } from '@/modules/navigator/components/file-browser/utils';
import {
  BUILTIN_NAVIGATOR_ICON_THEME_IDS,
  normalizeNavigatorIconThemeId,
  parseNavigatorIconThemeId,
} from '@/types/icon-theme';
import { resolveLoadedIconThemeIcon } from '@/modules/icon-theme/resolver';
import { isVirtualLocationPath } from '@/utils/virtual-locations';
import type { DriveEntryMetadata } from '@/types/drive-info';
import { getDriveIconComponent } from '@/utils/drive-icon';

interface NavigatorItemIconParams {
  path: Ref<string> | (() => string);
  name?: Ref<string | null> | (() => string | null);
  isDir: Ref<boolean> | (() => boolean);
  extension: Ref<string | null> | (() => string | null);
  size: Ref<number> | (() => number);
  enabled?: Ref<boolean> | (() => boolean);
  driveMetadata?: Ref<DriveEntryMetadata | null | undefined> | (() => DriveEntryMetadata | null | undefined);
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
  const navigatorIconsStore = useNavigatorIconsStore();

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
  const enabled = computed(() => readMaybeRef(params.enabled, true));
  const driveMetadata = computed(() => readMaybeRef(params.driveMetadata, null));
  const selectedIconTheme = computed(() => {
    if (!enabled.value) {
      return BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
    }

    return normalizeNavigatorIconThemeId(
      isDir.value
        ? userSettingsStore.userSettings.navigator.folderIconTheme
        : userSettingsStore.userSettings.navigator.fileIconTheme,
    );
  });
  const parsedTheme = computed(() => parseNavigatorIconThemeId(selectedIconTheme.value));
  const useSystemIcons = computed(() => {
    return parsedTheme.value?.kind === 'builtin'
      && parsedTheme.value.themeId === BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;
  });
  const loadedExtensionTheme = computed(() => {
    if (parsedTheme.value?.kind !== 'extension') {
      return null;
    }

    const loadedTheme = navigatorIconsStore.getLoadedExtensionTheme(selectedIconTheme.value);

    if (loadedTheme === undefined) {
      return null;
    }

    return loadedTheme;
  });

  const { systemIconSrc, isSystemIconPending } = useSystemIcon({
    path,
    isDir,
    extension,
    size,
    enabled: useSystemIcons,
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
    if (driveMetadata.value) {
      return null;
    }

    if (useSystemIcons.value) {
      return systemIconSrc.value;
    }

    return extensionThemeIconSrc.value;
  });

  const isIconPending = computed(() => {
    if (driveMetadata.value || isVirtualLocationPath(path.value)) {
      return false;
    }

    if (useSystemIcons.value) {
      return isSystemIconPending.value;
    }

    return parsedTheme.value?.kind === 'extension'
      && navigatorIconsStore.getLoadedExtensionTheme(selectedIconTheme.value) === undefined;
  });

  const wasIconPending = ref(false);

  watch(isIconPending, (pending) => {
    if (pending) {
      wasIconPending.value = true;
    }
  }, { immediate: true });

  const iconRevealClass = computed(() => {
    if (wasIconPending.value && !isIconPending.value) {
      return 'animate-fade-in-fast';
    }

    return undefined;
  });

  const fallbackIconComponent = computed<Component>(() => {
    if (driveMetadata.value) {
      return getDriveIconComponent(driveMetadata.value);
    }

    if (isVirtualLocationPath(path.value)) {
      return HardDriveIcon;
    }

    if (isIconPending.value) {
      return NavigatorItemIconPlaceholder;
    }

    return getDefaultFileIconComponent({
      isDirectory: isDir.value,
      extension: extension.value,
    });
  });

  return {
    iconSrc,
    fallbackIconComponent,
    iconRevealClass,
  };
}
