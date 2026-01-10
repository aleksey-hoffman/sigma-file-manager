<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  ListIcon,
  CheckCheckIcon,
  XIcon,
  MenuIcon,
  CopyIcon,
  FolderInputIcon,
  ClipboardPasteIcon,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useClipboardStore } from '@/stores/runtime/clipboard';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DirContents, DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import FileBrowserActionsMenu from './file-browser-actions-menu.vue';

const MAX_VISIBLE_ITEMS = 100;

const props = defineProps<{
  dirContents: DirContents | null;
  filteredCount: number;
  selectedCount?: number;
  selectedEntries?: DirEntry[];
}>();

const emit = defineEmits<{
  selectAll: [];
  deselectAll: [];
  removeFromSelection: [entry: DirEntry];
  contextMenuAction: [action: ContextMenuAction];
  paste: [];
}>();

const { t } = useI18n();

const clipboardStore = useClipboardStore();

const showItemsPopoverOpen = ref(false);
const itemsFilterQuery = ref('');
const clipboardItemsPopoverOpen = ref(false);
const clipboardItemsFilterQuery = ref('');

const totalCount = computed(() => props.dirContents?.entries.length ?? 0);
const currentPath = computed(() => props.dirContents?.path ?? '');

const canPaste = computed(() => {
  if (!clipboardStore.hasItems || !currentPath.value) {
    return false;
  }

  return clipboardStore.canPasteTo(currentPath.value);
});

const isFiltered = computed(() => props.filteredCount !== totalCount.value);
const hasSelection = computed(() => (props.selectedCount ?? 0) > 0);

const selectedEntriesArray = computed(() => props.selectedEntries ?? []);

const filteredSelectedEntries = computed(() => {
  if (!itemsFilterQuery.value) {
    return selectedEntriesArray.value;
  }

  const query = itemsFilterQuery.value.toLowerCase();
  return selectedEntriesArray.value.filter(entry =>
    entry.name.toLowerCase().includes(query)
    || entry.path.toLowerCase().includes(query),
  );
});

const displayedEntries = computed(() => {
  return filteredSelectedEntries.value.slice(0, MAX_VISIBLE_ITEMS);
});

const filteredClipboardItems = computed(() => {
  if (!clipboardItemsFilterQuery.value) {
    return clipboardStore.clipboardItems;
  }

  const query = clipboardItemsFilterQuery.value.toLowerCase();
  return clipboardStore.clipboardItems.filter(entry =>
    entry.name.toLowerCase().includes(query)
    || entry.path.toLowerCase().includes(query),
  );
});

const displayedClipboardItems = computed(() => {
  return filteredClipboardItems.value.slice(0, MAX_VISIBLE_ITEMS);
});

const clipboardItemsHeader = computed(() => {
  const total = clipboardStore.itemCount;
  const matched = filteredClipboardItems.value.length;
  const displayed = Math.min(matched, MAX_VISIBLE_ITEMS);

  if (clipboardItemsFilterQuery.value) {
    return t('fileBrowser.matchedNOfItems', {
      matched,
      total,
    });
  }

  if (total > MAX_VISIBLE_ITEMS) {
    return t('fileBrowser.showingNOfItems', {
      showing: displayed,
      total,
    });
  }

  return null;
});

const showItemsHeader = computed(() => {
  const total = selectedEntriesArray.value.length;
  const matched = filteredSelectedEntries.value.length;
  const displayed = Math.min(matched, MAX_VISIBLE_ITEMS);

  if (itemsFilterQuery.value) {
    return t('fileBrowser.matchedNOfItems', {
      matched,
      total,
    });
  }

  if (total > MAX_VISIBLE_ITEMS) {
    return t('fileBrowser.showingNOfItems', {
      showing: displayed,
      total,
    });
  }

  return null;
});

watch(showItemsPopoverOpen, (isOpen) => {
  if (!isOpen) {
    itemsFilterQuery.value = '';
  }
});

watch(clipboardItemsPopoverOpen, (isOpen) => {
  if (!isOpen) {
    clipboardItemsFilterQuery.value = '';
  }
});

