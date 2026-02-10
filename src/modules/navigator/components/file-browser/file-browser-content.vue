<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useI18n } from 'vue-i18n';
import type { ComponentPublicInstance } from 'vue';
import { FolderOpenIcon, InfoIcon } from 'lucide-vue-next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ContextMenu, ContextMenuTrigger } from '@/components/ui/context-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from './types';
import FileBrowserGridView from './file-browser-grid-view.vue';
import FileBrowserListView from './file-browser-list-view.vue';
import FileBrowserContextMenu from './file-browser-context-menu.vue';
import FileBrowserLoading from './file-browser-loading.vue';
import FileBrowserError from './file-browser-error.vue';

const props = defineProps<{
  layout?: 'list' | 'grid';
  isLoading: boolean;
  error: string | null;
  isDirectoryEmpty: boolean;
  entries: DirEntry[];
  selectedEntries: DirEntry[];
  isEntrySelected: (entry: DirEntry) => boolean;
  currentPath: string;
  contextMenu: {
    targetEntry: DirEntry | null;
    selectedEntries: DirEntry[];
  };
  getVideoThumbnail: (entry: DirEntry) => string | undefined;
  setEntriesContainerRef: (element: Element | ComponentPublicInstance | null) => void;
  onEntryMouseDown: (entry: DirEntry, event: MouseEvent) => void;
  onEntryMouseUp: (entry: DirEntry, event: MouseEvent) => void;
  handleEntryContextMenu: (entry: DirEntry) => void;
  onContextMenuAction: (action: ContextMenuAction) => void;
  openOpenWithDialog: (entries: DirEntry[]) => void;
  navigateToHome: () => void | Promise<void>;
}>();

const { t } = useI18n();
const legendSizeText = '1.5 GB';
</script>

<template>
  <div class="file-browser__content">
    <FileBrowserLoading v-if="props.isLoading" />

    <FileBrowserError
      v-else-if="props.error"
      :error="props.error"
      @go-home="props.navigateToHome"
    />

    <EmptyState
      v-else-if="props.isDirectoryEmpty"
      class="file-browser__empty-state-container"
      :icon="FolderOpenIcon"
      :title="t('fileBrowser.directoryIsEmpty')"
      :description="t('fileBrowser.directoryIsEmptyDescription')"
      :bordered="false"
    />

    <template v-else>
      <div
        v-if="props.layout === 'list'"
        class="file-browser-list-view__header-container"
      >
        <div class="file-browser-list-view__header">
          <span class="file-browser-list-view__header-item file-browser-list-view__header-name">{{ t('fileBrowser.name') }}</span>
          <span class="file-browser-list-view__header-item file-browser-list-view__header-items">{{ t('items') }}</span>
          <Tooltip :delay-duration="200">
            <TooltipTrigger as-child>
              <span class="file-browser-list-view__header-item file-browser-list-view__header-size file-browser-list-view__header-size--with-info">
                {{ t('fileBrowser.size') }}
                <InfoIcon
                  :size="12"
                  class="file-browser-list-view__header-info-icon"
                />
              </span>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              :side-offset="8"
              class="file-browser-list-view__size-tooltip"
            >
              <div class="file-browser-list-view__size-tooltip-content">
                <div class="file-browser-list-view__size-tooltip-title">
                  {{ t('fileBrowser.sizeTooltip.title') }}
                </div>
                <div class="file-browser-list-view__size-tooltip-body">
                  <div class="file-browser-list-view__size-tooltip-item">
                    <span class="file-browser-list-view__size-tooltip-label">{{ legendSizeText }}</span>
                    <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.exact') }}</span>
                  </div>
                  <div class="file-browser-list-view__size-tooltip-item">
                    <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--loading">
                      <Skeleton class="file-browser-list-view__size-tooltip-skeleton" />
                    </span>
                    <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.loading') }}</span>
                  </div>
                  <div class="file-browser-list-view__size-tooltip-item">
                    <span class="file-browser-list-view__size-tooltip-label file-browser-list-view__size-tooltip-label--empty">—</span>
                    <span class="file-browser-list-view__size-tooltip-desc">{{ t('fileBrowser.sizeTooltip.notCalculated') }}</span>
                  </div>
                </div>
                <div class="file-browser-list-view__size-tooltip-note">
                  {{ t('fileBrowser.sizeTooltip.note') }}
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
          <span class="file-browser-list-view__header-item file-browser-list-view__header-modified">{{ t('fileBrowser.modified') }}</span>
        </div>
      </div>
      <ScrollArea
        class="file-browser__scroll-area"
        @contextmenu.self.prevent
      >
        <ContextMenu>
          <ContextMenuTrigger as-child>
            <div
              :ref="props.setEntriesContainerRef"
              class="file-browser__entries-container"
              @contextmenu.self.prevent
            >
              <FileBrowserGridView
                v-if="props.layout === 'grid'"
                :entries="props.entries"
                :selected-entries="props.selectedEntries"
                :is-entry-selected="props.isEntrySelected"
                :current-path="props.currentPath"
                :get-video-thumbnail="props.getVideoThumbnail"
                @mousedown="props.onEntryMouseDown"
                @mouseup="props.onEntryMouseUp"
                @contextmenu="props.handleEntryContextMenu"
              />
              <FileBrowserListView
                v-else
                :entries="props.entries"
                :selected-entries="props.selectedEntries"
                :is-entry-selected="props.isEntrySelected"
                :current-path="props.currentPath"
                @mousedown="props.onEntryMouseDown"
                @mouseup="props.onEntryMouseUp"
                @contextmenu="props.handleEntryContextMenu"
              />
            </div>
          </ContextMenuTrigger>
          <FileBrowserContextMenu
            v-if="props.contextMenu.selectedEntries.length > 0"
            :selected-entries="props.contextMenu.selectedEntries"
            @action="props.onContextMenuAction"
            @open-custom-dialog="props.openOpenWithDialog(props.contextMenu.selectedEntries)"
          />
        </ContextMenu>
      </ScrollArea>
    </template>
  </div>
