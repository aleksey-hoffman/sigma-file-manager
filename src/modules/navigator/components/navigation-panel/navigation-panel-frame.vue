<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { GripVerticalIcon } from '@lucide/vue';
import NavigationPanel from './navigation-panel.vue';
import { useNavigationPanelLayoutContext } from './composables/use-navigation-panel-layout';
import { NAVIGATION_PANEL_LAYOUT } from './constants';

defineProps<{
  activePath: string;
  compact?: boolean;
}>();

const emit = defineEmits<{
  navigate: [path: string];
}>();

const { t } = useI18n();
const columnRef = ref<HTMLElement | null>(null);
const isResizing = ref(false);

const {
  showNavigationPanel,
  navigationPanelSlideVisible,
  isNavigationPanelVisibilityAnimating,
  navigationPanelWidthPx,
  navigationPanelWidthDefault,
  navigationPanelUsesFixedWidth,
  isNavigationPanelHandleCollapsed,
  setNavigationPanelWidthPx,
  persistNavigationPanelWidth,
  handleNavigationPanelWidthTransitionEnd,
} = useNavigationPanelLayoutContext();

let stopResizeListeners: (() => void) | null = null;
let keyboardWidthChanged = false;

function handleNavigate(path: string) {
  emit('navigate', path);
}

function handleWidthTransitionEnd(event: TransitionEvent) {
  if (event.target !== event.currentTarget || event.propertyName !== 'width') {
    return;
  }

  handleNavigationPanelWidthTransitionEnd();
}

function readMaxWidthPx(): number {
  const workspaceWidth = columnRef.value?.parentElement?.clientWidth ?? 0;

  if (workspaceWidth < 1) {
    return NAVIGATION_PANEL_LAYOUT.MAX_WIDTH_PX;
  }

  return Math.max(1, Math.floor(workspaceWidth / 2));
}

function readColumnWidthPx(): number {
  return columnRef.value?.getBoundingClientRect().width ?? navigationPanelWidthPx.value;
}

function getResizeDirectionSign(handle: HTMLElement): number {
  return getComputedStyle(handle).direction === 'rtl' ? -1 : 1;
}

function resizeTo(widthPx: number) {
  setNavigationPanelWidthPx(Math.min(readMaxWidthPx(), Math.max(0, widthPx)));
}

function canResize(): boolean {
  return !isNavigationPanelHandleCollapsed.value && !isNavigationPanelVisibilityAnimating.value;
}

function stopResize() {
  stopResizeListeners?.();
  stopResizeListeners = null;

  if (!isResizing.value) {
    return;
  }

  isResizing.value = false;
  persistNavigationPanelWidth();
}

