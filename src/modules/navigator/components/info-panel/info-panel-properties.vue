<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { LoaderCircleIcon, XIcon, RefreshCwIcon, TriangleAlertIcon } from '@lucide/vue';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import DateHoverDisplay from '@/components/ui/date-hover-display/date-hover-display.vue';
import { useI18n } from 'vue-i18n';
import {
  formatBytes,
  formatRelativeTime,
} from '@/modules/navigator/components/file-browser/utils';
import { useRelativeDateDisplayClock } from '@/composables/use-relative-date-display';
import { useDirSizesStore } from '@/stores/runtime/dir-sizes';
import { useLinkMetadataStore } from '@/stores/runtime/link-metadata';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DirEntry } from '@/types/dir-entry';
import type { RelativeTimeTranslations } from '@/modules/navigator/components/file-browser/utils';
import { getPathDisplayValue } from '@/utils/normalize-path';
import { formatRelativeDateDisplay } from '@/utils/relative-date-display';
import { DIR_SIZE_HINT_MESSAGE_KEYS, getSettledDirSizeDisplay, UNKNOWN_DIR_SIZE } from '@/utils/dir-size-display';
import {
  getDirEntryKindKey,
  getDirEntryLinksDisplay,
  getDirEntryLinkStatusKey,
} from '@/utils/dir-entry-link-metadata';
const props = withDefaults(defineProps<{
  selectedEntry: DirEntry | null;
  orientation?: 'vertical' | 'compact';
  propertyLayout?: 'rows' | 'stacked';
  useInternalScroll?: boolean;
}>(), {
  orientation: 'vertical',
  propertyLayout: 'rows',
  useInternalScroll: true,
});

const { t, locale } = useI18n();
const dirSizesStore = useDirSizesStore();
const linkMetadataStore = useLinkMetadataStore();
const userSettingsStore = useUserSettingsStore();

const selectedEntryWithMetadata = computed(() => {
  return props.selectedEntry
    ? linkMetadataStore.mergeEntry(props.selectedEntry)
    : null;
});

const { clockRef: relativeDateClock } = useRelativeDateDisplayClock(() => {
  const entry = props.selectedEntry;

  if (!entry) {
    return false;
  }

  return !!(entry.modified_time || entry.created_time);
});

function formatPropertyDate(timestamp: number, relativeDisplay = true): string {
  return formatRelativeDateDisplay({
    timestamp,
    referenceNowMs: relativeDateClock.value,
    dateTimeOptions: userSettingsStore.userSettings.dateTime,
    appLocale: locale.value,
    translate: t,
    relativeDisplay,
  });
}

const dirSizeInfo = computed(() => {
  if (!props.selectedEntry?.is_dir) return null;
  return dirSizesStore.getSize(props.selectedEntry.path);
});

const isDirSizeLoading = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  return dirSizesStore.isLoading(props.selectedEntry.path);
});

const isFullDirSizeScanRunning = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  return dirSizesStore.isFullScanRunning(props.selectedEntry.path);
});

const isDirSizeComplete = computed(() => dirSizeInfo.value?.status === 'Complete');

const settledDirSize = computed(() => getSettledDirSizeDisplay(dirSizeInfo.value));

const dirSizeHint = computed(() => {
  const hint = settledDirSize.value?.hint;
  return hint ? t(DIR_SIZE_HINT_MESSAGE_KEYS[hint]) : null;
});

