// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { prefetchSystemIconsForEntries } from '@/composables/system-icon-cache';
import { loadInstalledIconTheme } from '@/modules/icon-theme/extension-icon-themes';
import {
  BUILTIN_NAVIGATOR_ICON_THEME_IDS,
  normalizeNavigatorIconThemeId,
  parseNavigatorIconThemeId,
  type LoadedIconThemeDefinition,
} from '@/types/icon-theme';
import type { DirEntry } from '@/types/dir-entry';

export const useNavigatorIconsStore = defineStore('navigatorIcons', () => {
  const userSettingsStore = useUserSettingsStore();
  const extensionsStore = useExtensionsStore();

  const loadedExtensionThemes = ref(new Map<string, LoadedIconThemeDefinition | null>());
  const settledExtensionThemeIds = ref(new Set<string>());
  const loadingExtensionThemes = new Map<string, Promise<LoadedIconThemeDefinition | null>>();
  let loadGeneration = 0;

  function clearExtensionThemes(): void {
    loadGeneration += 1;
    loadedExtensionThemes.value = new Map();
    settledExtensionThemeIds.value = new Set();
    loadingExtensionThemes.clear();
  }

  function getLoadedExtensionTheme(iconThemeId: string): LoadedIconThemeDefinition | null | undefined {
    if (!settledExtensionThemeIds.value.has(iconThemeId)) {
      return undefined;
    }

    return loadedExtensionThemes.value.get(iconThemeId) ?? null;
  }

  function isExtensionThemeSettled(iconThemeId: string): boolean {
    return settledExtensionThemeIds.value.has(iconThemeId);
  }

  async function ensureExtensionThemeLoaded(iconThemeId: string): Promise<LoadedIconThemeDefinition | null> {
    const parsedTheme = parseNavigatorIconThemeId(iconThemeId);

    if (!parsedTheme || parsedTheme.kind !== 'extension') {
      return null;
    }

    if (settledExtensionThemeIds.value.has(iconThemeId)) {
      return loadedExtensionThemes.value.get(iconThemeId) ?? null;
    }

    const existingLoad = loadingExtensionThemes.get(iconThemeId);

    if (existingLoad) {
      return await existingLoad;
    }

    const requestGeneration = loadGeneration;
    const loadPromise = loadInstalledIconTheme(
      extensionsStore.enabledExtensions,
      iconThemeId,
    )
      .then((loadedTheme) => {
        if (requestGeneration === loadGeneration && loadingExtensionThemes.get(iconThemeId) === loadPromise) {
          const nextThemes = new Map(loadedExtensionThemes.value);
          nextThemes.set(iconThemeId, loadedTheme);
          loadedExtensionThemes.value = nextThemes;
          settledExtensionThemeIds.value = new Set([...settledExtensionThemeIds.value, iconThemeId]);
        }

        return loadedTheme;
      })
      .finally(() => {
        if (loadingExtensionThemes.get(iconThemeId) === loadPromise) {
          loadingExtensionThemes.delete(iconThemeId);
        }
      });

    loadingExtensionThemes.set(iconThemeId, loadPromise);
    return await loadPromise;
  }

  function getConfiguredExtensionThemeIds(): string[] {
    const themeIds = new Set<string>();

    for (const iconThemeId of [
      userSettingsStore.userSettings.navigator.folderIconTheme,
      userSettingsStore.userSettings.navigator.fileIconTheme,
    ]) {
      const parsedTheme = parseNavigatorIconThemeId(iconThemeId);

      if (parsedTheme?.kind === 'extension') {
        themeIds.add(iconThemeId);
      }
    }

    return [...themeIds];
  }

  async function preloadConfiguredThemes(): Promise<void> {
    await Promise.all(
      getConfiguredExtensionThemeIds().map(iconThemeId => ensureExtensionThemeLoaded(iconThemeId)),
    );
  }

  function getThemeIdForEntry(entry: DirEntry): string {
    return normalizeNavigatorIconThemeId(
      entry.is_dir
        ? userSettingsStore.userSettings.navigator.folderIconTheme
        : userSettingsStore.userSettings.navigator.fileIconTheme,
    );
  }

  function usesSystemIcons(iconThemeId: string): boolean {
    const parsedTheme = parseNavigatorIconThemeId(iconThemeId);

    return parsedTheme?.kind === 'builtin'
      && parsedTheme.themeId === BUILTIN_NAVIGATOR_ICON_THEME_IDS.system;
  }

  function hasFailedExtensionTheme(iconThemeId: string): boolean {
    const parsedTheme = parseNavigatorIconThemeId(iconThemeId);

    return parsedTheme?.kind === 'extension'
      && settledExtensionThemeIds.value.has(iconThemeId)
      && loadedExtensionThemes.value.get(iconThemeId) === null;
  }

  function prefetchForDirectoryEntries(entries: DirEntry[]): void {
    const directoryEntries = [...entries];
    const systemIconEntries = directoryEntries.filter(entry => usesSystemIcons(getThemeIdForEntry(entry)));

    if (systemIconEntries.length > 0) {
      prefetchSystemIconsForEntries(systemIconEntries);
    }

    if (getConfiguredExtensionThemeIds().length === 0) {
      return;
    }

    void preloadConfiguredThemes().then(() => {
      const fallbackEntries = directoryEntries.filter(entry => hasFailedExtensionTheme(getThemeIdForEntry(entry)));

      if (fallbackEntries.length > 0) {
        prefetchSystemIconsForEntries(fallbackEntries);
      }
    });
  }

  watch(
    () => [
      extensionsStore.enabledIconThemeContributorsSignature,
      userSettingsStore.userSettings.navigator.folderIconTheme,
      userSettingsStore.userSettings.navigator.fileIconTheme,
    ],
    () => {
      clearExtensionThemes();
      void preloadConfiguredThemes();
    },
    { immediate: true },
  );

  return {
    getLoadedExtensionTheme,
    isExtensionThemeSettled,
    ensureExtensionThemeLoaded,
    preloadConfiguredThemes,
    prefetchForDirectoryEntries,
    clearExtensionThemes,
  };
});
