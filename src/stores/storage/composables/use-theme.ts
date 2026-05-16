// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  ref, computed, type Ref, type ComputedRef, watchEffect,
} from 'vue';
import type { Theme } from '@/types/user-settings';
import { findThemeOption, parseThemeId } from '@/modules/themes/registry';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

export type ThemeTransitionOrigin = {
  x: number;
  y: number;
};

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => {
    ready: Promise<void>;
    skipTransition: () => void;
  };
};

const THEME_TRANSITION_DURATION_MS = 500;
let activeViewTransition: ReturnType<NonNullable<ViewTransitionDocument['startViewTransition']>> | null = null;
let activeViewTransitionAnimation: Animation | null = null;
let activeViewTransitionId = 0;

export function useTheme(
  themeSettingRef: Ref<Theme> | ComputedRef<Theme>,
  transitionOriginRef?: Ref<ThemeTransitionOrigin | null> | ComputedRef<ThemeTransitionOrigin | null>,
  transitionsEnabledRef?: Ref<boolean> | ComputedRef<boolean>,
) {
  const extensionsStorageStore = useExtensionsStorageStore();
  const currentTheme = ref<'light' | 'dark'>('dark');
  const isDark = computed(() => currentTheme.value === 'dark');
  const appliedThemeVariables = new Set<string>();
  let hasAppliedTheme = false;
  let appliedTheme: Theme | null = null;

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

  function getTransitionOrigin(): ThemeTransitionOrigin {
    return transitionOriginRef?.value ?? {
      x: window.innerWidth,
      y: 0,
    };
  }

  function animateViewTransition(transitionId: number) {
    if (transitionId !== activeViewTransitionId) {
      return;
    }

    const { x, y } = getTransitionOrigin();
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    activeViewTransitionAnimation = document.documentElement.animate(
      {
        clipPath: [
          `circle(0px at ${x}px ${y}px)`,
          `circle(${maxRadius}px at ${x}px ${y}px)`,
        ],
      },
      {
        duration: THEME_TRANSITION_DURATION_MS,
        easing: 'ease-in-out',
        pseudoElement: '::view-transition-new(root)',
      },
    );

    activeViewTransitionAnimation.finished
      .catch(() => undefined)
      .finally(() => {
        if (transitionId === activeViewTransitionId) {
          activeViewTransitionAnimation = null;
          activeViewTransition = null;
        }
      });
  }

  function canUseViewTransition(): boolean {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return false;
    }

    const viewTransitionDocument = document as ViewTransitionDocument;

    return typeof window.matchMedia === 'function'
      && typeof viewTransitionDocument.startViewTransition === 'function'
      && typeof document.documentElement.animate === 'function'
      && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function cancelActiveViewTransition() {
    activeViewTransitionAnimation?.cancel();
    activeViewTransitionAnimation = null;
    activeViewTransition?.skipTransition();
    activeViewTransition = null;
  }

  function runThemeTransition(applyThemeChange: () => void) {
    if (!canUseViewTransition()) {
      applyThemeChange();
      return;
    }

    cancelActiveViewTransition();

    const viewTransitionDocument = document as ViewTransitionDocument;
    const transitionId = activeViewTransitionId + 1;
    activeViewTransitionId = transitionId;

    try {
      activeViewTransition = viewTransitionDocument.startViewTransition?.(applyThemeChange) ?? null;
    }
    catch {
      activeViewTransition = null;
      applyThemeChange();
      return;
    }

    activeViewTransition?.ready
      .then(() => animateViewTransition(transitionId))
      .catch(() => undefined);
  }

  function applyTheme(theme: Theme) {
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

  function setTheme(theme: Theme) {
    if ((transitionsEnabledRef?.value ?? true) && hasAppliedTheme && theme !== appliedTheme) {
      runThemeTransition(() => applyTheme(theme));
    }
    else {
      applyTheme(theme);
    }

    hasAppliedTheme = true;
    appliedTheme = theme;
  }

  function toggleTheme() {
    return setTheme(currentTheme.value === 'dark' ? 'light' : 'dark');
  }

  function handleSystemThemeChange(event: MediaQueryListEvent) {
    const parsedTheme = parseThemeId(themeSettingRef.value);

    if (parsedTheme?.source === 'builtin' && parsedTheme.builtinThemeId === 'system') {
      if (transitionsEnabledRef?.value ?? true) {
        runThemeTransition(() => applyBaseTheme(event.matches ? 'dark' : 'light'));
      }
      else {
        applyBaseTheme(event.matches ? 'dark' : 'light');
      }
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
