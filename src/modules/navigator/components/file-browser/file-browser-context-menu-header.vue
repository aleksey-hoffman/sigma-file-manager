<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirEntry } from '@/types/dir-entry';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { formatBytes } from './utils';
import { useFileBrowserContext } from './composables/use-file-browser-context';

const props = defineProps<{
  selectedEntries: DirEntry[];
}>();

const { t } = useI18n();
const ctx = useFileBrowserContext();
const dirSizesStore = useDirSizesStore();

const isCurrentDirMenu = computed(() => {
  const entries = props.selectedEntries;
  if (entries.length !== 1) return false;

  const entry = entries[0];
  return entry.is_dir && entry.path === ctx.currentPath.value;
});

const selectionStats = computed(() => {
  const entries = props.selectedEntries;
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
</script>

<template>
  <div class="file-browser-context-menu-header">
    <template v-if="isCurrentDirMenu && selectedEntries.length > 0">
      <span class="file-browser-context-menu-header__selected-count">
        <FileBrowserEntryIcon
          :entry="selectedEntries[0]"
          :size="18"
          class="file-browser-context-menu-header__icon"
        />
        {{ t('fileBrowser.currentDirectory') }}
        <span class="file-browser-context-menu-header__separator">·</span>
        <span class="file-browser-context-menu-header__path">{{ selectedEntries[0].name }}</span>
      </span>
    </template>
    <template v-else>
      <span class="file-browser-context-menu-header__selected-count">
        {{ t('fileBrowser.selectedItems', { count: selectedEntries.length }) }}
        <template v-if="selectionSizeDisplay">
          <span class="file-browser-context-menu-header__separator">·</span>
          <span class="file-browser-context-menu-header__size-info">
            <template v-if="selectionSizeDisplay.sizeStr">
              {{ selectionSizeDisplay.sizeStr }}
              <span
                v-if="selectionSizeDisplay.countStr"
                class="file-browser-context-menu-header__count-detail"
              >({{ selectionSizeDisplay.countStr }})</span>
            </template>
            <template v-else>
              {{ selectionSizeDisplay.countStr }}
            </template>
          </span>
        </template>
      </span>
    </template>
  </div>
</template>

<style scoped>
.file-browser-context-menu-header {
  display: flex;
  flex-direction: column;
  padding: 8px 12px 10px;
  border-bottom: 1px solid hsl(var(--border));
  margin: -8px -8px 8px;
  gap: 2px;
}

.file-browser-context-menu-header__selected-count {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
}

.file-browser-context-menu-header__icon {
  flex-shrink: 0;
  margin-right: 6px;
  color: hsl(var(--muted-foreground));
}

.file-browser-context-menu-header__separator {
  color: hsl(var(--muted-foreground) / 50%);
}

.file-browser-context-menu-header__size-info {
  font-weight: 500;
}

.file-browser-context-menu-header__count-detail {
  color: hsl(var(--muted-foreground));
  font-weight: 400;
}

.file-browser-context-menu-header__path {
  color: hsl(var(--muted-foreground));
}
</style>
