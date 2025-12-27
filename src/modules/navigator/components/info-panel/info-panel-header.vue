<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { getFileIcon } from '@/modules/navigator/components/file-browser/utils';
import type { DirEntry } from '@/types/dir-entry';

const props = defineProps<{
  selectedEntry: DirEntry | null;
}>();

const { t } = useI18n();

const entryIcon = computed(() => {
  if (!props.selectedEntry) {
    return getFileIcon({
      is_dir: false,
      ext: '',
    } as DirEntry);
  }

  return getFileIcon(props.selectedEntry);
});
</script>

<template>
  <div class="info-panel-header">
    <component
      :is="entryIcon"
      :size="24"
      class="info-panel-header__icon"
      :class="{ 'info-panel-header__icon--folder': selectedEntry?.is_dir }"
    />
    <span class="info-panel-header__name">
      {{ selectedEntry?.name || t('noData') }}
    </span>
  </div>
</template>

<style scoped>
.info-panel-header {
  display: flex;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid hsl(var(--border));
  gap: 12px;
}

.info-panel-header__icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.info-panel-header__icon--folder {
  color: hsl(var(--primary));
}

.info-panel-header__name {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
