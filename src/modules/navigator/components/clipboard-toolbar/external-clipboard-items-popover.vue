<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { ImageIcon, SearchIcon, XIcon } from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import {
  canTransferClipboardItemTo,
  filterClipboardToolbarItems,
  getClipboardItemCardDetails,
  type ClipboardToolbarItem,
} from './clipboard-toolbar-items';
import { useClipboardItems } from './use-clipboard-items';
import { useClipboardItemDrag } from './use-clipboard-item-drag';
import ExternalClipboardPasteButton from './external-clipboard-paste-button.vue';
import {
  useExternalClipboardContext,
  type ExternalClipboardPasteTarget,
  type ExternalClipboardTransferOperation,
} from './external-clipboard-context';

const FILTER_MIN_ITEMS = 5;

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  interactOutside: [event: CustomEvent<{ originalEvent: Event }>];
}>();

const { t } = useI18n();
const clipboardStore = useClipboardStore();
const externalClipboardContext = useExternalClipboardContext();
const filterQuery = ref('');

const {
  clipboardToolbarItems,
  toDisplayedClipboardItems,
} = useClipboardItems(() => props.open);

const showFilter = computed(() => clipboardToolbarItems.value.length >= FILTER_MIN_ITEMS || Boolean(filterQuery.value));
const sourceAppName = computed(() => clipboardStore.clipboardSourceAppName);
const sourceIconUrl = computed(() => clipboardStore.clipboardSourceIconUrl);
const filteredClipboardItems = computed(() => {
  const normalizedQuery = filterQuery.value.trim().toLowerCase();

  if (normalizedQuery && sourceAppName.value?.toLowerCase().includes(normalizedQuery)) {
    return clipboardToolbarItems.value;
  }

  return filterClipboardToolbarItems(clipboardToolbarItems.value, filterQuery.value);
});
const displayedClipboardItems = computed(() => toDisplayedClipboardItems(filteredClipboardItems.value));
const hiddenClipboardItemCount = computed(() => filteredClipboardItems.value.length - displayedClipboardItems.value.length);
const pasteTargets = computed(() => externalClipboardContext?.pasteTargets.value ?? []);
const itemOperation = computed<ExternalClipboardTransferOperation>(() => clipboardStore.isMoveOperation ? 'move' : 'copy');

function formatItemCardDetails(item: ClipboardToolbarItem): string {
  const details = getClipboardItemCardDetails(item);

  if (sourceAppName.value && details) {
    return `\u00A0· ${details}`;
  }

  return details;
}

const footerNote = computed(() => {
  if (filterQuery.value) {
    return t('fileBrowser.matchedNOfItems', {
      matched: filteredClipboardItems.value.length,
      total: clipboardToolbarItems.value.length,
    });
  }

  if (hiddenClipboardItemCount.value > 0) {
    return t('fileBrowser.showingNOfItems', {
      total: clipboardToolbarItems.value.length,
      hidden: hiddenClipboardItemCount.value,
    });
  }

  return null;
});

const { isDraggingItem, handleItemMouseDown } = useClipboardItemDrag(transferItemTo);

async function transferItemTo(item: ClipboardToolbarItem, destinationPath: string) {
  if (!externalClipboardContext) {
    return;
  }

  if (item.kind === 'system-image') {
    await externalClipboardContext.copyClipboardImageTo(destinationPath);
    return;
  }

  if (item.entry) {
    const operation = itemOperation.value;
    const didTransfer = await externalClipboardContext.transferEntriesTo([item.entry], destinationPath, operation);

    if (didTransfer && operation === 'move') {
      clipboardStore.removeFromClipboard(item.entry);
    }
  }
}

async function handlePasteTargetClick(item: ClipboardToolbarItem, target: ExternalClipboardPasteTarget) {
  if (!target.path) {
    return;
  }

  await transferItemTo(item, target.path);
}

watch(() => props.open, (isOpen) => {
  if (!isOpen) {
    filterQuery.value = '';
  }
});
</script>

