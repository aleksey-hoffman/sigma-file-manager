<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  FolderIcon,
  FileIcon,
  FileImageIcon,
  FileVideoIcon,
} from '@lucide/vue';
import { useI18n } from 'vue-i18n';
import { useFileBrowserContext } from './composables/use-file-browser-context';
import { useGroupedEntries } from './composables/use-grouped-entries';
import FileBrowserGridSection from './file-browser-grid-section.vue';
import FileBrowserGridCard from './file-browser-grid-card.vue';

const ctx = useFileBrowserContext();
const { groupedEntries } = useGroupedEntries();
const { t } = useI18n();

function handleGridContextMenu(event: MouseEvent) {
  if (event.target instanceof Element && event.target.closest('.file-browser-grid-card')) {
    return;
  }

  ctx.handleBackgroundContextMenu();
}
</script>

<template>
  <div
    :key="ctx.currentPath.value"
    class="file-browser-grid-view file-browser-grid-view--animate"
    @contextmenu="handleGridContextMenu"
  >
    <FileBrowserGridSection
      v-if="groupedEntries.dirs.length > 0"
      :label="t('fileBrowser.folders')"
      :count="groupedEntries.dirs.length"
      :sticky-index="10"
    >
      <template #icon>
        <FolderIcon :size="14" />
      </template>
      <FileBrowserGridCard
        v-for="entry in groupedEntries.dirs"
        :key="entry.path"
        :entry="entry"
        variant="dir"
      />
    </FileBrowserGridSection>

    <FileBrowserGridSection
      v-if="groupedEntries.images.length > 0"
      :label="t('fileBrowser.images')"
      :count="groupedEntries.images.length"
      :sticky-index="11"
    >
      <template #icon>
        <FileImageIcon :size="14" />
      </template>
      <FileBrowserGridCard
        v-for="entry in groupedEntries.images"
        :key="entry.path"
        :entry="entry"
        variant="image"
      />
    </FileBrowserGridSection>

    <FileBrowserGridSection
      v-if="groupedEntries.videos.length > 0"
      :label="t('fileBrowser.videos')"
      :count="groupedEntries.videos.length"
      :sticky-index="12"
    >
      <template #icon>
        <FileVideoIcon :size="14" />
      </template>
      <FileBrowserGridCard
        v-for="entry in groupedEntries.videos"
        :key="entry.path"
        :entry="entry"
        variant="video"
      />
    </FileBrowserGridSection>

    <FileBrowserGridSection
      v-if="groupedEntries.others.length > 0"
      :label="t('fileBrowser.otherFiles')"
      :count="groupedEntries.others.length"
      :sticky-index="13"
    >
      <template #icon>
        <FileIcon :size="14" />
      </template>
      <FileBrowserGridCard
        v-for="entry in groupedEntries.others"
        :key="entry.path"
        :entry="entry"
        variant="other"
      />
    </FileBrowserGridSection>
  </div>
</template>

<style scoped>
.file-browser-grid-view {
  display: flex;
  flex: 1;
  flex-direction: column;
  padding: 0 0 8px 8px;
  gap: 12px;
}

.file-browser-grid-view--animate {
  animation: sigma-ui-fade-in 0.2s ease-out;
}
</style>
