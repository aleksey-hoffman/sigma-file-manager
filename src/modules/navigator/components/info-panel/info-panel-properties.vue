<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useI18n } from 'vue-i18n';
import { formatBytes, formatDate } from '@/modules/navigator/components/file-browser/utils';
import type { DirEntry } from '@/types/dir-entry';

const props = defineProps<{
  selectedEntry: DirEntry | null;
  orientation?: 'vertical' | 'horizontal';
}>();

const { t } = useI18n();

const listRef = ref<HTMLElement | null>(null);

function handleHorizontalWheel(event: WheelEvent) {
  if (props.orientation !== 'horizontal') return;
  if (!listRef.value) return;

  const viewport = listRef.value.closest('.sigma-ui-scroll-area__viewport') as HTMLElement | null;
  if (!viewport) return;

  event.preventDefault();
  viewport.scrollLeft += event.deltaY || event.deltaX || 0;
}

interface PropertyItem {
  title: string;
  value: string;
}

const properties = computed<PropertyItem[]>(() => {
  if (!props.selectedEntry) return [];

  const entry = props.selectedEntry;
  const items: PropertyItem[] = [];

  items.push({
    title: t('type'),
    value: entry.is_dir ? t('directory') : entry.mime || t('file'),
  });
  items.push({
    title: t('path'),
    value: entry.path,
  });

  if (entry.is_file) {
    items.push({
      title: t('size'),
      value: formatBytes(entry.size),
    });
  }

  if (entry.is_dir && entry.item_count !== null) {
    items.push({
      title: t('items'),
      value: t('fileBrowser.itemCount', { count: entry.item_count }),
    });
  }

  if (entry.ext) {
    items.push({
      title: t('extension'),
      value: `.${entry.ext}`,
    });
  }

  if (entry.modified_time) {
    items.push({
      title: t('modified'),
      value: formatDate(entry.modified_time, true),
    });
  }

  if (entry.created_time) {
    items.push({
      title: t('created'),
      value: formatDate(entry.created_time, true),
    });
  }

  if (entry.accessed_time) {
    items.push({
      title: t('accessed'),
      value: formatDate(entry.accessed_time, true),
    });
  }

  if (entry.is_symlink) {
    items.push({
      title: t('symlink'),
      value: t('yes'),
    });
  }

  if (entry.is_hidden) {
    items.push({
      title: t('hidden'),
      value: t('yes'),
    });
  }

  return items;
});
</script>

<template>
  <ScrollArea
    class="info-panel-properties"
    :class="{ 'info-panel-properties--horizontal': orientation === 'horizontal' }"
    :orientation="orientation || 'vertical'"
  >
    <div
      v-if="!selectedEntry"
      class="info-panel-properties__empty"
    >
      {{ t('noData') }}
    </div>
    <div
      v-else
      ref="listRef"
      class="info-panel-properties__list"
      @wheel="handleHorizontalWheel"
    >
      <div
        v-for="(item, index) in properties"
        :key="index"
        class="info-panel-properties__item"
      >
        <div class="info-panel-properties__title">
          {{ item.title }}
        </div>
        <div class="info-panel-properties__value">
          {{ item.value }}
        </div>
      </div>
    </div>
  </ScrollArea>
</template>

<style scoped>
.info-panel-properties {
  flex: 1;
  padding: 12px 16px;
}

.info-panel-properties__empty {
  display: flex;
  height: 100%;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.info-panel-properties__list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.info-panel-properties__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-panel-properties__title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-transform: uppercase;
}

.info-panel-properties__value {
  color: hsl(var(--foreground));
  font-size: 13px;
  word-break: break-all;
}

.info-panel-properties--horizontal {
  padding: 0;
}

.info-panel-properties--horizontal .info-panel-properties__list {
  flex-direction: row;
  padding-bottom: 8px;
  gap: 16px;
}

.info-panel-properties--horizontal .info-panel-properties__item {
  max-width: 120px;
  flex-shrink: 0;
}

.info-panel-properties--horizontal .info-panel-properties__value {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}
</style>