const dirSizeDisplay = computed(() => {
  const info = dirSizeInfo.value;
  if (!info) return null;
  if (info.status === 'Loading') return info.size > 0 ? formatBytes(info.size) : null;
  const text = settledDirSize.value?.text;
  return text && text !== UNKNOWN_DIR_SIZE ? text : null;
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

// A small folder finishes in a few milliseconds. Without a minimum, the calculating
// state flashes and the click looks like it did nothing.
const MINIMUM_SIZE_CALCULATION_DISPLAY_MS = 500;
const heldCalculationPath = ref<string | null>(null);
let heldCalculationTimer: ReturnType<typeof setTimeout> | null = null;

const isDirSizeCalculationShown = computed(() => {
  if (!props.selectedEntry?.is_dir) return false;
  return isFullDirSizeScanRunning.value || heldCalculationPath.value === props.selectedEntry.path;
});

function releaseHeldCalculation() {
  if (heldCalculationTimer) {
    clearTimeout(heldCalculationTimer);
    heldCalculationTimer = null;
  }

  heldCalculationPath.value = null;
}

onUnmounted(releaseHeldCalculation);

async function handleGetSize() {
  if (!props.selectedEntry?.is_dir) return;
  const path = props.selectedEntry.path;
  const startedAt = Date.now();
  releaseHeldCalculation();
  heldCalculationPath.value = path;

  await dirSizesStore.requestSizeForce(path);

  if (heldCalculationPath.value !== path) return;
  const remainingMs = MINIMUM_SIZE_CALCULATION_DISPLAY_MS - (Date.now() - startedAt);

  if (remainingMs <= 0) {
    releaseHeldCalculation();
    return;
  }

  heldCalculationTimer = setTimeout(releaseHeldCalculation, remainingMs);
}

async function handleCancelSize() {
  if (!props.selectedEntry?.is_dir) return;
  releaseHeldCalculation();
  await dirSizesStore.cancelSize(props.selectedEntry.path);
}

interface PropertyValueItem {
  title: string;
  value: string;
}

interface PropertyDateItem {
  title: string;
  dateTimestamp: number;
  relativeDisplay?: boolean;
}

type PropertyItem = PropertyValueItem | PropertyDateItem;

const properties = computed<PropertyItem[]>(() => {
  if (!selectedEntryWithMetadata.value) return [];

  const entry = selectedEntryWithMetadata.value;
  const items: PropertyItem[] = [];
  const linkStatusKey = getDirEntryLinkStatusKey(entry);

  items.push({
    title: t('type'),
    value: entry.is_dir ? t('directory') : entry.mime || t('file'),
  });
  items.push({
    title: t('path'),
    value: getPathDisplayValue(entry.path),
  });

  if (entry.is_dir && entry.item_count !== null) {
    items.push({
      title: t('items'),
      value: t('fileBrowser.itemCount', { count: entry.item_count }),
    });
  }

  if (entry.ext) {
    items.push({
      title: t('fileExtension'),
      value: `.${entry.ext}`,
    });
  }

  if (entry.modified_time) {
    items.push({
      title: t('modified'),
      dateTimestamp: entry.modified_time,
    });
  }

  if (entry.created_time) {
    items.push({
      title: t('created'),
      dateTimestamp: entry.created_time,
    });
  }

  if (entry.accessed_time) {
    items.push({
      title: t('accessed'),
      dateTimestamp: entry.accessed_time,
      relativeDisplay: false,
    });
  }

  if (entry.is_symlink && !entry.link_type) {
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

  items.push({
    title: t('fileBrowser.kind'),
    value: t(getDirEntryKindKey(entry)),
  });
  items.push({
    title: t('fileBrowser.links'),
    value: getDirEntryLinksDisplay(entry),
  });
  items.push({
    title: t('fileBrowser.linkTarget'),
    value: entry.link_target ? getPathDisplayValue(entry.link_target) : '—',
  });
  items.push({
    title: t('fileBrowser.linkStatus'),
    value: linkStatusKey ? t(linkStatusKey) : '—',
  });

  return items;
});

const compactItems = computed<string[]>(() => {
  if (!selectedEntryWithMetadata.value) return [];

  const entry = selectedEntryWithMetadata.value;
  const items: string[] = [];

  const kindDisplay = entry.link_type
    ? t(getDirEntryKindKey(entry))
    : (entry.is_dir ? t('directory') : (entry.ext ? `.${entry.ext}` : t('file')));

  items.push(kindDisplay);

  if (entry.is_file) {
    items.push(formatBytes(entry.size));
  }
  else if (entry.is_dir) {
    if (dirSizeDisplay.value) {
      items.push(dirSizeDisplay.value);
    }

    if (entry.item_count !== null) {
      items.push(t('fileBrowser.itemCount', { count: entry.item_count }));
    }
  }

  if (entry.modified_time) {
    items.push(formatPropertyDate(entry.modified_time));
  }

  return items;
});

watch(
  () => props.selectedEntry?.path,
  (path) => {
    if (!path) {
      return;
    }

    linkMetadataStore
      .requestMetadataBatch([path], {
        includeShortcutTargets: true,
        includeHardLinkCounts: true,
      })
      .catch((error: unknown) => {
        console.error('Failed to load selected entry link metadata:', error);
      });
  },
  { immediate: true },
);
</script>

<template>
  <div
    v-if="orientation === 'compact'"
    class="info-panel-properties info-panel-properties--compact"
  >
    <span
      v-if="selectedEntry"
      class="info-panel-properties__compact-text"
    >
      {{ compactItems.join(' · ') }}
    </span>
  </div>
  <component
    :is="useInternalScroll ? ScrollArea : 'div'"
    v-else
    class="info-panel-properties"
    :class="{
      'info-panel-properties--inline': !useInternalScroll,
      'info-panel-properties--stacked': propertyLayout === 'stacked',
    }"
    :orientation="useInternalScroll ? 'vertical' : undefined"
  >
    <div
      v-if="!selectedEntry"
      class="info-panel-properties__empty"
    >
      {{ t('noData') }}
    </div>
    <div
      v-else
      class="info-panel-properties__list"
    >
      <div
        v-if="selectedEntryWithMetadata?.is_file || selectedEntry?.is_dir"
        class="info-panel-properties__item info-panel-properties__item--size"
      >
        <div class="info-panel-properties__title">
          {{ t('size') }}
        </div>
        <div class="info-panel-properties__value info-panel-properties__value--action">
          <template v-if="selectedEntryWithMetadata?.is_file">
            {{ formatBytes(selectedEntryWithMetadata.size) }}
          </template>
          <div
            v-else
            class="info-panel-properties__size-states"
          >
            <Transition
              name="info-panel-size-state"
              mode="out-in"
            >
              <div
                v-if="isDirSizeCalculationShown"
                key="calculating"
                class="info-panel-properties__size-state"
              >
                <LoaderCircleIcon
                  :size="14"
                  class="info-panel-properties__spinner"
                />
                <div class="info-panel-properties__size-content">
                  <span
                    v-if="dirSizeDisplay"
                    class="info-panel-properties__size-value"
                  >{{ dirSizeDisplay }}</span>
                  <span
                    v-else
                    class="info-panel-properties__size-value"
                  >{{ t('calculating') }}...</span>
                </div>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="info-panel-properties__cancel-btn"
                      @click="handleCancelSize"
                    >
                      <XIcon :size="14" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ t('cancel') }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                v-else-if="isDirSizeComplete && !isDirSizeLoading"
                key="complete"
                class="info-panel-properties__size-state"
              >
                <div class="info-panel-properties__size-content">
                  <span class="info-panel-properties__size-value-line">
                    <span class="info-panel-properties__size-value">{{ dirSizeDisplay }}</span>
                    <Tooltip v-if="dirSizeHint">
                      <TooltipTrigger as-child>
                        <span class="info-panel-properties__size-warning">
                          <TriangleAlertIcon :size="12" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {{ dirSizeHint }}
                      </TooltipContent>
                    </Tooltip>
                  </span>
                  <span
                    v-if="calculatedAgo"
                    class="info-panel-properties__calculated-ago"
                  >{{ t('calculatedAgo', { time: calculatedAgo }) }}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="info-panel-properties__recalculate-btn"
                      @click="handleGetSize"
                    >
                      <RefreshCwIcon :size="12" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ t('recalculate') }}
                  </TooltipContent>
                </Tooltip>
              </div>
              <div
                v-else
                key="pending"
                class="info-panel-properties__size-state"
              >
                <LoaderCircleIcon
                  v-if="isDirSizeLoading"
                  :size="14"
                  class="info-panel-properties__spinner"
                />
                <div
                  v-if="dirSizeDisplay || dirSizeHint"
                  class="info-panel-properties__size-content"
                >
                  <span
                    v-if="dirSizeDisplay"
                    class="info-panel-properties__size-value"
                  >{{ dirSizeDisplay }}</span>
                  <span
                    v-if="dirSizeHint && !isDirSizeLoading"
                    class="info-panel-properties__calculated-ago"
                  >{{ dirSizeHint }}</span>
                </div>
                <Tooltip v-if="dirSizeDisplay || dirSizeHint">
                  <TooltipTrigger as-child>
                    <Button
                      size="xs"
                      variant="ghost"
                      class="info-panel-properties__recalculate-btn info-panel-properties__recalculate-btn--prominent"
                      @click="handleGetSize"
                    >
                      <RefreshCwIcon :size="12" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{ t('getSize') }}
                  </TooltipContent>
                </Tooltip>
                <Button
                  v-else
                  size="xs"
                  variant="secondary"
                  @click="handleGetSize"
                >
                  {{ t('getSize') }}
                </Button>
              </div>
            </Transition>
          </div>
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
          <DateHoverDisplay
            v-if="'dateTimestamp' in item"
            :timestamp="item.dateTimestamp"
            :reference-now="relativeDateClock"
            :relative-display="item.relativeDisplay ?? true"
          />
          <template v-else>
            {{ item.value }}
          </template>
        </div>
      </div>
    </div>
  </component>
