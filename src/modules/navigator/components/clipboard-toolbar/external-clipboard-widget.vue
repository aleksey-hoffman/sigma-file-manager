<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { useElementSize, useEventListener } from '@vueuse/core';
import { PopoverAnchor } from 'reka-ui';
import {
  ClipboardIcon,
  ChevronsUpDownIcon,
  ImageIcon,
  ScissorsIcon,
  XIcon,
} from '@lucide/vue';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import ExternalClipboardItemsPopover from './external-clipboard-items-popover.vue';
import ExternalClipboardPasteButton from './external-clipboard-paste-button.vue';
import { getClipboardImageSubtitle } from './clipboard-toolbar-items';
import { useClipboardItemDragActive } from './use-clipboard-item-drag';
import {
  useExternalClipboardContext,
  type ExternalClipboardPasteTarget,
} from './external-clipboard-context';

const COLLAPSE_DELAY_MS = 160;
const PILL_BORDER_WIDTH = 2;
const REST_PILL_HEIGHT = 32;
const EXPANDED_PILL_HEIGHT = 48;
const COLLAPSED_ICON_LEFT = 10;
const COLLAPSED_ICON_SIZE = 14;
const COLLAPSED_ICON_GAP = 7;
const COLLAPSED_PADDING_RIGHT = 7;
const FOOTER_GAP_WIDTH = 6;
const SUMMARY_PADDING_LEFT = 4;
const EXPANDED_ICON_PLATE_SIZE = 28;

const { t } = useI18n();
const clipboardStore = useClipboardStore();
const externalClipboardContext = useExternalClipboardContext();
const isClipboardItemDragActive = useClipboardItemDragActive();

const pillRef = ref<HTMLElement | null>(null);
const layoutRef = ref<HTMLElement | null>(null);
const badgeRef = ref<HTMLElement | null>(null);
const isHovered = ref(false);
const hasFocusWithin = ref(false);
const isItemsPopoverOpen = ref(false);
const isPasteMenuOpen = ref(false);
const isPinnedOpen = ref(false);
let collapseTimeout: ReturnType<typeof setTimeout> | null = null;

const layoutSize = useElementSize(layoutRef, undefined, { box: 'border-box' });
const badgeSize = useElementSize(badgeRef, undefined, { box: 'border-box' });

const isExpanded = computed(() => isHovered.value
  || hasFocusWithin.value
  || isItemsPopoverOpen.value
  || isPasteMenuOpen.value
  || isPinnedOpen.value
  || isClipboardItemDragActive.value);

const restWidth = computed(() => COLLAPSED_ICON_LEFT
  + COLLAPSED_ICON_SIZE
  + COLLAPSED_ICON_GAP
  + badgeSize.width.value
  + COLLAPSED_PADDING_RIGHT
  + PILL_BORDER_WIDTH);

const widgetStyle = computed(() => ({
  'width': `${restWidth.value}px`,
  '--collapsed-icon-left': `${COLLAPSED_ICON_LEFT}px`,
  '--collapsed-icon-size': `${COLLAPSED_ICON_SIZE}px`,
  '--collapsed-icon-gap': `${COLLAPSED_ICON_GAP}px`,
  '--collapsed-padding-right': `${COLLAPSED_PADDING_RIGHT}px`,
  '--summary-padding-left': `${SUMMARY_PADDING_LEFT}px`,
  '--expanded-icon-plate-size': `${EXPANDED_ICON_PLATE_SIZE}px`,
}));

const pillStyle = computed(() => ({
  width: `${isExpanded.value ? Math.max(layoutSize.width.value + PILL_BORDER_WIDTH, restWidth.value) : restWidth.value}px`,
  height: `${isExpanded.value ? EXPANDED_PILL_HEIGHT : REST_PILL_HEIGHT}px`,
}));

const clipboardIcon = computed(() => {
  if (clipboardStore.hasImageContent) {
    return ImageIcon;
  }

  return clipboardStore.isMoveOperation ? ScissorsIcon : ClipboardIcon;
});

