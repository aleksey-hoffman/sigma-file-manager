<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import type { DirContents } from '@/types/dir-entry';

const props = defineProps<{
  dirContents: DirContents | null;
  filteredCount: number;
}>();

const { t } = useI18n();

const totalCount = computed(() => props.dirContents?.entries.length ?? 0);
const isFiltered = computed(() => props.filteredCount !== totalCount.value);
</script>

<template>
  <div class="file-browser-status-bar">
    <span v-if="isFiltered">
      {{ t('fileBrowser.showingFiltered', { filtered: filteredCount, total: totalCount }) }}
    </span>
    <span v-else>
      {{ t('fileBrowser.itemsTotal', { count: totalCount }) }}
    </span>
  </div>
</template>

<style scoped>
.file-browser-status-bar {
  padding: 8px 16px;
  border-top: 1px solid hsl(var(--border));
  background-color: hsl(var(--background-2));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
