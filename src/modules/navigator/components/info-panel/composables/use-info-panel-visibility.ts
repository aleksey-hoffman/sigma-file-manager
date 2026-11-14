// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  nextTick,
  ref,
  watch,
  type Ref,
} from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

type InfoPanelVisibilityOptions = {
  isSmallScreen: Ref<boolean>;
  showInfoPanelAnimated: () => Promise<void>;
  hideInfoPanelAnimated: () => Promise<void>;
  isInfoPanelVisibilityAnimating: Ref<boolean>;
};

export function useInfoPanelVisibility(options: InfoPanelVisibilityOptions) {
  const userSettingsStore = useUserSettingsStore();
  const storedInfoPanelShow = computed(() => userSettingsStore.userSettings.navigator.infoPanel.show);
  const showInfoPanel = ref(storedInfoPanelShow.value);
  const infoPanelSlideVisible = ref(storedInfoPanelShow.value);
  let ignoreStoredInfoPanelShow = false;
  let applyingInfoPanelVisibility: Promise<void> = Promise.resolve();

  async function persistInfoPanelShow(show: boolean) {
    if (userSettingsStore.userSettings.navigator.infoPanel.show === show) {
      return;
    }

    ignoreStoredInfoPanelShow = true;

    try {
      await userSettingsStore.set('navigator.infoPanel.show', show);
      await nextTick();
    }
    finally {
      ignoreStoredInfoPanelShow = false;
    }
  }

  async function animateInfoPanelVisibility(show: boolean) {
    if (options.isSmallScreen.value) {
      showInfoPanel.value = show;
      infoPanelSlideVisible.value = show;
      return;
    }

    if (
      show === showInfoPanel.value
      && show === infoPanelSlideVisible.value
      && !options.isInfoPanelVisibilityAnimating.value
    ) {
      return;
    }

    if (show) {
      infoPanelSlideVisible.value = true;
      showInfoPanel.value = true;
      await options.showInfoPanelAnimated();
      return;
    }

    infoPanelSlideVisible.value = false;
    await options.hideInfoPanelAnimated();
    showInfoPanel.value = false;
  }

  function enqueueInfoPanelVisibility(show: boolean): Promise<void> {
    const applyVisibility = applyingInfoPanelVisibility
      .catch(() => undefined)
      .then(() => animateInfoPanelVisibility(show));

    applyingInfoPanelVisibility = applyVisibility.then(() => undefined, () => undefined);
    return applyVisibility;
  }

  async function handleToggleInfoPanel() {
    const nextShow = !showInfoPanel.value;
    await persistInfoPanelShow(nextShow);
    await enqueueInfoPanelVisibility(nextShow);
  }

  watch(storedInfoPanelShow, (show) => {
    if (ignoreStoredInfoPanelShow) {
      return;
    }

    enqueueInfoPanelVisibility(show).catch((caughtError: unknown) => {
      console.error('Failed to apply info panel visibility:', caughtError);
    });
  });

  watch(options.isInfoPanelVisibilityAnimating, (isAnimating, wasAnimating) => {
    if (!isAnimating && wasAnimating && showInfoPanel.value) {
      infoPanelSlideVisible.value = true;
      return;
    }

    if (!isAnimating && !showInfoPanel.value) {
      infoPanelSlideVisible.value = false;
    }
  });

  return {
    showInfoPanel,
    infoPanelSlideVisible,
    handleToggleInfoPanel,
  };
}