const titleLabel = computed(() => {
  const sourceAppName = clipboardStore.clipboardSourceAppName;

  if (sourceAppName) {
    return clipboardStore.isMoveOperation
      ? t('fileBrowser.cutInApp', { app: sourceAppName })
      : t('fileBrowser.copiedInApp', { app: sourceAppName });
  }

  return clipboardStore.isMoveOperation
    ? t('fileBrowser.cutInAnotherApp')
    : t('fileBrowser.copiedInAnotherApp');
});

const subtitleLabel = computed(() => {
  if (clipboardStore.clipboardImage) {
    return `${t('image')} · ${getClipboardImageSubtitle(clipboardStore.clipboardImage)}`;
  }

  return t('fileBrowser.itemsPrepared', { count: clipboardStore.itemCount });
});
const pasteTargets = computed(() => externalClipboardContext?.pasteTargets.value ?? []);

function clearCollapseTimeout() {
  if (collapseTimeout) {
    clearTimeout(collapseTimeout);
    collapseTimeout = null;
  }
}

function handleMouseEnter() {
  clearCollapseTimeout();
  isHovered.value = true;
}

function handleMouseLeave() {
  clearCollapseTimeout();
  isPinnedOpen.value = false;
  collapseTimeout = setTimeout(() => {
    isHovered.value = false;
    collapseTimeout = null;
  }, COLLAPSE_DELAY_MS);
}

function handleFocusIn(event: FocusEvent) {
  hasFocusWithin.value = event.target instanceof Element && event.target.matches(':focus-visible');
}

function handleFocusOut(event: FocusEvent) {
  const nextFocusedElement = event.relatedTarget as Node | null;
  hasFocusWithin.value = Boolean(nextFocusedElement && pillRef.value?.contains(nextFocusedElement));
}

function canPasteTo(target: ExternalClipboardPasteTarget): boolean {
  if (!target.path || !clipboardStore.hasItems) {
    return false;
  }

  return clipboardStore.canPasteTo(target.path);
}

async function pasteTo(target: ExternalClipboardPasteTarget) {
  if (target.paneIndex !== null) {
    isPinnedOpen.value = true;
  }

  await externalClipboardContext?.pasteClipboard(target.paneIndex);
}

function handlePopoverInteractOutside(event: CustomEvent<{ originalEvent: Event }>) {
  const interactionTarget = event.detail.originalEvent.target as Node | null;

  if (interactionTarget && pillRef.value?.contains(interactionTarget)) {
    event.preventDefault();
  }
}

useEventListener(window, 'pointerdown', (event: PointerEvent) => {
  const interactionTarget = event.target as Element | null;

  if (!isPinnedOpen.value || pillRef.value?.contains(interactionTarget)) {
    return;
  }

  if (!interactionTarget?.closest('[data-dismissable-layer]')) {
    isPinnedOpen.value = false;
  }
}, { capture: true });

watch(() => clipboardStore.showExternalClipboardWidget, (isVisible) => {
  if (!isVisible) {
    isItemsPopoverOpen.value = false;
    isPasteMenuOpen.value = false;
    isPinnedOpen.value = false;
    isHovered.value = false;
    hasFocusWithin.value = false;
  }
});

