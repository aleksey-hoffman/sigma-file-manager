// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed, nextTick, onScopeDispose, ref, watch,
} from 'vue';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  clampInfoPanelPx,
  getScaledInfoPanelDefaultPx,
  INFO_PANEL_LAYOUT,
} from '@/modules/navigator/constants/info-panel';
import {
  animatePanelSize,
  animatePanelSizes,
  type AnimatablePanelInstance,
} from '@/modules/navigator/components/info-panel/utils/animate-info-panel-size';

const layoutResetKey = ref(0);
const isLayoutAnimating = ref(false);
const isInfoPanelVisibilityAnimating = ref(false);
const viewportWidthPx = ref(0);
const viewportHeightPx = ref(0);
const infoPanelWidthPanelRef = ref<AnimatablePanelInstance | null>(null);
const previewPanelRef = ref<AnimatablePanelInstance | null>(null);

let viewportListenerCount = 0;
let layoutAnimationGeneration = 0;

function readViewportSize(): void {
  if (typeof window === 'undefined') {
    viewportWidthPx.value = INFO_PANEL_LAYOUT.REFERENCE_NAVIGATOR_WIDTH_PX;
    viewportHeightPx.value = INFO_PANEL_LAYOUT.REFERENCE_NAVIGATOR_HEIGHT_PX;
    return;
  }

  viewportWidthPx.value = window.innerWidth;
  viewportHeightPx.value = window.innerHeight;
}

function registerViewportListener(): void {
  if (typeof window === 'undefined') {
    readViewportSize();
    return;
  }

  if (viewportListenerCount === 0) {
    readViewportSize();
    window.addEventListener('resize', readViewportSize);
  }

  viewportListenerCount += 1;
}

function unregisterViewportListener(): void {
  if (typeof window === 'undefined' || viewportListenerCount === 0) {
    return;
  }

  viewportListenerCount -= 1;

  if (viewportListenerCount === 0) {
    window.removeEventListener('resize', readViewportSize);
  }
}

function getNavigatorAreaWidthPx(): number {
  return Math.max(viewportWidthPx.value, INFO_PANEL_LAYOUT.MIN_WIDTH_PX);
}

function getNavigatorAreaHeightPx(): number {
  return Math.max(viewportHeightPx.value, INFO_PANEL_LAYOUT.MIN_PREVIEW_HEIGHT_PX);
}

function getDynamicInfoPanelWidthPx(): number {
  return getScaledInfoPanelDefaultPx(
    INFO_PANEL_LAYOUT.DEFAULT_WIDTH_PX,
    INFO_PANEL_LAYOUT.REFERENCE_NAVIGATOR_WIDTH_PX,
    getNavigatorAreaWidthPx(),
    INFO_PANEL_LAYOUT.MIN_WIDTH_PX,
    INFO_PANEL_LAYOUT.MAX_WIDTH_PX,
  );
}

function getDynamicPreviewHeightPx(): number {
  return getScaledInfoPanelDefaultPx(
    INFO_PANEL_LAYOUT.DEFAULT_PREVIEW_HEIGHT_PX,
    INFO_PANEL_LAYOUT.REFERENCE_NAVIGATOR_HEIGHT_PX,
    getNavigatorAreaHeightPx(),
    INFO_PANEL_LAYOUT.MIN_PREVIEW_HEIGHT_PX,
    INFO_PANEL_LAYOUT.MAX_PREVIEW_HEIGHT_PX,
  );
}