<template>
  <PopoverContent
    side="top"
    align="start"
    :side-offset="8"
    :collision-padding="12"
    class="external-clipboard-items-popover"
    :class="{
      'external-clipboard-items-popover--dragging': isDraggingItem,
      'external-clipboard-items-popover--move': clipboardStore.isMoveOperation,
    }"
    @interact-outside="emit('interactOutside', $event)"
  >
    <div
      v-if="showFilter"
      class="external-clipboard-items-popover__filter"
    >
      <SearchIcon
        :size="15"
        class="external-clipboard-items-popover__filter-icon"
      />
      <Input
        v-model="filterQuery"
        :placeholder="t('filter.filter')"
        class="external-clipboard-items-popover__filter-input"
      />
      <Button
        v-if="filterQuery"
        variant="ghost"
        size="icon"
        class="external-clipboard-items-popover__filter-clear"
        :aria-label="t('globalSearch.clearSearchField')"
        @click="filterQuery = ''"
      >
        <XIcon :size="14" />
      </Button>
    </div>
    <ScrollArea class="external-clipboard-items-popover__scroll-area">
      <ul
        v-if="displayedClipboardItems.length > 0"
        class="external-clipboard-items-popover__list"
      >
        <li
          v-for="item in displayedClipboardItems"
          :key="item.key"
          class="external-clipboard-card"
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
            <span class="external-clipboard-card__details">
              <span
                v-if="sourceAppName"
                class="external-clipboard-card__source"
              >
                <img
                  v-if="sourceIconUrl"
                  :src="sourceIconUrl"
                  alt=""
                  class="external-clipboard-card__source-icon"
                  draggable="false"
                >
                <span>{{ sourceAppName }}</span>
              </span>
              <span class="external-clipboard-card__meta">{{ formatItemCardDetails(item) }}</span>
            </span>
          </span>
          <ExternalClipboardPasteButton
            size="small"
            :targets="pasteTargets"
            :can-paste-to="target => canTransferClipboardItemTo(item, target.path, itemOperation)"
            @paste="target => handlePasteTargetClick(item, target)"
          />
        </li>
      </ul>
      <div
        v-else
        class="external-clipboard-items-popover__empty"
      >
        {{ t('fileBrowser.noMatchingItems') }}
      </div>
      <div
        v-if="footerNote"
        class="external-clipboard-items-popover__hidden-note"
      >
        {{ footerNote }}
      </div>
    </ScrollArea>
  </PopoverContent>
</template>

<style>
.sigma-ui-popover-content.external-clipboard-items-popover {
  --external-clipboard-accent: var(--warning);

  width: 380px;
  max-width: calc(100vw - 24px);
  padding: 0;
  transition: opacity 0.15s ease;
}

.sigma-ui-popover-content.external-clipboard-items-popover--move {
  --external-clipboard-accent: var(--destructive);
}

.external-clipboard-items-popover--dragging {
  opacity: 0.35;
  pointer-events: none;
}

.external-clipboard-items-popover__filter {
  position: relative;
  display: flex;
  align-items: center;
  padding: 8px 8px 0;
}

.external-clipboard-items-popover__filter-icon {
  position: absolute;
  z-index: 1;
  color: hsl(var(--muted-foreground));
  inset-inline-start: 18px;
  pointer-events: none;
}

.external-clipboard-items-popover__filter-input.sigma-ui-input {
  width: 100%;
  height: 32px;
  border-color: hsl(var(--border) / 80%);
  background-color: hsl(var(--muted) / 40%);
  box-shadow: none;
  font-size: 12px;
  padding-inline: 32px 30px;
}

.external-clipboard-items-popover__filter-input.sigma-ui-input:focus-visible {
  background-color: hsl(var(--background));
}

.external-clipboard-items-popover__filter-clear {
  position: absolute;
  width: 24px;
  height: 24px;
  inset-inline-end: 12px;
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
  border-color: hsl(var(--external-clipboard-accent) / 45%);
  background-color: hsl(var(--external-clipboard-accent) / 6%);
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
  display: flex;
  overflow: hidden;
  min-width: 0;
  align-items: center;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  white-space: nowrap;
}

.external-clipboard-card__source {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

.external-clipboard-card__source-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  object-fit: contain;
}

.external-clipboard-card__meta {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
}

.external-clipboard-items-popover__empty {
  padding: 18px 12px 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}

.external-clipboard-items-popover__hidden-note {
  padding: 0 12px 10px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}
</style>