watch(
  () => clipboardStore.showExternalClipboardWidget ? restWidth.value + FOOTER_GAP_WIDTH : 0,
  (footprintPx) => {
    if (externalClipboardContext) {
      externalClipboardContext.restFootprintPx.value = footprintPx;
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearCollapseTimeout();

  if (externalClipboardContext) {
    externalClipboardContext.restFootprintPx.value = 0;
  }
});
</script>

<template>
  <div
    v-if="clipboardStore.showExternalClipboardWidget"
    class="external-clipboard-widget"
    :style="widgetStyle"
  >
    <Popover v-model:open="isItemsPopoverOpen">
      <PopoverAnchor as-child>
        <div
          ref="pillRef"
          class="external-clipboard-widget__pill"
          :class="{
            'external-clipboard-widget__pill--expanded': isExpanded,
            'external-clipboard-widget__pill--move': clipboardStore.isMoveOperation,
          }"
          :style="pillStyle"
          @mouseenter="handleMouseEnter"
          @mouseleave="handleMouseLeave"
          @focusin="handleFocusIn"
          @focusout="handleFocusOut"
        >
          <div
            ref="layoutRef"
            class="external-clipboard-widget__layout"
          >
            <PopoverTrigger as-child>
              <button
                type="button"
                class="external-clipboard-widget__summary"
                :aria-expanded="isItemsPopoverOpen"
                :aria-label="`${titleLabel}, ${subtitleLabel}`"
              >
                <span class="external-clipboard-widget__icon-slot">
                  <span class="external-clipboard-widget__icon-plate">
                    <span class="external-clipboard-widget__icon-glyph">
                      <component
                        :is="clipboardIcon"
                        :size="16"
                        class="external-clipboard-widget__icon"
                      />
                    </span>
                  </span>
                </span>
                <span class="external-clipboard-widget__text">
                  <span class="external-clipboard-widget__title-row">
                    <img
                      v-if="clipboardStore.clipboardSourceIconUrl"
                      :src="clipboardStore.clipboardSourceIconUrl"
                      alt=""
                      class="external-clipboard-widget__source-icon"
                      draggable="false"
                    >
                    <span class="external-clipboard-widget__title">{{ titleLabel }}</span>
                  </span>
                  <span class="external-clipboard-widget__subtitle">{{ subtitleLabel }}</span>
                </span>
                <ChevronsUpDownIcon
                  :size="14"
                  class="external-clipboard-widget__disclosure"
                />
              </button>
            </PopoverTrigger>
            <div class="external-clipboard-widget__actions">
              <span class="external-clipboard-widget__divider" />
              <ExternalClipboardPasteButton
                v-model:menu-open="isPasteMenuOpen"
                label-key="fileBrowser.actions.pasteAll"
                :targets="pasteTargets"
                :can-paste-to="canPasteTo"
                @paste="pasteTo"
              />
              <button
                type="button"
                class="external-clipboard-widget__discard"
                :aria-label="t('fileBrowser.discardClipboard')"
                @click="clipboardStore.discardClipboard()"
              >
                <XIcon :size="14" />
              </button>
            </div>
          </div>
          <span
            ref="badgeRef"
            class="external-clipboard-widget__badge"
            aria-hidden="true"
          >{{ clipboardStore.itemCount }}</span>
        </div>
      </PopoverAnchor>
      <ExternalClipboardItemsPopover
        :open="isItemsPopoverOpen"
        @interact-outside="handlePopoverInteractOutside"
      />
    </Popover>
  </div>
</template>

<style scoped>
.external-clipboard-widget {
  --external-clipboard-accent: var(--warning);
  --clipboard-morph-duration: 0.4s;
  --clipboard-morph-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --expanded-icon-size: 16px;

  position: absolute;
  z-index: 30;
  bottom: 0;
  left: 0;
  height: 32px;
}

.external-clipboard-widget__pill {
  position: absolute;
  bottom: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background-2));
  transition:
    width var(--clipboard-morph-duration) var(--clipboard-morph-ease),
    height var(--clipboard-morph-duration) var(--clipboard-morph-ease),
    box-shadow var(--clipboard-morph-duration) var(--clipboard-morph-ease);
}

.external-clipboard-widget__pill--move {
  --external-clipboard-accent: var(--destructive);
}

.external-clipboard-widget__pill--expanded {
  box-shadow:
    0 14px 36px -10px rgb(0 0 0 / 50%),
    0 4px 12px -6px rgb(0 0 0 / 30%);
}

