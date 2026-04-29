// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, computed, type Ref, type ComputedRef, watchEffect,
} from 'vue';
import type { Theme } from '@/types/user-settings';
import { findThemeOption, parseThemeId } from '@/modules/themes/registry';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

export function useTheme(themeSettingRef: Ref<Theme> | ComputedRef<Theme>) {
  const extensionsStorageStore = useExtensionsStorageStore();
  const currentTheme = ref<'light' | 'dark'>('dark');
  const isDark = computed(() => currentTheme.value === 'dark');
  const appliedThemeVariables = new Set<string>();

  function getSystemPreference(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function clearThemeVariables() {
    if (typeof document === 'undefined' || !document.documentElement) {
      return;
    }

    for (const variableName of appliedThemeVariables) {
      document.documentElement.style.removeProperty(variableName);
    }

    appliedThemeVariables.clear();
  }

  function applyBaseTheme(theme: 'light' | 'dark') {
    currentTheme.value = theme;
    document.documentElement.classList.toggle('dark', currentTheme.value === 'dark');
  }

  function resolveBuiltinTheme(theme: 'light' | 'dark' | 'system'): 'light' | 'dark' {
    return theme === 'system' ? getSystemPreference() : theme;
  }

  function setTheme(theme: Theme) {
    clearThemeVariables();

    const themeOption = findThemeOption(
      theme,
      extensionsStorageStore.extensionsData.installedExtensions,
    );

    if (!themeOption || themeOption.source === 'builtin') {
      const parsedTheme = parseThemeId(theme);
      const resolvedTheme = parsedTheme?.source === 'builtin'
        ? resolveBuiltinTheme(parsedTheme.builtinThemeId)
        : 'dark';

      applyBaseTheme(resolvedTheme);
      return;
    }

    applyBaseTheme(themeOption.baseTheme);

    for (const [variableName, variableValue] of Object.entries(themeOption.variables)) {
      document.documentElement.style.setProperty(variableName, variableValue);
      appliedThemeVariables.add(variableName);
    }
  }

  function toggleTheme() {
    return setTheme(currentTheme.value === 'dark' ? 'light' : 'dark');
  }

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    const parsedTheme = parseThemeId(themeSettingRef.value);

    if (parsedTheme?.source === 'builtin' && parsedTheme.builtinThemeId === 'system') {
      applyBaseTheme(event.matches ? 'dark' : 'light');
    }
  }

  function init() {
    setTheme(themeSettingRef.value);
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  watchEffect(() => {
    setTheme(themeSettingRef.value);
  });

  init();

  return {
    isDark,
    currentTheme,
    toggleTheme,
    setTheme,
  };
}