export function useInfoPanelLayout() {
  registerViewportListener();
  onScopeDispose(unregisterViewportListener);

  const userSettingsStore = useUserSettingsStore();

  const isDynamicSize = computed(() => userSettingsStore.userSettings.navigator.infoPanel.dynamicSize);

  const hasCustomPanelSizes = computed(() => {
    if (isDynamicSize.value) {
      return false;
    }

    const { widthPx, previewHeightPx } = userSettingsStore.userSettings.navigator.infoPanel;

    const widthDiffersFromDefault = widthPx !== null
      && Math.abs(widthPx - INFO_PANEL_LAYOUT.DEFAULT_WIDTH_PX) >= 1;
    const previewDiffersFromDefault = previewHeightPx !== null
      && Math.abs(previewHeightPx - INFO_PANEL_LAYOUT.DEFAULT_PREVIEW_HEIGHT_PX) >= 1;

    return widthDiffersFromDefault || previewDiffersFromDefault;
  });

  const infoPanelWidthDefault = computed(() => {
    if (isDynamicSize.value) {
      return getDynamicInfoPanelWidthPx();
    }

    return userSettingsStore.userSettings.navigator.infoPanel.widthPx
      ?? INFO_PANEL_LAYOUT.DEFAULT_WIDTH_PX;
  });

  const previewHeightDefault = computed(() => {
    if (isDynamicSize.value) {
      return getDynamicPreviewHeightPx();
    }

    return userSettingsStore.userSettings.navigator.infoPanel.previewHeightPx
      ?? INFO_PANEL_LAYOUT.DEFAULT_PREVIEW_HEIGHT_PX;
  });

  const layoutSizingKey = computed(() => layoutResetKey.value);

  async function persistWidthPx(pixels: number) {
    await userSettingsStore.set(
      'navigator.infoPanel.widthPx',
      clampInfoPanelPx(
        pixels,
        0,
        INFO_PANEL_LAYOUT.MAX_WIDTH_PX,
      ),
    );
  }

  async function persistPreviewHeightPx(pixels: number) {
    await userSettingsStore.set(
      'navigator.infoPanel.previewHeightPx',
      clampInfoPanelPx(
        pixels,
        INFO_PANEL_LAYOUT.MIN_PREVIEW_HEIGHT_PX,
        INFO_PANEL_LAYOUT.MAX_PREVIEW_HEIGHT_PX,
      ),
    );
  }

  function isInfoPanelWidthVisible(): boolean {
    const currentInfoPanelWidth = infoPanelWidthPanelRef.value?.getSize();

    return currentInfoPanelWidth !== undefined && currentInfoPanelWidth >= 1;
  }

  function applyInfoPanelWidthTarget() {
    const panel = infoPanelWidthPanelRef.value;

    if (!panel) {
      return;
    }

    const widthTarget = infoPanelWidthDefault.value;
    const currentWidth = panel.getSize();

    if (currentWidth === undefined || Math.abs(currentWidth - widthTarget) >= 1) {
      panel.resize(widthTarget);
    }
  }

  function applyInfoPanelPreviewTarget() {
    const previewPanel = previewPanelRef.value;

    if (!previewPanel) {
      return;
    }

    const previewTarget = previewHeightDefault.value;
    const currentPreview = previewPanel.getSize();

    if (Math.abs(currentPreview - previewTarget) >= 1) {
      previewPanel.resize(previewTarget);
    }
  }

  function applyVisiblePanelSizes() {
    if (!isInfoPanelWidthVisible()) {
      return;
    }

    applyInfoPanelWidthTarget();
    applyInfoPanelPreviewTarget();
  }

  function syncPersistedPanelSizes() {
    if (isLayoutAnimating.value || isInfoPanelVisibilityAnimating.value) {
      return;
    }

    applyVisiblePanelSizes();
  }

  async function waitForInfoPanelVisibilityAnimationEnd() {
    while (isInfoPanelVisibilityAnimating.value) {
      await nextTick();
    }
  }

  async function ensureInfoPanelWidthRestored() {
    await waitForInfoPanelVisibilityAnimationEnd();

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const panel = infoPanelWidthPanelRef.value;

      if (!panel) {
        await nextTick();
        continue;
      }

      const target = infoPanelWidthDefault.value;
      const currentWidth = panel.getSize();

      if (currentWidth !== undefined && Math.abs(currentWidth - target) < 1) {
        applyInfoPanelPreviewTarget();
        return;
      }

      panel.resize(target);
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      });
    }
  }

  async function finishInfoPanelVisibilityAnimation(shown: boolean) {
    if (!shown) {
      infoPanelWidthPanelRef.value?.resize(0);
      isInfoPanelVisibilityAnimating.value = false;
      return;
    }

    isInfoPanelVisibilityAnimating.value = false;
    await nextTick();

    const panel = infoPanelWidthPanelRef.value;
    const target = infoPanelWidthDefault.value;
    const currentWidth = panel?.getSize();
    const widthMatchesTarget = currentWidth !== undefined && Math.abs(currentWidth - target) < 1;

    if (!widthMatchesTarget) {
      await ensureInfoPanelWidthRestored();
      return;
    }

    applyInfoPanelPreviewTarget();
  }

  async function animateInfoPanelWidthOpen() {
    isInfoPanelVisibilityAnimating.value = true;

    try {
      const panel = infoPanelWidthPanelRef.value;

      if (!panel) {
        return;
      }

      if (panel.getSize() >= 1) {
        panel.resize(0);
      }

      await animatePanelSize(panel, infoPanelWidthDefault.value);
    }
    finally {
      await finishInfoPanelVisibilityAnimation(true);
    }
  }

  function getStaticPanelSizes() {
    return {
      width: userSettingsStore.userSettings.navigator.infoPanel.widthPx
        ?? INFO_PANEL_LAYOUT.DEFAULT_WIDTH_PX,
      preview: userSettingsStore.userSettings.navigator.infoPanel.previewHeightPx
        ?? INFO_PANEL_LAYOUT.DEFAULT_PREVIEW_HEIGHT_PX,
    };
  }

  function beginLayoutAnimation(): number {
    const animationGeneration = layoutAnimationGeneration + 1;
    layoutAnimationGeneration = animationGeneration;
    isLayoutAnimating.value = true;

    return animationGeneration;
  }

  function endLayoutAnimation(animationGeneration: number) {
    if (animationGeneration === layoutAnimationGeneration) {
      isLayoutAnimating.value = false;
    }
  }

  function hasSavedStaticSizes(): boolean {
    const { widthPx, previewHeightPx } = userSettingsStore.userSettings.navigator.infoPanel;

    return widthPx !== null || previewHeightPx !== null;
  }

  async function savePreviewHeightAsStatic(pixels: number) {
    await persistPreviewHeightPx(pixels);
    await userSettingsStore.set('navigator.infoPanel.dynamicSize', false);
  }

  async function freezeLayoutAsStatic() {
    const width = infoPanelWidthPanelRef.value?.getSize();
    const preview = previewPanelRef.value?.getSize();

    if (width !== undefined && width >= 1) {
      await persistWidthPx(width);
    }

    if (preview !== undefined) {
      await persistPreviewHeightPx(preview);
    }

    await userSettingsStore.set('navigator.infoPanel.dynamicSize', false);
  }

  async function enableDynamicSize() {
    const animationGeneration = beginLayoutAnimation();

    try {
      await userSettingsStore.set('navigator.infoPanel.dynamicSize', true);
      await nextTick();

      await animatePanelSizes([
        {
          panel: infoPanelWidthPanelRef.value,
          targetSize: getDynamicInfoPanelWidthPx(),
        },
        {
          panel: previewPanelRef.value,
          targetSize: getDynamicPreviewHeightPx(),
        },
      ]);
    }
    finally {
      endLayoutAnimation(animationGeneration);
    }
  }

  async function disableDynamicSize() {
    if (hasSavedStaticSizes()) {
      const { width, preview } = getStaticPanelSizes();
      const animationGeneration = beginLayoutAnimation();

      try {
        await userSettingsStore.set('navigator.infoPanel.dynamicSize', false);
        await nextTick();

        await animatePanelSizes([
          {
            panel: infoPanelWidthPanelRef.value,
            targetSize: width,
          },
          {
            panel: previewPanelRef.value,
            targetSize: preview,
          },
        ]);
      }
      finally {
        endLayoutAnimation(animationGeneration);
      }

      return;
    }

    const width = infoPanelWidthPanelRef.value?.getSize();
    const preview = previewPanelRef.value?.getSize();

    await userSettingsStore.set('navigator.infoPanel.dynamicSize', false);

    if (width !== undefined) {
      await persistWidthPx(width);
    }

    if (preview !== undefined) {
      await persistPreviewHeightPx(preview);
    }
  }

  async function resetLayout() {
    const animationGeneration = beginLayoutAnimation();

    try {
      await userSettingsStore.set('navigator.infoPanel.widthPx', null);
      await userSettingsStore.set('navigator.infoPanel.previewHeightPx', null);
      await nextTick();

      if (isDynamicSize.value) {
        await animatePanelSizes([
          {
            panel: infoPanelWidthPanelRef.value,
            targetSize: getDynamicInfoPanelWidthPx(),
          },
          {
            panel: previewPanelRef.value,
            targetSize: getDynamicPreviewHeightPx(),
          },
        ]);
        return;
      }

      await animatePanelSizes([
        {
          panel: infoPanelWidthPanelRef.value,
          targetSize: INFO_PANEL_LAYOUT.DEFAULT_WIDTH_PX,
        },
        {
          panel: previewPanelRef.value,
          targetSize: INFO_PANEL_LAYOUT.DEFAULT_PREVIEW_HEIGHT_PX,
        },
      ]);
    }
    finally {
      endLayoutAnimation(animationGeneration);
    }
  }

  function handleInfoPanelWidthHandleDragging(isDragging: boolean) {
    if (isDragging) {
      return;
    }

    void freezeLayoutAsStatic();
  }

  function handlePreviewHeightHandleDragging(isDragging: boolean) {
    if (isDragging) {
      return;
    }

    void freezeLayoutAsStatic();
  }

  function setInfoPanelWidthPanelRef(instance: unknown) {
    infoPanelWidthPanelRef.value = instance as AnimatablePanelInstance | null;
  }

  function setPreviewPanelRef(instance: unknown) {
    previewPanelRef.value = instance as AnimatablePanelInstance | null;
  }

  function syncInfoPanelCssVariables() {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.style.setProperty(
      '--info-panel-width-value',
      String(infoPanelWidthDefault.value),
    );
    document.documentElement.style.setProperty(
      '--info-panel-preview-height',
      `${previewHeightDefault.value}px`,
    );
  }

  watch(
    [
      viewportWidthPx,
      viewportHeightPx,
      isDynamicSize,
      isInfoPanelVisibilityAnimating,
    ],
    () => {
      void nextTick(() => {
        if (!isDynamicSize.value) {
          return;
        }

        syncPersistedPanelSizes();
      });
    },
  );

  watch(
    [
      infoPanelWidthPanelRef,
      previewPanelRef,
      infoPanelWidthDefault,
      previewHeightDefault,
      isDynamicSize,
    ],
    () => {
      void nextTick(() => {
        if (isDynamicSize.value) {
          return;
        }

        syncPersistedPanelSizes();
      });
    },
  );

  watch(isInfoPanelVisibilityAnimating, (isAnimating, wasAnimating) => {
    if (!isAnimating && wasAnimating) {
      void nextTick(syncPersistedPanelSizes);
    }
  });

  watch(
    [infoPanelWidthDefault, previewHeightDefault],
    syncInfoPanelCssVariables,
    { immediate: true },
  );

  async function showInfoPanelAnimated() {
    return animateInfoPanelWidthOpen();
  }

  async function hideInfoPanelAnimated() {
    isInfoPanelVisibilityAnimating.value = true;

    try {
      const panel = infoPanelWidthPanelRef.value;

      if (!panel) {
        return;
      }

      await animatePanelSize(panel, 0);
    }
    finally {
      await finishInfoPanelVisibilityAnimation(false);
    }
  }

  return {
    layoutResetKey,
    layoutSizingKey,
    isDynamicSize,
    hasCustomPanelSizes,
    isInfoPanelVisibilityAnimating,
    infoPanelWidthDefault,
    previewHeightDefault,
    setInfoPanelWidthPanelRef,
    setPreviewPanelRef,
    resetLayout,
    ensureInfoPanelWidthRestored,
    showInfoPanelAnimated,
    hideInfoPanelAnimated,
    savePreviewHeightAsStatic,
    enableDynamicSize,
    disableDynamicSize,
    handleInfoPanelWidthHandleDragging,
    handlePreviewHeightHandleDragging,
    infoPanelLayout: INFO_PANEL_LAYOUT,
  };
}