function handleResizePointerDown(event: PointerEvent) {
  const handle = event.currentTarget;

  if (event.button !== 0 || !canResize() || !(handle instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  handle.setPointerCapture(event.pointerId);
  isResizing.value = true;

  const startWidth = readColumnWidthPx();
  const startX = event.clientX;
  const directionSign = getResizeDirectionSign(handle);

  function move(moveEvent: PointerEvent) {
    if (moveEvent.pointerId === event.pointerId) {
      resizeTo(startWidth + (moveEvent.clientX - startX) * directionSign);
    }
  }

  function end(endEvent: PointerEvent) {
    if (endEvent.pointerId === event.pointerId) {
      stopResize();
    }
  }

  stopResizeListeners = () => {
    handle.removeEventListener('pointermove', move);
    handle.removeEventListener('pointerup', end);
    handle.removeEventListener('pointercancel', end);
  };

  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function getKeyboardResizeStep(key: string): number {
  if (key === 'ArrowRight') {
    return NAVIGATION_PANEL_LAYOUT.RESIZE_KEYBOARD_STEP_PX;
  }

  if (key === 'ArrowLeft') {
    return -NAVIGATION_PANEL_LAYOUT.RESIZE_KEYBOARD_STEP_PX;
  }

  return 0;
}

function handleResizeKeyDown(event: KeyboardEvent) {
  const handle = event.currentTarget;
  const step = getKeyboardResizeStep(event.key);

  if (step === 0 || !canResize() || !(handle instanceof HTMLElement)) {
    return;
  }

  event.preventDefault();
  keyboardWidthChanged = true;
  resizeTo(readColumnWidthPx() + step * getResizeDirectionSign(handle));
}

function persistKeyboardResize() {
  if (!keyboardWidthChanged) {
    return;
  }

  keyboardWidthChanged = false;
  persistNavigationPanelWidth();
}

function handleResizeKeyUp(event: KeyboardEvent) {
  if (getKeyboardResizeStep(event.key) !== 0) {
    persistKeyboardResize();
  }
}

onUnmounted(() => {
  stopResize();
});
</script>

<template>
  <template v-if="compact">
    <NavigationPanel
      v-if="showNavigationPanel"
      class="navigation-panel-frame--compact"
      :active-path="activePath"
      :updates-paused="isNavigationPanelVisibilityAnimating"
      @navigate="handleNavigate"
    />
  </template>
  <template v-else>
    <div
      ref="columnRef"
      class="navigation-panel-frame__column"
      :class="{
        'navigation-panel-frame__column--closed': isNavigationPanelHandleCollapsed,
        'navigation-panel-frame__column--resizing': isResizing,
      }"
      :style="{ width: `${navigationPanelWidthPx}px` }"
      @transitionend="handleWidthTransitionEnd"
    >
      <div
        class="navigation-panel-frame__slide"
        :class="{
          'navigation-panel-frame__slide--visible': navigationPanelSlideVisible,
          'navigation-panel-frame__slide--fixed': navigationPanelUsesFixedWidth,
        }"
        :style="{ '--navigation-panel-content-width': `${navigationPanelWidthDefault}px` }"
      >
        <NavigationPanel
          v-if="showNavigationPanel"
          :active-path="activePath"
          :updates-paused="isNavigationPanelVisibilityAnimating"
          @navigate="handleNavigate"
        />
      </div>
    </div>
    <div
      class="sigma-ui-resizable-handle navigation-panel-frame__handle"
      :class="{ 'navigation-panel-frame__handle--collapsed': isNavigationPanelHandleCollapsed }"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('navigator.navigationPanel')"
      :aria-hidden="isNavigationPanelHandleCollapsed || undefined"
      :aria-valuemin="0"
      :aria-valuenow="Math.round(navigationPanelWidthPx)"
      :aria-valuemax="readMaxWidthPx()"
      :tabindex="isNavigationPanelHandleCollapsed ? -1 : 0"
      @pointerdown="handleResizePointerDown"
      @keydown="handleResizeKeyDown"
      @keyup="handleResizeKeyUp"
      @blur="persistKeyboardResize"
    >
      <div class="sigma-ui-resizable-handle__grip">
        <GripVerticalIcon
          class="sigma-ui-resizable-handle__grip-icon"
          aria-hidden="true"
        />
      </div>
    </div>
  </template>
</template>

<style scoped>
.navigation-panel-frame--compact {
  max-height: 240px;
  flex: none;
}

.navigation-panel-frame__column {
  position: relative;
  overflow: hidden;
  min-width: 0;
  max-width: 50%;
  height: 100%;
  flex: 0 0 auto;
  transition:
    width var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing),
    margin-inline var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigation-panel-frame__column--closed {
  margin-inline-end: calc(-1 * var(--navigator-workspace-gap));
}

.navigation-panel-frame__column--resizing {
  transition: none;
}

.navigation-panel-frame__slide {
  position: absolute;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  transform: translateX(-100%);
  transition: transform var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigation-panel-frame__slide--fixed {
  width: var(--navigation-panel-content-width);
  min-width: var(--navigation-panel-content-width);
  inset-block: 0;
  inset-inline-start: 0;
}

.navigation-panel-frame__slide--visible {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  inset: 0;
  transform: translateX(0);
}

.navigation-panel-frame__handle {
  overflow: visible;
  min-width: 0;
  max-width: 16px;
  flex-shrink: 0;
  cursor: col-resize;
  opacity: 1;
  touch-action: none;
  transition:
    max-width var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing),
    margin-inline var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing),
    opacity var(--info-panel-visibility-transition-ms) var(--info-panel-visibility-transition-easing);
}

.navigation-panel-frame__handle--collapsed {
  overflow: hidden;
  max-width: 0;
  margin-inline-end: calc(-1 * var(--navigator-workspace-gap));
  opacity: 0;
  pointer-events: none;
}
</style>
