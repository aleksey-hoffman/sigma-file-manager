<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { nextTick } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderOpenIcon } from '@lucide/vue';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { EmptyState } from '@/components/ui/empty-state';
import FileBrowserGridView from './file-browser-grid-view.vue';
import FileBrowserListView from './file-browser-list-view.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import FileBrowserLoading from './file-browser-loading.vue';
import FileBrowserError from './file-browser-error.vue';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const props = withDefaults(defineProps<{
  layout?: 'list' | 'grid';
  trackRelativeTime?: boolean;
}>(), {
  trackRelativeTime: true,
});

const ctx = useFileBrowserContext();
const { t } = useI18n();

function isFileBrowserEntryTarget(target: EventTarget | null): boolean {
  return target instanceof Element
    && !!(target.closest('.file-browser-list-view__entry') || target.closest('.file-browser-grid-card'));
}

function openPaneBackgroundContextMenuFromPointer(event: MouseEvent) {
  const triggerElement = event.currentTarget;

  if (!(triggerElement instanceof HTMLElement)) {
    return;
  }

  ctx.handleBackgroundContextMenu();
  void nextTick(() => {
    triggerElement.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: event.clientX,
      clientY: event.clientY,
      view: window,
    }));
  });
}

function handlePaneBackgroundClick(event: MouseEvent) {
  if (isFileBrowserEntryTarget(event.target)) {
    return;
  }

  openPaneBackgroundContextMenuFromPointer(event);
}
</script>

<template>
  <div class="file-browser__content-body">
    <FileBrowserLoading v-if="ctx.isLoading.value" />

    <FileBrowserError
      v-else-if="ctx.error.value"
      :error="ctx.error.value"
      @go-home="ctx.navigateToHome"
    />

    <ContextMenu
      v-else-if="ctx.isDirectoryEmpty.value"
    >
      <ContextMenuTrigger as-child>
        <div
          class="file-browser__empty-state-container"
          @click="handlePaneBackgroundClick"
          @contextmenu="ctx.handleBackgroundContextMenu"
        >
          <EmptyState
            :icon="FolderOpenIcon"
            :title="t('fileBrowser.directoryIsEmpty')"
            :description="t('fileBrowser.directoryIsEmptyDescription')"
            :bordered="false"
          />
        </div>
      </ContextMenuTrigger>
      <FileBrowserContextMenu
        v-if="ctx.contextMenu.value.selectedEntries.length > 0"
      />
    </ContextMenu>

    <template v-else>
      <ContextMenu>
        <ContextMenuTrigger as-child>
          <div
            :ref="ctx.setEntriesContainerRef"
            class="file-browser__entries-container"
            @click="handlePaneBackgroundClick"
            @contextmenu.self="ctx.handleBackgroundContextMenu"
          >
            <FileBrowserGridView
              v-if="props.layout === 'grid'"
            />
            <FileBrowserListView
              v-else
              :track-relative-time="props.trackRelativeTime"
            />
          </div>
        </ContextMenuTrigger>
        <FileBrowserContextMenu
          v-if="ctx.contextMenu.value.selectedEntries.length > 0"
        />
      </ContextMenu>
    </template>
  </div>
</template>

<style scoped>
.file-browser__content-body {
  display: flex;
  width: 100%;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  align-self: stretch;
}

:deep(.file-browser__empty-state-container) {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.file-browser__entries-container {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.file-browser__content-body > :deep(.file-browser-loading) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}
</style>