watch(() => props.selectedEntries?.length, (length) => {
  if (length === 0) {
    showItemsPopoverOpen.value = false;
  }
});

watch(() => clipboardStore.itemCount, (count) => {
  if (count === 0) {
    clipboardItemsPopoverOpen.value = false;
  }
});

function removeItem(entry: DirEntry) {
  emit('removeFromSelection', entry);
}

function removeClipboardItem(entry: DirEntry) {
  clipboardStore.removeFromClipboard(entry);
}
</script>

<template>
  <div class="file-browser-status-bar-container">
    <div class="file-browser-status-bar">
      <template v-if="hasSelection">
        <span class="file-browser-status-bar__selected-count">
          {{ t('fileBrowser.selectedItems', { count: selectedCount }) }}
        </span>
        <div class="file-browser-status-bar__actions">
          <Popover v-model:open="showItemsPopoverOpen">
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="file-browser-status-bar__button"
                :title="t('showItems')"
              >
                <ListIcon :size="14" />
                <span class="file-browser-status-bar__button-text">{{ t('showItems') }}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              class="file-browser-status-bar__popover"
            >
              <div class="file-browser-status-bar__popover-content">
                <div class="file-browser-status-bar__filter-wrapper">
                  <Input
                    v-model="itemsFilterQuery"
                    :placeholder="t('filter.filter')"
                    class="file-browser-status-bar__filter-input"
                  />
                </div>
                <div
                  v-if="showItemsHeader"
                  class="file-browser-status-bar__items-header"
                >
                  {{ showItemsHeader }}
                </div>
                <ScrollArea class="file-browser-status-bar__scroll-area">
                  <div class="file-browser-status-bar__items-list">
                    <div
                      v-for="entry in displayedEntries"
                      :key="entry.path"
                      class="file-browser-status-bar__item"
                    >
                      <div class="file-browser-status-bar__item-info">
                        <span class="file-browser-status-bar__item-name">{{ entry.name }}</span>
                        <span class="file-browser-status-bar__item-path">{{ entry.path }}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="file-browser-status-bar__item-remove"
                        :title="t('fileBrowser.removeFromSelection')"
                        @click="removeItem(entry)"
                      >
                        <XIcon :size="18" />
                      </Button>
                    </div>
                    <div
                      v-if="displayedEntries.length === 0"
                      class="file-browser-status-bar__no-items"
                    >
                      {{ t('fileBrowser.noMatchingItems') }}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            class="file-browser-status-bar__button"
            :title="t('shortcuts.selectAllItemsInCurrentDirectory')"
            @click="emit('selectAll')"
          >
            <CheckCheckIcon :size="14" />
            <span class="file-browser-status-bar__button-text">{{ t('fileBrowser.selectAll') }}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="file-browser-status-bar__button"
            :title="t('fileBrowser.deselectAll')"
            @click="emit('deselectAll')"
          >
            <XIcon :size="14" />
            <span class="file-browser-status-bar__button-text">{{ t('fileBrowser.deselectAll') }}</span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="file-browser-status-bar__button"
                :title="t('menu')"
              >
                <MenuIcon :size="14" />
                <span class="file-browser-status-bar__button-text">{{ t('menu') }}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side="top"
              class="file-browser-status-bar__menu"
            >
              <FileBrowserActionsMenu
                :selected-entries="selectedEntriesArray"
                :menu-item-component="DropdownMenuItem"
                :menu-separator-component="DropdownMenuSeparator"
                @action="emit('contextMenuAction', $event)"
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </template>
      <template v-else>
        <span v-if="isFiltered">
          {{ t('fileBrowser.showingFiltered', { filtered: filteredCount, total: totalCount }) }}
        </span>
        <span v-else>
          {{ t('fileBrowser.itemsTotal', { count: totalCount }) }}
        </span>
      </template>
    </div>

    <Transition name="clipboard-slide">
      <div
        v-if="clipboardStore.hasItems"
        class="file-browser-clipboard-toolbar"
        :class="{
          'file-browser-clipboard-toolbar--copy': clipboardStore.isCopyOperation,
          'file-browser-clipboard-toolbar--move': clipboardStore.isMoveOperation,
        }"
      >
        <div class="file-browser-clipboard-toolbar__info">
          <div class="file-browser-clipboard-toolbar__icon">
            <CopyIcon
              v-if="clipboardStore.isCopyOperation"
              :size="18"
            />
            <FolderInputIcon
              v-else
              :size="18"
            />
          </div>
          <div class="file-browser-clipboard-toolbar__text">
            <span class="file-browser-clipboard-toolbar__title">
              {{ clipboardStore.isCopyOperation ? t('fileBrowser.preparedForCopying') : t('fileBrowser.preparedForMoving') }}
            </span>
            <span class="file-browser-clipboard-toolbar__count-tag">
              {{ t('fileBrowser.itemsPrepared', { count: clipboardStore.itemCount }) }}
            </span>
          </div>
        </div>
        <div class="file-browser-clipboard-toolbar__actions">
          <Popover v-model:open="clipboardItemsPopoverOpen">
            <PopoverTrigger as-child>
              <Button
                variant="ghost"
                size="sm"
                class="file-browser-clipboard-toolbar__button"
                :title="t('showItems')"
              >
                <ListIcon :size="14" />
                <span class="file-browser-clipboard-toolbar__button-text">{{ t('showItems') }}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              side="top"
              class="file-browser-status-bar__popover"
            >
              <div class="file-browser-status-bar__popover-content">
                <div class="file-browser-status-bar__filter-wrapper">
                  <Input
                    v-model="clipboardItemsFilterQuery"
                    :placeholder="t('filter.filter')"
                    class="file-browser-status-bar__filter-input"
                  />
                </div>
                <div
                  v-if="clipboardItemsHeader"
                  class="file-browser-status-bar__items-header"
                >
                  {{ clipboardItemsHeader }}
                </div>
                <ScrollArea class="file-browser-status-bar__scroll-area">
                  <div class="file-browser-status-bar__items-list">
                    <div
                      v-for="entry in displayedClipboardItems"
                      :key="entry.path"
                      class="file-browser-status-bar__item"
                    >
                      <div class="file-browser-status-bar__item-info">
                        <span class="file-browser-status-bar__item-name">{{ entry.name }}</span>
                        <span class="file-browser-status-bar__item-path">{{ entry.path }}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        class="file-browser-status-bar__item-remove"
                        :title="t('fileBrowser.removeFromClipboard')"
                        @click="removeClipboardItem(entry)"
                      >
                        <XIcon :size="18" />
                      </Button>
                    </div>
                    <div
                      v-if="displayedClipboardItems.length === 0"
                      class="file-browser-status-bar__no-items"
                    >
                      {{ t('fileBrowser.noMatchingItems') }}
                    </div>
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="ghost"
            size="sm"
            class="file-browser-clipboard-toolbar__button"
            :class="{ 'file-browser-clipboard-toolbar__button--disabled': !canPaste }"
            :disabled="!canPaste"
            :title="canPaste ? t('fileBrowser.actions.paste') : t('fileBrowser.cannotPasteHere')"
            @click="emit('paste')"
          >
            <ClipboardPasteIcon :size="14" />
            <span class="file-browser-clipboard-toolbar__button-text">{{ t('fileBrowser.actions.paste') }}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            class="file-browser-clipboard-toolbar__button file-browser-clipboard-toolbar__button--discard"
            :title="t('fileBrowser.discardClipboard')"
            @click="clipboardStore.clearClipboard()"
          >
            <XIcon :size="14" />
            <span class="file-browser-clipboard-toolbar__button-text">{{ t('fileBrowser.discardClipboard') }}</span>
          </Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.file-browser-status-bar-container {
  position: relative;
  flex-shrink: 0;
}

