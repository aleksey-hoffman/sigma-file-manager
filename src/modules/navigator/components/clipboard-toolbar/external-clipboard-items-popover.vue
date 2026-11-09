<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ClipboardPasteIcon, ImageIcon } from '@lucide/vue';
import { PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  canCopyClipboardItemTo,
  getClipboardItemCardDetails,
  type ClipboardToolbarItem,
} from './clipboard-toolbar-items';
import { useClipboardItems } from './use-clipboard-items';
import { useClipboardItemDrag } from './use-clipboard-item-drag';
import {
  getPasteTargetLabelKey,
  useExternalClipboardContext,
  type ExternalClipboardPasteTarget,
} from './external-clipboard-context';

const props = defineProps<{
  open: boolean;
}>();

const { t } = useI18n();
const externalClipboardContext = useExternalClipboardContext();

const {
  clipboardToolbarItems,
  toDisplayedClipboardItems,
} = useClipboardItems(() => props.open);

const displayedClipboardItems = computed(() => toDisplayedClipboardItems(clipboardToolbarItems.value));
const hiddenClipboardItemCount = computed(() => clipboardToolbarItems.value.length - displayedClipboardItems.value.length);
const pasteTargets = computed(() => externalClipboardContext?.pasteTargets.value ?? []);

const { isDraggingItem, handleItemMouseDown } = useClipboardItemDrag(copyItemTo);

async function copyItemTo(item: ClipboardToolbarItem, destinationPath: string) {
  if (!externalClipboardContext) {
    return;
  }

  if (item.kind === 'system-image') {
    await externalClipboardContext.copyClipboardImageTo(destinationPath);
    return;
  }

  if (item.entry) {
    await externalClipboardContext.copyEntriesTo([item.entry], destinationPath);
  }
}

async function handlePasteTargetClick(item: ClipboardToolbarItem, target: ExternalClipboardPasteTarget) {
  if (!target.path) {
    return;
  }

  await copyItemTo(item, target.path);
}
</script>

<template>
  <PopoverContent
    side="top"
    align="start"
    :side-offset="8"
    :collision-padding="12"
    class="external-clipboard-items-popover"
    :class="{ 'external-clipboard-items-popover--dragging': isDraggingItem }"
  >
    <ScrollArea class="external-clipboard-items-popover__scroll-area">
      <ul class="external-clipboard-items-popover__list">
        <li
          v-for="item in displayedClipboardItems"
          :key="item.key"
          class="external-clipboard-card"
          :title="item.path"
          @mousedown="handleItemMouseDown(item, $event)"
        >
          <span class="external-clipboard-card__preview">
            <img
              v-if="item.previewSrc"
              :src="item.previewSrc"
              :alt="item.name"
              class="external-clipboard-card__preview-image"
              draggable="false"
            >
            <ImageIcon
              v-else-if="item.showImageFallback"
              :size="16"
            />
            <component
              :is="item.icon"
              v-else
              :size="16"
            />
          </span>
          <span class="external-clipboard-card__text">
            <span class="external-clipboard-card__name">{{ item.name }}</span>
            <span class="external-clipboard-card__details">{{ getClipboardItemCardDetails(item) }}</span>
          </span>
          <span class="external-clipboard-card__actions">
            <button
              v-for="target in pasteTargets"
              :key="target.paneIndex ?? 'active'"
              type="button"
              class="external-clipboard-card__paste"
              :disabled="!canCopyClipboardItemTo(item, target.path)"
              :aria-label="t(getPasteTargetLabelKey(target))"
              :title="t(getPasteTargetLabelKey(target))"
              @click="handlePasteTargetClick(item, target)"
            >
              <ClipboardPasteIcon :size="14" />
              <span
                v-if="target.paneIndex !== null"
                class="external-clipboard-card__paste-pane"
              >{{ target.paneIndex + 1 }}</span>
            </button>
          </span>
        </li>
      </ul>
      <div
        v-if="hiddenClipboardItemCount > 0"
        class="external-clipboard-items-popover__hidden-note"
      >
        {{ t('fileBrowser.showingNOfItems', { total: clipboardToolbarItems.length, hidden: hiddenClipboardItemCount }) }}
      </div>
    </ScrollArea>
  </PopoverContent>
</template>

<style>
.sigma-ui-popover-content.external-clipboard-items-popover {
  width: 380px;
  max-width: calc(100vw - 24px);
  padding: 0;
  transition: opacity 0.15s ease;
}

.external-clipboard-items-popover--dragging {
  opacity: 0.35;
  pointer-events: none;
}

.external-clipboard-items-popover__scroll-area {
  max-height: min(420px, 60vh);
}

.external-clipboard-items-popover__scroll-area .sigma-ui-scroll-area__viewport {
  max-height: min(420px, 60vh);
}

.external-clipboard-items-popover__list {
  display: flex;
  flex-direction: column;
  padding: 8px;
  margin: 0;
  gap: 6px;
  list-style: none;
}

.external-clipboard-card {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  padding: 7px 7px 7px 8px;
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 10px;
  background-color: hsl(var(--background-2) / 60%);
  cursor: grab;
  gap: 10px;
  transition:
    border-color 0.15s ease,
    background-color 0.15s ease;
  user-select: none;
}

.external-clipboard-card:hover {
  border-color: hsl(var(--warning) / 45%);
  background-color: hsl(var(--warning) / 6%);
}

.external-clipboard-card__preview {
  display: flex;
  overflow: hidden;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: 7px;
  background-color: hsl(var(--foreground) / 7%);
  color: hsl(var(--muted-foreground));
}

.external-clipboard-card__preview-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.external-clipboard-card__text {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  line-height: 1.25;
}

.external-clipboard-card__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.external-clipboard-card__details {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.external-clipboard-card__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.external-clipboard-card__paste {
  display: inline-flex;
  min-width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0 7px;
  border: 1px solid hsl(var(--border) / 70%);
  border-radius: 7px;
  background-color: hsl(var(--background-3) / 60%);
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  gap: 4px;
  transition:
    background-color 0.15s ease,
    border-color 0.15s ease,
    color 0.15s ease;
}

.external-clipboard-card__paste:not(:disabled):hover {
  border-color: hsl(var(--success) / 50%);
  background-color: hsl(var(--success) / 16%);
  color: hsl(var(--success));
}

.external-clipboard-card__paste:focus-visible {
  outline: 2px solid hsl(var(--ring) / 50%);
  outline-offset: var(--ring-outline-offset);
}

.external-clipboard-card__paste:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.external-clipboard-items-popover__hidden-note {
  padding: 0 12px 10px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}
</style>
