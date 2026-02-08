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
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
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
import { formatBytes } from './utils';

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
}>();

const { t } = useI18n();

const dirSizesStore = useDirSizesStore();

const showItemsPopoverOpen = ref(false);
const itemsFilterQuery = ref('');

const totalCount = computed(() => props.dirContents?.entries.length ?? 0);

const isFiltered = computed(() => props.filteredCount !== totalCount.value);
const hasSelection = computed(() => (props.selectedCount ?? 0) > 0);

const selectedEntriesArray = computed(() => props.selectedEntries ?? []);

const selectionStats = computed(() => {
  const entries = selectedEntriesArray.value;
  if (entries.length === 0) return null;

  let totalSize = 0;
  let fileCount = 0;
  let dirCount = 0;
  let hasUnknownSize = false;

  for (const entry of entries) {
    if (entry.is_file) {
      fileCount++;
      totalSize += entry.size;
    }
    else if (entry.is_dir) {
      dirCount++;
      const dirSizeInfo = dirSizesStore.getSize(entry.path);

      if (dirSizeInfo && dirSizeInfo.status === 'Complete') {
        totalSize += dirSizeInfo.size;
      }
      else {
        hasUnknownSize = true;
      }
    }
  }

  return {
    totalSize,
    fileCount,
    dirCount,
    hasUnknownSize,
  };
});

const selectionSizeDisplay = computed(() => {
  if (!selectionStats.value) return null;

  const { totalSize, fileCount, dirCount, hasUnknownSize } = selectionStats.value;

  const parts = [];

  if (fileCount > 0) {
    parts.push(t('fileBrowser.fileCount', { count: fileCount }));
  }

  if (dirCount > 0) {
    parts.push(t('fileBrowser.directoryCount', { count: dirCount }));
  }

  const countStr = parts.join(', ');

  const sizeStr = hasUnknownSize ? null : formatBytes(totalSize);

  return {
    sizeStr,
    countStr,
  };
});

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

watch(() => props.selectedEntries?.length, (length) => {
  if (length === 0) {
    showItemsPopoverOpen.value = false;
  }
});

function removeItem(entry: DirEntry) {
  emit('removeFromSelection', entry);
}
</script>

<template>
  <div class="file-browser-status-bar">
    <template v-if="hasSelection">
      <span class="file-browser-status-bar__selected-count">
        {{ t('fileBrowser.selectedItems', { count: selectedCount }) }}
        <template v-if="selectionSizeDisplay">
          <span class="file-browser-status-bar__separator">·</span>
          <span class="file-browser-status-bar__size-info">
            <template v-if="selectionSizeDisplay.sizeStr">
              {{ selectionSizeDisplay.sizeStr }}
              <span
                v-if="selectionSizeDisplay.countStr"
                class="file-browser-status-bar__count-detail"
              >({{ selectionSizeDisplay.countStr }})</span>
            </template>
            <template v-else>
              {{ selectionSizeDisplay.countStr }}
            </template>
          </span>
        </template>
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
</template>

<style scoped>
.file-browser-status-bar {
  display: flex;
  height: 32px;
  flex-shrink: 0;
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
  display: flex;
  flex-shrink: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.file-browser-status-bar__separator {
  color: hsl(var(--muted-foreground) / 50%);
}

.file-browser-status-bar__size-info {
  font-weight: 500;
}

.file-browser-status-bar__count-detail {
  color: hsl(var(--muted-foreground));
  font-weight: 400;
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
