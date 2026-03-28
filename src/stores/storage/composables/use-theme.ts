// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, computed, type Ref, type ComputedRef, watchEffect,
} from 'vue';
import type { Theme } from '@/types/user-settings';

export function useTheme(themeSettingRef: Ref<Theme> | ComputedRef<Theme>) {
  const currentTheme = ref<'light' | 'dark'>('dark');
  const isDark = computed(() => currentTheme.value === 'dark');

  function getSystemPreference(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function setTheme(theme: Theme) {
    currentTheme.value = theme === 'system' ? getSystemPreference() : theme;
    document.documentElement.classList.toggle('dark', currentTheme.value === 'dark');
  }

  function toggleTheme() {
    return setTheme(currentTheme.value === 'dark' ? 'light' : 'dark');
  }

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    if (themeSettingRef.value === 'system') {
      setTheme(event.matches ? 'dark' : 'light');
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
