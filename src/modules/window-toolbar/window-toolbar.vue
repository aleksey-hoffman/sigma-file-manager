<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue';
import { useRoute } from 'vue-router';
import { getCurrentWindow } from '@tauri-apps/api/window';
import Spacer from './spacer.vue';
import WindowActions from './window-actions.vue';
import { GlobalSearchToolbarButton } from '@/modules/global-search';
import { LanShareReplaceDialog, LanShareToolbarButton } from '@/modules/lan-share';
import { StatusCenterToolbarButton } from '@/modules/status-center';
import CommandPaletteToolbarButton from '@/modules/extensions/components/command-palette-toolbar-button.vue';
import { ProgressiveBlur, type ProgressiveBlurLayer } from '@/components/ui/progressive-blur';
import { clearDocumentTextSelection } from '@/utils/document-selection';

interface ToolbarDragSession {
  pointerId: number;
  startClientX: number;
  startClientY: number;
}

const WINDOW_DRAG_MOVE_THRESHOLD_PX = 8;
const WINDOW_DRAG_CLICK_SUPPRESSION_MS = 300;
const WINDOW_DRAG_EXCLUDED_SELECTOR = '.tab-bar';

const route = useRoute();
const appWindow = getCurrentWindow();

let toolbarDragSession: ToolbarDragSession | null = null;
let shouldSuppressNextToolbarClick = false;
let toolbarClickSuppressionTimeout: number | undefined;

const isAbsolute = computed(() => {
  return route.name === 'home';
});

const isBlurred = computed(() => {
  return route.name === 'extensions';
});

const shouldShowGlobalSearchButton = computed(() => {
  return route.name === 'home' || route.name === 'navigator';
});

const shouldShowNavigatorToolbarExtras = computed(() => {
  return route.name === 'navigator';
});

const toolbarProgressiveBlurLayers: ProgressiveBlurLayer[] = [
  {
    amount: '2px',
    start: '0%',
    end: '45%',
  },
  {
    amount: '4px',
    start: '15%',
    end: '60%',
  },
  {
    amount: '8px',
    start: '30%',
    end: '75%',
  },
  {
    amount: '16px',
    start: '45%',
    end: '100%',
  },
];

function clearToolbarClickSuppression() {
  shouldSuppressNextToolbarClick = false;

  if (toolbarClickSuppressionTimeout === undefined) {
    return;
  }

  window.clearTimeout(toolbarClickSuppressionTimeout);
  toolbarClickSuppressionTimeout = undefined;
}

function suppressNextToolbarClick() {
  clearToolbarClickSuppression();
  shouldSuppressNextToolbarClick = true;
  toolbarClickSuppressionTimeout = window.setTimeout(
    clearToolbarClickSuppression,
    WINDOW_DRAG_CLICK_SUPPRESSION_MS,
  );
}

function startToolbarDragTracking() {
  window.addEventListener('pointermove', handleToolbarPointerMove, true);
  window.addEventListener('pointerup', handleToolbarPointerEnd, true);
  window.addEventListener('pointercancel', handleToolbarPointerEnd, true);
}

function stopToolbarDragTracking() {
  window.removeEventListener('pointermove', handleToolbarPointerMove, true);
  window.removeEventListener('pointerup', handleToolbarPointerEnd, true);
  window.removeEventListener('pointercancel', handleToolbarPointerEnd, true);
}

function finishToolbarDragSession() {
  if (!toolbarDragSession) {
    return;
  }

  stopToolbarDragTracking();
  toolbarDragSession = null;
}

function shouldSkipToolbarWindowDrag(event: PointerEvent) {
  if (event.button !== 0 || !event.isPrimary || event.pointerType !== 'mouse') {
    return true;
  }

  if (!(event.target instanceof Element)) {
    return false;
  }

  return Boolean(event.target.closest(WINDOW_DRAG_EXCLUDED_SELECTOR));
}

function handleToolbarPointerDown(event: PointerEvent) {
  if (shouldSkipToolbarWindowDrag(event)) {
    return;
  }

  clearDocumentTextSelection();
  finishToolbarDragSession();

  toolbarDragSession = {
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
  };

  startToolbarDragTracking();
}

