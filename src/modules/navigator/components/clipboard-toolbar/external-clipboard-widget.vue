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
  ImageIcon,
  ScissorsIcon,
  XIcon,
} from '@lucide/vue';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import ExternalClipboardItemsPopover from './external-clipboard-items-popover.vue';
import ExternalClipboardPasteButton from './external-clipboard-paste-button.vue';
import { useClipboardItemDragActive } from './use-clipboard-item-drag';
import {
  useExternalClipboardContext,
  type ExternalClipboardPasteTarget,
} from './external-clipboard-context';

const COLLAPSE_DELAY_MS = 160;
const PILL_BORDER_WIDTH = 2;

const { t } = useI18n();
const clipboardStore = useClipboardStore();
const externalClipboardContext = useExternalClipboardContext();
const isClipboardItemDragActive = useClipboardItemDragActive();

const pillRef = ref<HTMLElement | null>(null);
const restContentRef = ref<HTMLElement | null>(null);
const expandedContentRef = ref<HTMLElement | null>(null);
const isHovered = ref(false);
const hasFocusWithin = ref(false);
const isItemsPopoverOpen = ref(false);
const isPasteMenuOpen = ref(false);
const isPinnedOpen = ref(false);
let collapseTimeout: ReturnType<typeof setTimeout> | null = null;

const restContentSize = useElementSize(restContentRef, undefined, { box: 'border-box' });
const expandedContentSize = useElementSize(expandedContentRef, undefined, { box: 'border-box' });

const isExpanded = computed(() => isHovered.value
  || hasFocusWithin.value
  || isItemsPopoverOpen.value
  || isPasteMenuOpen.value
  || isPinnedOpen.value
  || isClipboardItemDragActive.value);

const restWidth = computed(() => restContentSize.width.value + PILL_BORDER_WIDTH);

const pillStyle = computed(() => {
  const contentSize = isExpanded.value ? expandedContentSize : restContentSize;

  return {
    width: `${contentSize.width.value + PILL_BORDER_WIDTH}px`,
    height: `${contentSize.height.value + PILL_BORDER_WIDTH}px`,
  };
});

const clipboardIcon = computed(() => {
  if (clipboardStore.hasImageContent) {
    return ImageIcon;
  }

  return clipboardStore.isMoveOperation ? ScissorsIcon : ClipboardIcon;
});

const titleLabel = computed(() => clipboardStore.isMoveOperation
  ? t('fileBrowser.cutInAnotherApp')
  : t('fileBrowser.copiedInAnotherApp'));

const itemCountLabel = computed(() => t('fileBrowser.itemsPrepared', { count: clipboardStore.itemCount }));
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
  hasFocusWithin.value = (event.target as Element).matches(':focus-visible');
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

onBeforeUnmount(clearCollapseTimeout);
</script>

<template>
  <div
    v-if="clipboardStore.showExternalClipboardWidget"
    class="external-clipboard-widget"
    :style="{ width: `${restWidth}px` }"
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
            ref="restContentRef"
            class="external-clipboard-widget__rest"
            aria-hidden="true"
          >
            <component
              :is="clipboardIcon"
              :size="14"
              class="external-clipboard-widget__icon"
            />
            <span class="external-clipboard-widget__badge">{{ clipboardStore.itemCount }}</span>
          </div>
          <div
            ref="expandedContentRef"
            class="external-clipboard-widget__expanded"
          >
            <PopoverTrigger as-child>
              <button
                type="button"
                class="external-clipboard-widget__summary"
                :aria-expanded="isItemsPopoverOpen"
                :aria-label="`${titleLabel}, ${itemCountLabel}`"
              >
                <span class="external-clipboard-widget__summary-icon">
                  <component
                    :is="clipboardIcon"
                    :size="16"
                    class="external-clipboard-widget__icon"
                  />
                </span>
                <span class="external-clipboard-widget__text">
                  <span class="external-clipboard-widget__title">{{ titleLabel }}</span>
                  <span class="external-clipboard-widget__subtitle">{{ itemCountLabel }}</span>
                </span>
              </button>
            </PopoverTrigger>
            <span class="external-clipboard-widget__divider" />
            <ExternalClipboardPasteButton
              v-model:menu-open="isPasteMenuOpen"
              :targets="pasteTargets"
              :can-paste-to="canPasteTo"
              @paste="pasteTo"
            />
            <button
              type="button"
              class="external-clipboard-widget__discard"
              :aria-label="t('fileBrowser.discardClipboard')"
              :title="t('fileBrowser.discardClipboard')"
              @click="clipboardStore.discardClipboard()"
            >
              <XIcon :size="14" />
            </button>
          </div>
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

  position: relative;
  height: 32px;
  flex-shrink: 0;
}

.external-clipboard-widget__pill {
  position: absolute;
  z-index: 30;
  bottom: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
  border-radius: 16px;
  background-color: hsl(var(--background-2));
  transition:
    width 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    border-radius 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.24s ease;
}

.external-clipboard-widget__pill--move {
  --external-clipboard-accent: var(--destructive);
}

.external-clipboard-widget__pill--expanded {
  border-radius: 24px;
  box-shadow:
    0 14px 36px -10px rgb(0 0 0 / 50%),
    0 4px 12px -6px rgb(0 0 0 / 30%);
}

.external-clipboard-widget__rest,
.external-clipboard-widget__expanded {
  position: absolute;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  white-space: nowrap;
}

.external-clipboard-widget__rest {
  height: 30px;
  padding: 0 7px 0 10px;
  gap: 7px;
  transition: opacity 0.14s ease;
}

.external-clipboard-widget__icon {
  flex-shrink: 0;
  color: hsl(var(--external-clipboard-accent));
}

.external-clipboard-widget__badge {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background-color: hsl(var(--external-clipboard-accent) / 18%);
  color: hsl(var(--external-clipboard-accent));
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: center;
}

.external-clipboard-widget__expanded {
  width: max-content;
  max-width: calc(100cqw - 8px);
  height: 46px;
  padding: 0 7px 0 5px;
  gap: 2px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.16s ease;
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__rest {
  opacity: 0;
  pointer-events: none;
}

.external-clipboard-widget__pill--expanded .external-clipboard-widget__expanded {
  opacity: 1;
  pointer-events: auto;
  transition-delay: 0.08s;
}

.external-clipboard-widget__summary {
  display: flex;
  min-width: 0;
  height: 36px;
  flex-shrink: 1;
  align-items: center;
  padding: 0 12px 0 4px;
  border-radius: 999px;
  cursor: pointer;
  gap: 9px;
  text-align: left;
  transition: background-color 0.15s ease;
}

.external-clipboard-widget__summary:hover,
.external-clipboard-widget__summary[aria-expanded="true"] {
  background-color: hsl(var(--foreground) / 7%);
}

.external-clipboard-widget__summary-icon {
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background-color: hsl(var(--foreground) / 6%);
}

.external-clipboard-widget__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  line-height: 1.2;
}

.external-clipboard-widget__title,
.external-clipboard-widget__subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
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
  border-radius: 999px;
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
  .external-clipboard-widget__rest,
  .external-clipboard-widget__expanded {
    transition: none;
  }
}
</style>
