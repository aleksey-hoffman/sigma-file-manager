<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, watch, ref } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DirEntry } from '@/types/dir-entry';
import type { Tab } from '@/types/workspaces';
import type { ContextMenuAction } from './types';
import { useFileBrowserNavigation } from './composables/use-file-browser-navigation';
import { useFileBrowserSelection } from './composables/use-file-browser-selection';
import { useVideoThumbnails } from './composables/use-video-thumbnails';
import FileBrowserToolbar from './file-browser-toolbar.vue';
import FileBrowserListView from './file-browser-list-view.vue';
import FileBrowserGridView from './file-browser-grid-view.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import FileBrowserLoading from './file-browser-loading.vue';
import FileBrowserError from './file-browser-error.vue';
import FileBrowserStatusBar from './file-browser-status-bar.vue';

const props = defineProps<{
  tab?: Tab;
  paneIndex?: number;
  layout?: 'list' | 'grid';
}>();

const emit = defineEmits<{
  'update:selectedEntry': [entry: DirEntry | null];
  'update:currentDirEntry': [entry: DirEntry | null];
}>();

const userSettingsStore = useUserSettingsStore();

const filterQuery = ref('');
const isFilterOpen = ref(false);

const {
  currentPath,
  dirContents,
  isLoading,
  error,
  pathInput,
  canGoBack,
  canGoForward,
  parentPath,
  readDir,
  navigateToPath,
  navigateToEntry,
  navigateToParent,
  navigateToHome,
  goBack,
  goForward,
  refresh,
  handlePathSubmit,
  openFile,
  init,
} = useFileBrowserNavigation(
  () => props.tab,
  dirEntry => emit('update:currentDirEntry', dirEntry),
  () => {
    clearSelection();
    resetMouseState();
  },
);

const {
  selectedEntry,
  contextMenu,
  clearSelection,
  handleEntryMouseDown,
  handleEntryMouseUp,
  handleEntryContextMenu,
  closeContextMenu,
  handleContextMenuAction,
  resetMouseState,
} = useFileBrowserSelection(
  entry => emit('update:selectedEntry', entry),
  async (entry) => {
    if (entry.is_dir) {
      await navigateToEntry(entry);
    }
    else {
      await openFile(entry.path);
    }
  },
);

const { getVideoThumbnail } = useVideoThumbnails();

function isHiddenFile(entry: DirEntry): boolean {
  return entry.is_hidden || entry.name.startsWith('.');
}

const entries = computed(() => {
  if (!dirContents.value) return [];
  let items = dirContents.value.entries;

  if (!userSettingsStore.userSettings.navigator.showHiddenFiles) {
    items = items.filter(item => !isHiddenFile(item));
  }

  if (filterQuery.value) {
    const query = filterQuery.value.toLowerCase();
    items = items.filter(item => item.name.toLowerCase().includes(query));
  }

  return items;
});

watch(() => props.tab?.id, async (newTabId, oldTabId) => {
  if (newTabId && newTabId !== oldTabId && props.tab?.path) {
    await readDir(props.tab.path, false);
  }
});

function toggleFilter() {
  isFilterOpen.value = !isFilterOpen.value;
}

function openFilter() {
  isFilterOpen.value = true;
}

function closeFilter() {
  isFilterOpen.value = false;
}

function onContextMenuAction(action: ContextMenuAction) {
  handleContextMenuAction(action);
}

onMounted(init);

defineExpose({
  isFilterOpen,
  toggleFilter,
  openFilter,
  closeFilter,
  clearSelection,
});
</script>

<template>
  <div class="file-browser">
    <FileBrowserToolbar
      v-model:path-input="pathInput"
      v-model:filter-query="filterQuery"
      v-model:is-filter-open="isFilterOpen"
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      :can-go-up="!!parentPath"
      :is-loading="isLoading"
      @go-back="goBack"
      @go-forward="goForward"
      @go-up="navigateToParent"
      @go-home="navigateToHome"
      @refresh="refresh"
      @submit-path="handlePathSubmit"
      @navigate-to="navigateToPath"
    />

    <div class="file-browser__content">
      <FileBrowserLoading v-if="isLoading" />

      <FileBrowserError
        v-else-if="error"
        :error="error"
        @go-home="navigateToHome"
      />

      <template v-else>
        <ScrollArea
          class="file-browser__scroll-area"
          @contextmenu.self.prevent
        >
          <ContextMenu @update:open="(open: boolean) => { if (!open) closeContextMenu(); }">
            <ContextMenuTrigger as-child>
              <div
                class="file-browser__entries-container"
                @contextmenu.self.prevent
              >
                <FileBrowserGridView
                  v-if="layout === 'grid'"
                  :entries="entries"
                  :selected-entry="selectedEntry"
                  :current-path="currentPath"
                  :get-video-thumbnail="getVideoThumbnail"
                  @mousedown="handleEntryMouseDown"
                  @mouseup="handleEntryMouseUp"
                  @contextmenu="handleEntryContextMenu"
                />
                <FileBrowserListView
                  v-else
                  :entries="entries"
                  :selected-entry="selectedEntry"
                  :current-path="currentPath"
                  @mousedown="handleEntryMouseDown"
                  @mouseup="handleEntryMouseUp"
                  @contextmenu="handleEntryContextMenu"
                />
              </div>
            </ContextMenuTrigger>
            <FileBrowserContextMenu
              v-if="contextMenu.selectedEntries.length > 0"
              :selected-entries="contextMenu.selectedEntries"
              @action="onContextMenuAction"
            />
          </ContextMenu>
        </ScrollArea>
      </template>
    </div>

    <FileBrowserStatusBar
      :dir-contents="dirContents"
      :filtered-count="entries.length"
    />
  </div>
</template>

<style scoped>
.file-browser {
  position: relative;
  display: flex;
  overflow: hidden;
  height: 100%;
  flex-direction: column;
}

.file-browser__content {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.file-browser__scroll-area {
  position: absolute;
  inset: 0;
}
</style>

<style>
.file-browser__entries-container {
  min-height: 100%;
}
</style>
