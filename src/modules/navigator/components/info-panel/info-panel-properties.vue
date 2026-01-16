<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { LoaderCircleIcon, XIcon, RefreshCwIcon } from 'lucide-vue-next';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { useI18n } from 'vue-i18n';
import { formatBytes, formatDate, formatRelativeTime } from '@/modules/navigator/components/file-browser/utils';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import type { DirEntry } from '@/types/dir-entry';
import type { RelativeTimeTranslations } from '@/modules/navigator/components/file-browser/utils';

const props = defineProps<{
  selectedEntry: DirEntry | null;
  orientation?: 'vertical' | 'horizontal';
}>();

const { t } = useI18n();
const dirSizesStore = useDirSizesStore();

const listRef = ref<HTMLElement | null>(null);

const dirSizeInfo = computed(() => {
  if (!props.selectedEntry?.is_dir) return null;
  return dirSizesStore.getSize(props.selectedEntry.path);
});

const isDirSizeLoading = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  return dirSizesStore.isLoading(props.selectedEntry.path);
});

const showGetSizeButton = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  const info = dirSizeInfo.value;
  return !info;
});

const showRecalculateButton = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  const info = dirSizeInfo.value;
  if (!info) return false;

  return info.status === 'Complete';
});

const dirSizeDisplay = computed(() => {
  const info = dirSizeInfo.value;
  if (!info) return null;
  if (info.status === 'Loading' && info.size > 0) return formatBytes(info.size);
  if (info.status === 'Loading') return null;
  if (info.status === 'Complete') return formatBytes(info.size);
  return null;
});

const relativeTimeTranslations = computed<RelativeTimeTranslations>(() => ({
  justNow: t('relativeTime.justNow'),
  minutesAgo: (count: number) => t('relativeTime.minutesAgo', count),
  hoursAgo: (count: number) => t('relativeTime.hoursAgo', count),
  daysAgo: (count: number) => t('relativeTime.daysAgo', count),
}));

const calculatedAgo = computed(() => {
  const info = dirSizeInfo.value;
  if (!info) return null;
  if (info.status === 'Loading') return null;
  if (!info.calculatedAt) return null;

  return formatRelativeTime(info.calculatedAt, relativeTimeTranslations.value);
});

async function handleGetSize() {
  if (!props.selectedEntry?.is_dir) return;
  await dirSizesStore.requestSizeForce(props.selectedEntry.path);
}

async function handleCancelSize() {
  if (!props.selectedEntry?.is_dir) return;
  await dirSizesStore.cancelSize(props.selectedEntry.path);
}

watch(() => props.selectedEntry?.path, () => {
  // Reset state when entry changes
}, { immediate: true });

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
        v-if="selectedEntry?.is_dir"
        class="info-panel-properties__item"
      >
        <div class="info-panel-properties__title">
          {{ t('size') }}
        </div>
        <div class="info-panel-properties__value info-panel-properties__value--action">
          <template v-if="isDirSizeLoading">
            <LoaderCircleIcon
              :size="14"
              class="info-panel-properties__spinner"
            />
            <div class="info-panel-properties__size-content">
              <span v-if="dirSizeDisplay">{{ dirSizeDisplay }}</span>
              <span v-else>{{ t('calculating') }}...</span>
            </div>
            <Button
              size="xs"
              variant="ghost"
              class="info-panel-properties__cancel-btn"
              @click="handleCancelSize"
            >
              <XIcon :size="14" />
            </Button>
          </template>
          <template v-else-if="dirSizeDisplay && !showGetSizeButton">
            <div class="info-panel-properties__size-content">
              <span>{{ dirSizeDisplay }}</span>
              <span
                v-if="calculatedAgo"
                class="info-panel-properties__calculated-ago"
              >{{ t('calculatedAgo', { time: calculatedAgo }) }}</span>
            </div>
            <Button
              v-if="showRecalculateButton"
              size="xs"
              variant="ghost"
              class="info-panel-properties__recalculate-btn"
              :title="t('recalculate')"
              @click="handleGetSize"
            >
              <RefreshCwIcon :size="12" />
            </Button>
          </template>
          <Button
            v-else-if="showGetSizeButton"
            size="xs"
            variant="secondary"
            @click="handleGetSize"
          >
            {{ t('getSize') }}
          </Button>
        </div>
      </div>

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

.info-panel-properties__value--action {
  display: flex;
  height: 38px;
  align-items: center;
  gap: 6px;
}

.info-panel-properties__size-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-panel-properties__calculated-ago {
  color: hsl(var(--muted-foreground) / 70%);
  font-size: 11px;
}

.info-panel-properties__spinner {
  animation: spin 1s linear infinite;
  color: hsl(var(--muted-foreground));
}

.info-panel-properties__cancel-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
}

.info-panel-properties__cancel-btn:hover {
  color: hsl(var(--destructive));
}

.info-panel-properties__recalculate-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  opacity: 0.5;
  transition: opacity 0.15s ease;
}

.info-panel-properties__recalculate-btn:hover {
  color: hsl(var(--primary));
  opacity: 1;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