</template>

<style scoped>
.info-panel-properties {
  flex: 1;
  padding: 12px 16px;
}

.info-panel-properties--compact {
  overflow: hidden;
  min-width: 0;
  padding: 0;
}

.info-panel-properties--inline {
  flex: none;
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
  gap: 8px;
}

.info-panel-properties__item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

@container info-panel (width >= 250px) {
  .info-panel-properties:not(.info-panel-properties--stacked) .info-panel-properties__item {
    display: grid;
    align-items: start;
    gap: 2px 12px;
    grid-template-columns: minmax(80px, 24%) minmax(0, 1fr);
  }

  .info-panel-properties:not(.info-panel-properties--stacked) .info-panel-properties__item--size {
    align-items: center;
  }

  .info-panel-properties:not(.info-panel-properties--stacked) .info-panel-properties__title {
    line-height: 1.4;
  }
}

.info-panel-properties__title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  line-height: inherit;
  text-transform: uppercase;
}

.info-panel-properties__value {
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 1.4;
  word-break: break-all;
}

.info-panel-properties__compact-text {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.info-panel-properties__item--size {
  min-height: var(--info-panel-properties-header-height);
  align-items: stretch;
}

.info-panel-properties__value--action {
  display: flex;
  width: 100%;
  height: var(--info-panel-properties-header-height);
  min-height: var(--info-panel-properties-header-height);
  align-items: center;
  gap: 6px;
}

.info-panel-properties__size-states {
  display: flex;
  overflow: hidden;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
}

.info-panel-properties__size-state {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.info-panel-size-state-enter-active {
  transition:
    transform 0.22s cubic-bezier(0.16, 1, 0.3, 1),
    opacity 0.18s ease-out;
}

.info-panel-size-state-leave-active {
  transition:
    transform 0.14s cubic-bezier(0.4, 0, 1, 1),
    opacity 0.12s ease-in;
}

.info-panel-size-state-enter-from {
  opacity: 0;
  transform: translateY(60%);
}

.info-panel-size-state-leave-to {
  opacity: 0;
  transform: translateY(-60%);
}

@media (prefers-reduced-motion: reduce) {
  .info-panel-size-state-enter-active,
  .info-panel-size-state-leave-active {
    transition-duration: 0.01ms;
  }
}

.info-panel-properties__size-value-line {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.info-panel-properties__size-value {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
}

.info-panel-properties__size-warning {
  display: flex;
  flex-shrink: 0;
  color: hsl(var(--warning));
}

.info-panel-properties__size-content {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  justify-content: center;
  gap: 0;
  line-height: 1.15;
}

.info-panel-properties__calculated-ago {
  overflow: hidden;
  color: hsl(var(--muted-foreground) / 70%);
  font-size: 11px;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.info-panel-properties__recalculate-btn--prominent {
  opacity: 0.85;
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
