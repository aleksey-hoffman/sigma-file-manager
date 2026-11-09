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
import { useElementSize } from '@vueuse/core';
import { PopoverAnchor } from 'reka-ui';
import {
  ClipboardIcon,
  ClipboardPasteIcon,
  ImageIcon,
  ScissorsIcon,
  XIcon,
} from '@lucide/vue';
import { Popover, PopoverTrigger } from '@/components/ui/popover';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import ExternalClipboardItemsPopover from './external-clipboard-items-popover.vue';
import { useClipboardItemDragActive } from './use-clipboard-item-drag';
import {
  getPasteTargetLabelKey,
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
let collapseTimeout: ReturnType<typeof setTimeout> | null = null;

const restContentSize = useElementSize(restContentRef, undefined, { box: 'border-box' });
const expandedContentSize = useElementSize(expandedContentRef, undefined, { box: 'border-box' });

const isExpanded = computed(() => isHovered.value
  || hasFocusWithin.value
  || isItemsPopoverOpen.value
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
  await externalClipboardContext?.pasteClipboard(target.paneIndex);
}

function handlePopoverInteractOutside(event: CustomEvent<{ originalEvent: Event }>) {
  const interactionTarget = event.detail.originalEvent.target as Node | null;

  if (interactionTarget && pillRef.value?.contains(interactionTarget)) {
    event.preventDefault();
  }
}

watch(() => clipboardStore.showExternalClipboardWidget, (isVisible) => {
  if (!isVisible) {
    isItemsPopoverOpen.value = false;
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
              :size="12"
            />
            <span class="external-clipboard-widget__rest-count">{{ clipboardStore.itemCount }}</span>
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
                <component
                  :is="clipboardIcon"
                  :size="14"
                  class="external-clipboard-widget__summary-icon"
                />
                <span class="external-clipboard-widget__title">{{ titleLabel }}</span>
                <span class="external-clipboard-widget__count">{{ itemCountLabel }}</span>
              </button>
            </PopoverTrigger>
            <span class="external-clipboard-widget__divider" />
            <button
              v-for="target in pasteTargets"
              :key="target.paneIndex ?? 'active'"
              type="button"
              class="external-clipboard-widget__action external-clipboard-widget__action--paste"
              :disabled="!canPasteTo(target)"
              :aria-label="t(getPasteTargetLabelKey(target))"
              :title="t(getPasteTargetLabelKey(target))"
              @click="pasteTo(target)"
            >
              <ClipboardPasteIcon :size="14" />
              <span class="external-clipboard-widget__paste-label">{{ t(getPasteTargetLabelKey(target)) }}</span>
              <span
                v-if="target.paneIndex !== null"
                class="external-clipboard-widget__paste-pane"
              >{{ target.paneIndex + 1 }}</span>
            </button>
            <button
              type="button"
              class="external-clipboard-widget__action external-clipboard-widget__action--discard"
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
  height: 22px;
  flex-shrink: 0;
  margin-right: 8px;
}

.external-clipboard-widget::after {
  position: absolute;
  top: 5px;
  right: -9px;
  width: 1px;
  height: 12px;
  background-color: hsl(var(--border));
  content: "";
}

.external-clipboard-widget__pill {
  position: absolute;
  z-index: 30;
  bottom: 0;
  left: 0;
  overflow: hidden;
  border: 1px solid hsl(var(--external-clipboard-accent) / 35%);
  border-radius: 999px;
  background:
    linear-gradient(hsl(var(--external-clipboard-accent) / 12%), hsl(var(--external-clipboard-accent) / 12%)),
    hsl(var(--background-2));
  color: hsl(var(--external-clipboard-accent));
  transition:
    width 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    height 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    box-shadow 0.2s ease,
    border-color 0.2s ease;
}

.external-clipboard-widget__pill--move {
  --external-clipboard-accent: var(--destructive);
}

.external-clipboard-widget__pill--expanded {
  border-color: hsl(var(--external-clipboard-accent) / 45%);
  background:
    linear-gradient(hsl(var(--external-clipboard-accent) / 9%), hsl(var(--external-clipboard-accent) / 9%)),
    hsl(var(--background-2));
  box-shadow:
    0 12px 32px -8px rgb(0 0 0 / 45%),
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
  height: 20px;
  padding: 0 8px 0 7px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  gap: 5px;
  transition: opacity 0.12s ease;
}

.external-clipboard-widget__expanded {
  width: max-content;
  max-width: calc(100cqw - 16px);
  height: 38px;
  padding: 0 5px;
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
  transition-delay: 0.06s;
}

.external-clipboard-widget__summary {
  display: flex;
  min-width: 0;
  height: 28px;
  flex-shrink: 1;
  align-items: center;
  padding: 0 8px 0 9px;
  border-radius: 999px;
  cursor: pointer;
  gap: 8px;
  transition: background-color 0.15s ease;
}

.external-clipboard-widget__summary:hover,
.external-clipboard-widget__summary[aria-expanded="true"] {
  background-color: hsl(var(--foreground) / 8%);
}

.external-clipboard-widget__summary-icon {
  flex-shrink: 0;
}

.external-clipboard-widget__title {
  overflow: hidden;
  min-width: 0;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.external-clipboard-widget__count {
  flex-shrink: 0;
  padding: 1px 7px;
  border-radius: 999px;
  background-color: hsl(var(--external-clipboard-accent) / 16%);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.external-clipboard-widget__divider {
  width: 1px;
  height: 16px;
  flex-shrink: 0;
  margin: 0 4px;
  background-color: hsl(var(--border));
}

.external-clipboard-widget__action {
  display: inline-flex;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  border-radius: 999px;
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  transition:
    background-color 0.15s ease,
    color 0.15s ease;
}

.external-clipboard-widget__action--paste:not(:disabled):hover {
  background-color: hsl(var(--success) / 16%);
  color: hsl(var(--success));
}

.external-clipboard-widget__action--discard {
  width: 28px;
  padding: 0;
  color: hsl(var(--muted-foreground));
}

.external-clipboard-widget__action--discard:hover {
  background-color: hsl(var(--destructive) / 16%);
  color: hsl(var(--destructive));
}

.external-clipboard-widget__summary:focus-visible,
.external-clipboard-widget__action:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.external-clipboard-widget__paste-pane {
  display: none;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.external-clipboard-widget__action:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

@container (width < 480px) {
  .external-clipboard-widget__title,
  .external-clipboard-widget__paste-label {
    display: none;
  }

  .external-clipboard-widget__paste-pane {
    display: inline;
  }

  .external-clipboard-widget__action--paste {
    padding: 0 8px;
    gap: 4px;
  }
}

@container (width < 260px) {
  .external-clipboard-widget__count {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .external-clipboard-widget__pill,
  .external-clipboard-widget__rest,
  .external-clipboard-widget__expanded {
    transition: none;
  }
}
</style>