.file-browser-clipboard-toolbar {
  position: absolute;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  backdrop-filter: blur(12px);
  font-size: 13px;
  gap: 16px;
  inset: 0;
}

.file-browser-clipboard-toolbar--copy {
  background: linear-gradient(
    135deg,
    hsl(var(--success) / 20%) 0%,
    hsl(var(--success) / 12%) 50%,
    hsl(var(--success) / 8%) 100%
  );
  color: hsl(var(--success));
}

.file-browser-clipboard-toolbar--move {
  background: linear-gradient(
    135deg,
    hsl(var(--warning) / 20%) 0%,
    hsl(var(--warning) / 12%) 50%,
    hsl(var(--warning) / 8%) 100%
  );
  color: hsl(var(--warning));
}

/* Slide animation */
.clipboard-slide-enter-active {
  transition:
    transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.2s ease-out;
}

.clipboard-slide-leave-active {
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.15s ease-in;
}

.clipboard-slide-enter-from {
  opacity: 0;
  transform: translateY(100%);
}

.clipboard-slide-leave-to {
  opacity: 0;
  transform: translateY(100%);
}

.file-browser-clipboard-toolbar__info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.file-browser-clipboard-toolbar__icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-browser-clipboard-toolbar__text {
  display: flex;
  gap: 6px;
}