</template>

<style scoped>
.file-browser__content {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;

  --file-browser-list-columns: minmax(80px, 1fr) minmax(70px, 90px) minmax(50px, 100px) minmax(60px, 160px);
  --file-browser-list-row-padding-y: 10px;
  --file-browser-list-row-padding-x: 16px;
  --file-browser-list-header-padding-x: 16px;
  --file-browser-list-header-padding-y: 10px;
  --file-browser-list-cell-padding-right: 16px;
  --file-browser-list-right-gutter: 20px;
}

.file-browser__empty-state-container {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.file-browser__scroll-area {
  position: relative;
  min-height: 0;
  flex: 1;
}

.file-browser__entries-container {
  min-height: 100%;
}

.file-browser-list-view__header {
  display: grid;
  padding: var(--file-browser-list-header-padding-y) var(--file-browser-list-header-padding-x);
  background-color: hsl(var(--background-3));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  grid-template-columns: var(--file-browser-list-columns);
  text-transform: uppercase;
}

.file-browser-list-view__header-container {
  padding-right: var(--file-browser-list-right-gutter);
  border-bottom: 1px solid hsl(var(--border));
}

.file-browser-list-view__header-item {
  display: flex;
  align-items: center;
  padding-right: var(--file-browser-list-cell-padding-right);
  gap: 8px;
}

.file-browser-list-view__header-info-icon {
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.file-browser-list-view__header-size--with-info:hover .file-browser-list-view__header-info-icon {
  opacity: 1;
}

.file-browser-list-view__size-tooltip {
  max-width: 300px;
}

.file-browser-list-view__size-tooltip-content {
  display: flex;
  max-width: 300px;
  flex-direction: column;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-title {
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
}

.file-browser-list-view__size-tooltip-body {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-browser-list-view__size-tooltip-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.file-browser-list-view__size-tooltip-label {
  display: inline-flex;
  width: 70px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 2px 8px;
  border-radius: 4px;
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
  font-size: 11px;
  font-weight: 500;
}

.file-browser-list-view__size-tooltip-label--loading {
  background-color: transparent;
}

.file-browser-list-view__size-tooltip-skeleton {
  width: 100%;
  height: 12px;
}

.file-browser-list-view__size-tooltip-label--empty {
  background-color: hsl(var(--muted) / 30%);
  color: hsl(var(--muted-foreground));
}

.file-browser-list-view__size-tooltip-desc {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.4;
}

.file-browser-list-view__size-tooltip-note {
  padding-top: 6px;
  border-top: 1px solid hsl(var(--border) / 50%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-style: italic;
  line-height: 1.4;
}
</style>