function handleToolbarPointerMove(event: PointerEvent) {
  if (!toolbarDragSession || event.pointerId !== toolbarDragSession.pointerId) {
    return;
  }

  const pointerMoveX = event.clientX - toolbarDragSession.startClientX;
  const pointerMoveY = event.clientY - toolbarDragSession.startClientY;
  const pointerMoveDistanceSquared = pointerMoveX * pointerMoveX + pointerMoveY * pointerMoveY;

  if (pointerMoveDistanceSquared < WINDOW_DRAG_MOVE_THRESHOLD_PX ** 2) {
    return;
  }

  finishToolbarDragSession();
  suppressNextToolbarClick();
  appWindow.startDragging().catch((error: unknown) => {
    console.error('Failed to start window drag:', error);
  });
}

function handleToolbarPointerEnd(event: PointerEvent) {
  if (!toolbarDragSession || event.pointerId !== toolbarDragSession.pointerId) {
    return;
  }

  finishToolbarDragSession();
}

function handleToolbarClick(event: MouseEvent) {
  if (!shouldSuppressNextToolbarClick) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  clearToolbarClickSuppression();
}

onBeforeUnmount(() => {
  finishToolbarDragSession();
  clearToolbarClickSuppression();
});
</script>

<template>
  <div
    class="window-toolbar"
    :class="{
      'window-toolbar--blurred': isBlurred,
      'window-toolbar--absolute': isAbsolute
    }"
  >
    <ProgressiveBlur
      v-if="isBlurred"
      class="window-toolbar-progressive-blur"
      :layers="toolbarProgressiveBlurLayers"
    />
    <div
      class="window-toolbar-action-layer"
      @click.capture="handleToolbarClick"
      @pointerdown.capture="handleToolbarPointerDown"
    >
      <LanShareReplaceDialog />
      <CommandPaletteToolbarButton />
      <div class="window-toolbar-extension-embed-teleport-target" />
      <div class="window-toolbar-primary-teleport-target" />
      <Spacer class="window-toolbar-spacer" />
      <div class="window-toolbar-secondary-teleport-target" />
      <div class="window-toolbar-tertiary">
        <LanShareToolbarButton v-if="shouldShowNavigatorToolbarExtras" />
        <StatusCenterToolbarButton v-if="shouldShowNavigatorToolbarExtras" />
        <GlobalSearchToolbarButton v-if="shouldShowGlobalSearchButton" />
      </div>
      <WindowActions />
    </div>
  </div>
</template>

<style scoped>
.window-toolbar-extension-embed-teleport-target {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.window-toolbar-extension-embed-teleport-target:empty {
  display: none;
}

.window-toolbar-primary-teleport-target {
  display: flex;
  max-width: 50%;
}

@media (width <= 1024px) {
  .window-toolbar-primary-teleport-target {
    display: flex;
    max-width: 30%;
  }
}

.window-toolbar-secondary-teleport-target {
  display: flex;
  min-width: 0;
  max-width: 50%;
  align-items: center;
  align-self: stretch;
  justify-content: flex-end;
  gap: 4px;
}

.window-toolbar-secondary-teleport-target :deep(> *) {
  align-self: stretch;
}

.window-toolbar-tertiary {
  display: flex;
  gap: 4px;
}

.window-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  height: var(--window-toolbar-height);
  align-items: center;
  justify-content: space-between;
  background-color: transparent;
}

.window-toolbar--blurred {
  background-color: hsl(var(--background-3) / 20%);
}

.window-toolbar-progressive-blur {
  z-index: 1;
  top: 0;
  height: calc(var(--window-toolbar-height) + 48px);
  inset-inline: 0;
}

.window-toolbar--absolute {
  position: absolute;
  top: 0;
  background: transparent;
  inset-inline: 0;
}

.window-toolbar-spacer {
  z-index: 4;
  -webkit-app-region: drag;
}

.window-toolbar-action-layer {
  position: absolute;
  top: 0;
  display: flex;
  width: 100%;
  height: 100%;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  -webkit-app-region: drag;
  gap: 8px;
  inset-inline-start: 0;
  padding-inline-start: 4px;
}

.window-toolbar-action-layer :deep(*) {
  -webkit-app-region: no-drag;
}

.window-toolbar-action-layer > * {
  z-index: 6;
}
</style>
