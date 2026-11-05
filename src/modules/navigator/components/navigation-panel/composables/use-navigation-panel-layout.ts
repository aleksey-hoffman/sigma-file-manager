// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  inject,
  ref,
  type InjectionKey,
} from 'vue';
import { useIsSmallScreen } from '@/composables/use-responsive-query';
import { INFO_PANEL_LAYOUT } from '@/modules/navigator/constants/info-panel';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  clampNavigationPanelWidthPx,
  NAVIGATION_PANEL_LAYOUT,
} from '../constants';

export type NavigationPanelPhase = 'closed' | 'opening' | 'open' | 'closing';

export function useNavigationPanelLayout() {
  const userSettingsStore = useUserSettingsStore();
  const isSmallScreen = useIsSmallScreen();
  const navigationPanelWidthDefault = computed(() => {
    const savedWidth = userSettingsStore.userSettings.navigator.navigationPanel.widthPx;

    if (savedWidth === null) {
      return NAVIGATION_PANEL_LAYOUT.DEFAULT_WIDTH_PX;
    }

    return clampNavigationPanelWidthPx(savedWidth);
  });
  const phase = ref<NavigationPanelPhase>(
    userSettingsStore.userSettings.navigator.navigationPanel.show ? 'open' : 'closed',
  );
  const navigationPanelWidthPx = ref(phase.value === 'open' ? navigationPanelWidthDefault.value : 0);
  let transitionFallbackTimeoutId: number | null = null;

  const showNavigationPanel = computed(() => phase.value !== 'closed');
  const navigationPanelSlideVisible = computed(() => phase.value === 'opening' || phase.value === 'open');
  const isNavigationPanelVisibilityAnimating = computed(() => phase.value === 'opening' || phase.value === 'closing');
  const navigationPanelUsesFixedWidth = computed(() => phase.value !== 'open');
  const isNavigationPanelHandleCollapsed = computed(() => !navigationPanelSlideVisible.value);

  function persistNavigationPanelOpen(open: boolean) {
    userSettingsStore.set('navigator.navigationPanel.show', open).catch((caughtError: unknown) => {
      console.error('Failed to save navigation panel visibility:', caughtError);
    });
  }

  function persistNavigationPanelWidth() {
    const width = navigationPanelWidthPx.value;

    if (width < 1) {
      return;
    }

    userSettingsStore.set(
      'navigator.navigationPanel.widthPx',
      clampNavigationPanelWidthPx(width),
    ).catch((caughtError: unknown) => {
      console.error('Failed to save navigation panel width:', caughtError);
    });
  }

  function clearTransitionFallback() {
    if (transitionFallbackTimeoutId === null) {
      return;
    }

    window.clearTimeout(transitionFallbackTimeoutId);
    transitionFallbackTimeoutId = null;
  }

  function finishNavigationPanelTransition() {
    clearTransitionFallback();

    switch (phase.value) {
      case 'opening':
        phase.value = 'open';
        return;
      case 'closing':
        phase.value = 'closed';
        navigationPanelWidthPx.value = 0;
        return;
      case 'open':
      case 'closed':
        return;

      default: {
        const unhandledPhase: never = phase.value;
        return unhandledPhase;
      }
    }
  }

  function toggleNavigationPanel() {
    if (isNavigationPanelVisibilityAnimating.value) {
      return;
    }

    const nextOpen = phase.value === 'closed';
    const targetWidth = nextOpen ? navigationPanelWidthDefault.value : 0;
    persistNavigationPanelOpen(nextOpen);

    if (isSmallScreen.value || navigationPanelWidthPx.value === targetWidth) {
      phase.value = nextOpen ? 'open' : 'closed';
      navigationPanelWidthPx.value = targetWidth;
      return;
    }

    phase.value = nextOpen ? 'opening' : 'closing';
    navigationPanelWidthPx.value = targetWidth;
    clearTransitionFallback();
    transitionFallbackTimeoutId = window.setTimeout(
      finishNavigationPanelTransition,
      INFO_PANEL_LAYOUT.SIZE_TRANSITION_MS + NAVIGATION_PANEL_LAYOUT.TRANSITION_END_GRACE_MS,
    );
  }

  function setNavigationPanelWidthPx(pixels: number) {
    navigationPanelWidthPx.value = clampNavigationPanelWidthPx(pixels);
  }

  return {
    showNavigationPanel,
    navigationPanelSlideVisible,
    isNavigationPanelVisibilityAnimating,
    navigationPanelWidthPx,
    navigationPanelWidthDefault,
    navigationPanelUsesFixedWidth,
    isNavigationPanelHandleCollapsed,
    toggleNavigationPanel,
    setNavigationPanelWidthPx,
    persistNavigationPanelWidth,
    handleNavigationPanelWidthTransitionEnd: finishNavigationPanelTransition,
    disposeNavigationPanelLayout: finishNavigationPanelTransition,
  };
}

export const navigationPanelLayoutKey: InjectionKey<ReturnType<typeof useNavigationPanelLayout>> = Symbol('navigationPanelLayout');

export function useNavigationPanelLayoutContext(): ReturnType<typeof useNavigationPanelLayout> {
  const navigationPanelLayout = inject(navigationPanelLayoutKey);

  if (!navigationPanelLayout) {
    throw new Error('Navigation panel layout is missing');
  }

  return navigationPanelLayout;
}