.file-browser-clipboard-toolbar__title {
  font-size: 13px;
  font-weight: 500;
}

.file-browser-clipboard-toolbar__count-tag {
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--background-3) / 80%);
  font-size: 12px;
  font-weight: 500;
}

.file-browser-clipboard-toolbar__actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.file-browser-clipboard-toolbar__button {
  height: 30px;
  padding: 0 12px;
  border-radius: 6px;
  background-color: transparent;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  transition:
    background-color 0.15s ease,
    transform 0.1s ease;
}

.file-browser-clipboard-toolbar__button:hover {
  background-color: hsl(var(--background) / 40%);
}

.file-browser-clipboard-toolbar__button:active {
  transform: scale(0.97);
}

.file-browser-clipboard-toolbar__button-text {
  display: none;
}

@media (width >= 600px) {
  .file-browser-clipboard-toolbar__button-text {
    display: inline;
  }
}

.file-browser-clipboard-toolbar__button--disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.file-browser-clipboard-toolbar__button--discard:hover {
  background-color: hsl(var(--destructive) / 30%);
  color: hsl(0deg 100% 70%);
}

/* Regular Status Bar */
.file-browser-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  border-top: 1px solid hsl(var(--border));
  background-color: hsl(var(--background-2));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  gap: 8px;
}

.file-browser-status-bar__selected-count {
  flex-shrink: 0;
}

.file-browser-status-bar__actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.file-browser-status-bar__button {
  height: 26px;
  padding: 0 8px;
  font-size: 11px;
  gap: 4px;
}

.file-browser-status-bar__button-text {
  display: none;
}

@media (width >= 600px) {
  .file-browser-status-bar__button-text {
    display: inline;
  }
}

.file-browser-status-bar__popover {
  width: 320px;
  padding: 0;
}

.file-browser-status-bar__popover-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-browser-status-bar__filter-input {
  width: 100%;
}

.file-browser-status-bar__items-header {
  padding: 4px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.file-browser-status-bar__scroll-area {
  height: 200px;
}

.file-browser-status-bar__scroll-area :deep(.sigma-ui-scroll-area-scrollbar) {
  right: -6px;
}

.file-browser-status-bar__items-list {
  display: flex;
  flex-direction: column;
  margin: 8px;
  gap: 2px;
}

.file-browser-status-bar__item {
  display: flex;
  align-items: stretch;
  border-radius: 4px;
  gap: 8px;
}

.file-browser-status-bar__item:hover {
  background-color: hsl(var(--secondary));
}

.file-browser-status-bar__item-info {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  padding: 6px 0 6px 8px;
  gap: 2px;
}

.file-browser-status-bar__item-name {
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-status-bar__item-path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-browser-status-bar__item-remove {
  flex-shrink: 0;
  align-self: stretch;
}

.file-browser-status-bar__no-items {
  padding: 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-align: center;
}

.file-browser-status-bar__menu {
  width: 200px;
  padding: 8px;
}
</style>

<style>
.file-browser-status-bar__item .file-browser-status-bar__item-remove.sigma-ui-button.sigma-ui-button--size-icon {
  width: 36px;
  height: auto;
  min-height: 100%;
  border-radius: 0 4px 4px 0;
}
</style>
