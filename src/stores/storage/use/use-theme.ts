// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, watch } from 'vue';

export function useTheme(themeScheme: 'light' | 'dark' | 'system') {
  const currentTheme = ref<'light' | 'dark'>('dark');
  const isDark = computed(() => currentTheme.value === 'dark');

  watch(() => themeScheme, () => {
    updateTheme();
  });

  function getSystemPreference(): 'light' | 'dark' {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function updateTheme() {
    if (themeScheme === 'system') {
      setTheme(getSystemPreference());
    }
    else {
      setTheme(themeScheme);
    }
  }

  function setTheme(theme: 'light' | 'dark' | 'system') {
    currentTheme.value = theme === 'system' ? getSystemPreference() : theme;
    document.documentElement.classList.toggle('dark', currentTheme.value === 'dark');
  }

  function toggleTheme() {
    return setTheme(currentTheme.value === 'dark' ? 'light' : 'dark');
  }

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    setTheme(event.matches ? 'dark' : 'light');
  }

  function init() {
    updateTheme();

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', handleSystemThemeChange);
  }

  init();

  return {
    isDark,
    currentTheme,
    toggleTheme,
    setTheme,
  };
}