.external-clipboard-widget__layout {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  display: flex;
  width: max-content;
  max-width: calc(100cqw - 8px);
  align-items: center;
  padding: 0 var(--collapsed-padding-right) 0 calc(var(--collapsed-icon-left) - var(--summary-padding-left));
  gap: 2px;
  pointer-events: none;
  white-space: nowrap;
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__layout {
  pointer-events: auto;
}

.external-clipboard-widget__icon-slot {
  display: flex;
  width: var(--expanded-icon-plate-size);
  height: var(--expanded-icon-plate-size);
  flex-shrink: 0;
  align-items: center;
  justify-content: flex-start;
}

.external-clipboard-widget__icon-plate {
  display: flex;
  width: var(--collapsed-icon-size);
  height: var(--collapsed-icon-size);
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: transparent;
  transition:
    width var(--clipboard-morph-duration) var(--clipboard-morph-ease),
    height var(--clipboard-morph-duration) var(--clipboard-morph-ease),
    background-color var(--clipboard-morph-duration) var(--clipboard-morph-ease);
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__icon-plate {
  width: var(--expanded-icon-plate-size);
  height: var(--expanded-icon-plate-size);
  background-color: hsl(var(--foreground) / 6%);
}

.external-clipboard-widget__icon-glyph {
  display: flex;
  width: var(--collapsed-icon-size);
  height: var(--collapsed-icon-size);
  flex-shrink: 0;
  transition:
    width var(--clipboard-morph-duration) var(--clipboard-morph-ease),
    height var(--clipboard-morph-duration) var(--clipboard-morph-ease);
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__icon-glyph {
  width: var(--expanded-icon-size);
  height: var(--expanded-icon-size);
}

.external-clipboard-widget__icon {
  width: 100%;
  height: 100%;
  color: hsl(var(--external-clipboard-accent));
}

.external-clipboard-widget__badge {
  position: absolute;
  z-index: 1;
  top: 50%;
  left: calc(var(--collapsed-icon-left) + var(--collapsed-icon-size) + var(--collapsed-icon-gap));
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background-color: hsl(var(--external-clipboard-accent) / 18%);
  color: hsl(var(--external-clipboard-accent));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  pointer-events: none;
  text-align: center;
  transform: translateY(-50%);
  transition: opacity 0.2s ease 0.14s;
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__badge {
  opacity: 0;
  transition: opacity 0.12s ease;
}

.external-clipboard-widget__summary {
  display: flex;
  min-width: 0;
  height: 36px;
  flex-shrink: 1;
  align-items: center;
  padding: 0 12px 0 var(--summary-padding-left);
  border-radius: var(--radius-sm);
  cursor: pointer;
  gap: 9px;
  pointer-events: auto;
  text-align: left;
  transition: background-color 0.15s ease;
}

.external-clipboard-widget__summary:hover,
.external-clipboard-widget__summary[aria-expanded="true"] {
  background-color: hsl(var(--foreground) / 7%);
}

.external-clipboard-widget__text,
.external-clipboard-widget__disclosure,
.external-clipboard-widget__actions {
  opacity: 0;
  transition: opacity 0.12s ease;
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__text,
.external-clipboard-widget__pill--expanded .external-clipboard-widget__disclosure,
.external-clipboard-widget__pill--expanded .external-clipboard-widget__actions {
  opacity: 1;
  transition: opacity 0.28s ease 0.06s;
}

.external-clipboard-widget__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.2;
}

.external-clipboard-widget__title-row {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
}

.external-clipboard-widget__source-icon {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  object-fit: contain;
}

.external-clipboard-widget__title,
.external-clipboard-widget__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
}

.external-clipboard-widget__disclosure {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.external-clipboard-widget__title {
  color: hsl(var(--foreground));
  font-size: 12.5px;
  font-weight: 600;
}

.external-clipboard-widget__subtitle {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}

.external-clipboard-widget__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
}

.external-clipboard-widget__divider {
  width: 1px;
  height: 18px;
  flex-shrink: 0;
  margin: 0 4px;
  background-color: hsl(var(--border));
}

.external-clipboard-widget__discard {
  display: inline-flex;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.external-clipboard-widget__discard:hover {
  background-color: hsl(var(--destructive) / 16%);
  color: hsl(var(--destructive));
}

.external-clipboard-widget__summary:focus-visible,
.external-clipboard-widget__discard:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

@media (prefers-reduced-motion: reduce) {
  .external-clipboard-widget__pill,
  .external-clipboard-widget__icon-plate,
  .external-clipboard-widget__icon-glyph,
  .external-clipboard-widget__text,
  .external-clipboard-widget__disclosure,
  .external-clipboard-widget__actions,
  .external-clipboard-widget__badge,
  .external-clipboard-widget__pill--expanded .external-clipboard-widget__text,
  .external-clipboard-widget__pill--expanded .external-clipboard-widget__disclosure,
  .external-clipboard-widget__pill--expanded .external-clipboard-widget__actions,
  .external-clipboard-widget__pill--expanded .external-clipboard-widget__badge {
    transition: none;
  }
}
</style>
