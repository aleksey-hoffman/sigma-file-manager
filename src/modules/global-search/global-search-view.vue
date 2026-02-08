<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from 'vue-i18n';
import {
  ChevronDownIcon, HardDriveIcon, LoaderCircleIcon, SearchIcon, SettingsIcon, SlidersHorizontalIcon, UsbIcon, XIcon,
} from 'lucide-vue-next';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  NumberField, NumberFieldContent, NumberFieldDecrement,
  NumberFieldIncrement, NumberFieldInput,
} from '@/components/ui/number-field';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useSettingsStore } from '@/stores/runtime/settings';
import { getDriveByPath } from '@/modules/home/composables/use-drives';
import type { DirEntry } from '@/types/dir-entry';
import type { DriveInfo } from '@/types/drive-info';
import { formatBytes, formatDate } from '@/modules/navigator/components/file-browser/utils';
import FileBrowserEntryIcon from '@/modules/navigator/components/file-browser/file-browser-entry-icon.vue';
import { SEARCH_CONSTANTS } from '@/constants';

const emit = defineEmits<{
  close: [];
  openEntry: [entry: DirEntry];
}>();

const router = useRouter();
const globalSearchStore = useGlobalSearchStore();
const userSettingsStore = useUserSettingsStore();
const settingsStore = useSettingsStore();
const { t } = useI18n();

const inputRef = ref<InstanceType<typeof Input> | null>(null);
const showOptions = ref(false);

const resultLimit = computed(() => userSettingsStore.userSettings.globalSearch.resultLimit);
const includeFiles = computed(() => userSettingsStore.userSettings.globalSearch.includeFiles);
const includeDirectories = computed(() => userSettingsStore.userSettings.globalSearch.includeDirectories);
const exactMatch = computed(() => userSettingsStore.userSettings.globalSearch.exactMatch);
const typoTolerance = computed(() => userSettingsStore.userSettings.globalSearch.typoTolerance);
const scanDepth = computed(() => userSettingsStore.userSettings.globalSearch.scanDepth);

function openSearchSettings() {
  settingsStore.setCurrentTab('search');
  router.push({ name: 'settings' });
}

function setResultLimit(value: string | number | undefined) {
  const limit = Math.max(
    SEARCH_CONSTANTS.MIN_RESULT_LIMIT,
    Math.min(SEARCH_CONSTANTS.MAX_RESULT_LIMIT, Math.floor(Number(value ?? SEARCH_CONSTANTS.DEFAULT_RESULT_LIMIT))),
  );
  userSettingsStore.set('globalSearch.resultLimit', limit);
}

function setIncludeFiles(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    userSettingsStore.set('globalSearch.includeFiles', value);
  }
}

function setIncludeDirectories(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    userSettingsStore.set('globalSearch.includeDirectories', value);
  }
}

function setExactMatch(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    userSettingsStore.set('globalSearch.exactMatch', value);
  }
}

function setTypoTolerance(value: boolean | 'indeterminate') {
  if (typeof value === 'boolean') {
    userSettingsStore.set('globalSearch.typoTolerance', value);
  }
}

function toggleOptions() {
  showOptions.value = !showOptions.value;
}

const selectedPath = ref<string | null>(null);
const collapsedDrives = ref<Set<string>>(new Set());

const hasIndexData = computed(() => globalSearchStore.indexedItemCount > 0);
const showScanProgress = computed(() => (globalSearchStore.isScanInProgress || globalSearchStore.isCommitting) && globalSearchStore.totalDrivesCount > 0);
const isCommitting = computed(() => globalSearchStore.isCommitting);

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return t('globalSearch.relativeTime.justNow');
  if (minutes < 60) return t('globalSearch.relativeTime.minutesAgo', minutes);
  if (hours < 24) return t('globalSearch.relativeTime.hoursAgo', hours);
  if (days < 7) return t('globalSearch.relativeTime.daysAgo', days);

  return new Date(timestamp).toLocaleDateString();
}

const lastScanRelative = computed(() => {
  if (!globalSearchStore.lastScanTime) return null;
  return formatRelativeTime(globalSearchStore.lastScanTime);
});

type GroupedResults = {
  driveRoot: string;
  driveInfo: DriveInfo | null;
  entries: DirEntry[];
};

function getDriveRoot(path: string): string {
  if (/^[a-zA-Z]:/.test(path)) {
    return path.substring(0, 2).toUpperCase() + '/';
  }

  const parts = path.split('/').filter(Boolean);

  if (parts.length > 0) {
    return '/' + parts[0];
  }

  return '/';
}

const filteredResults = computed(() => {
  return globalSearchStore.results.filter((entry) => {
    if (entry.is_file && !includeFiles.value) return false;
    if (entry.is_dir && !includeDirectories.value) return false;
    return true;
  });
});

const groupedResults = computed<GroupedResults[]>(() => {
  const groups = new Map<string, DirEntry[]>();

  for (const entry of filteredResults.value) {
    const driveRoot = getDriveRoot(entry.path);
    const existing = groups.get(driveRoot);

    if (existing) {
      existing.push(entry);
    }
    else {
      groups.set(driveRoot, [entry]);
    }
  }

  return Array.from(groups.entries())
    .sort(([driveRootA], [driveRootB]) => driveRootA.localeCompare(driveRootB))
    .map(([driveRoot, entries]) => ({
      driveRoot,
      driveInfo: getDriveByPath(driveRoot),
      entries,
    }));
});

const totalResultsCount = computed(() => filteredResults.value.length);

watch([exactMatch, typoTolerance, resultLimit], () => {
  if (globalSearchStore.query.trim()) {
    globalSearchStore.search();
  }
});

function toggleDriveCollapse(driveRoot: string) {
  if (collapsedDrives.value.has(driveRoot)) {
    collapsedDrives.value.delete(driveRoot);
  }
  else {
    collapsedDrives.value.add(driveRoot);
  }
}

function isDriveCollapsed(driveRoot: string): boolean {
  return collapsedDrives.value.has(driveRoot);
}

function setSelected(entry: DirEntry) {
  selectedPath.value = entry.path;
}

function isSelected(entry: DirEntry): boolean {
  return selectedPath.value === entry.path;
}

function handleEntryMouseUp(entry: DirEntry, event: MouseEvent) {
  setSelected(entry);

  if (event.detail >= 2) {
    emit('openEntry', entry);
  }
}

function handleClose() {
  emit('close');
}

function clearQuery() {
  globalSearchStore.clearQuery();
  inputRef.value?.$el?.focus();
}

function focusInput() {
  setTimeout(() => {
    inputRef.value?.$el?.focus();
  }, 0);
}

watch(() => globalSearchStore.isOpen, (isOpen) => {
  if (isOpen) {
    focusInput();
  }
}, { immediate: true });

onMounted(() => {
  focusInput();
});

</script>

<template>
  <div class="global-search-view">
    <div class="global-search-view__header">
      <div class="global-search-view__search-container">
        <SearchIcon
          v-if="!globalSearchStore.isSearching"
          :size="18"
          class="global-search-view__search-icon"
        />
        <LoaderCircleIcon
          v-else
          :size="18"
          class="global-search-view__search-icon global-search-view__search-icon--loading"
        />
        <Input
          ref="inputRef"
          :model-value="globalSearchStore.query"
          :placeholder="t('globalSearch.globalSearch')"
          class="global-search-view__input"
          :disabled="!hasIndexData && !globalSearchStore.isScanInProgress"
          @update:model-value="globalSearchStore.setQuery(String($event ?? ''))"
        />
        <Button
          v-if="globalSearchStore.query"
          variant="ghost"
          size="icon"
          class="global-search-view__clear-button"
          @click="clearQuery"
        >
          <XIcon :size="16" />
        </Button>
      </div>
      <div class="global-search-view__header-actions">
        <Button
          variant="ghost"
          size="icon"
          class="global-search-view__options-toggle"
          :data-active="showOptions || undefined"
          @click="toggleOptions"
        >
          <SlidersHorizontalIcon :size="18" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          class="global-search-view__close"
          @click="handleClose"
        >
          <XIcon :size="18" />
        </Button>
      </div>
    </div>

    <div
      v-if="showOptions"
      class="global-search-view__options"
    >
      <div class="global-search-view__options-group">
        <span class="global-search-view__options-group-title">{{ t('results') }}</span>
        <div class="global-search-view__options-row">
          <Checkbox
            id="include-files"
            :model-value="includeFiles"
            @update:model-value="setIncludeFiles"
          />
          <Label
            for="include-files"
            class="global-search-view__option-label"
          >
            {{ t('globalSearch.showFiles') }}
          </Label>
        </div>
        <div class="global-search-view__options-row">
          <Checkbox
            id="include-directories"
            :model-value="includeDirectories"
            @update:model-value="setIncludeDirectories"
          />
          <Label
            for="include-directories"
            class="global-search-view__option-label"
          >
            {{ t('globalSearch.showDirectories') }}
          </Label>
        </div>
      </div>

      <div class="global-search-view__options-group">
        <span class="global-search-view__options-group-title">{{ t('options') }}</span>
        <div class="global-search-view__options-row">
          <Checkbox
            id="exact-match"
            :model-value="exactMatch"
            @update:model-value="setExactMatch"
          />
          <Label
            for="exact-match"
            class="global-search-view__option-label"
          >
            {{ t('globalSearch.exactMatch') }}
          </Label>
        </div>
        <div class="global-search-view__options-row">
          <Checkbox
            id="typo-tolerance"
            :model-value="typoTolerance"
            @update:model-value="setTypoTolerance"
          />
          <Label
            for="typo-tolerance"
            class="global-search-view__option-label"
          >
            {{ t('globalSearch.typoTolerance') }}
          </Label>
        </div>
      </div>

      <div class="global-search-view__options-group">
        <span class="global-search-view__options-group-title">{{ t('settings.globalSearch.resultLimit') }}</span>
        <NumberField
          :model-value="resultLimit"
          class="global-search-view__options-limit-field"
          :min="10"
          :max="500"
          :step="10"
          @update:model-value="setResultLimit"
        >
          <NumberFieldContent>
            <NumberFieldDecrement />
            <NumberFieldInput />
            <NumberFieldIncrement />
          </NumberFieldContent>
        </NumberField>
      </div>
    </div>

    <div class="global-search-view__content">
      <div
        v-if="showScanProgress"
        class="global-search-view__scan-status"
      >
        <div class="global-search-view__scan-info">
          <span class="global-search-view__scan-text">
            {{ isCommitting ? t('globalSearch.indexStatus.committing') : (globalSearchStore.isParallelScan ? t('globalSearch.scanningInParallel') : t('globalSearch.driveScanInProgress')) }}
          </span>
          <span
            v-if="globalSearchStore.currentDriveRoot && !isCommitting && !globalSearchStore.isParallelScan"
            class="global-search-view__scan-drive"
          >
            {{ globalSearchStore.currentDriveRoot }}
          </span>
          <span
            v-if="!isCommitting"
            class="global-search-view__scan-count"
          >
            {{ globalSearchStore.scannedDrivesCount }} / {{ globalSearchStore.totalDrivesCount }}
          </span>
        </div>
        <div class="global-search-view__scan-progress-bar">
          <div
            class="global-search-view__scan-progress-bar-fill"
            :style="{ width: isCommitting ? '100%' : `${globalSearchStore.scanProgress}%` }"
          />
        </div>
        <div class="global-search-view__scan-items">
          {{ t('globalSearch.indexedItems') }}: {{ globalSearchStore.indexedItemCount.toLocaleString() }}
        </div>
      </div>

      <ScrollArea class="global-search-view__results">
        <EmptyState
          v-if="!hasIndexData && !globalSearchStore.isScanInProgress && !globalSearchStore.isCommitting"
          :icon="SearchIcon"
          :title="t('globalSearch.searchDataIncomplete')"
          :description="t('globalSearch.noDrivesSelected')"
          :bordered="false"
        />

        <div
          v-else-if="!hasIndexData && globalSearchStore.isScanInProgress"
          class="global-search-view__empty"
        >
          <LoaderCircleIcon
            :size="48"
            class="global-search-view__empty-icon global-search-view__empty-icon--loading"
          />
          <span class="global-search-view__empty-title">
            {{ t('globalSearch.driveScanInProgress') }}
          </span>
          <span class="global-search-view__empty-description">
            {{ t('globalSearch.searchStats.searched', { n: globalSearchStore.indexedItemCount.toLocaleString() }) }}
          </span>
        </div>

        <div
          v-else-if="!globalSearchStore.query.trim()"
          class="global-search-view__empty"
        >
          <SearchIcon
            :size="48"
            class="global-search-view__empty-icon"
          />
          <span class="global-search-view__empty-title">
            {{ t('globalSearch.globalSearch') }}
          </span>
          <span class="global-search-view__empty-description">
            {{ t('globalSearch.searchStats.searched', { n: globalSearchStore.indexedItemCount.toLocaleString() }) }}
            ({{ t('globalSearch.searchStats.searchingLevelsDeep', { n: scanDepth }) }})
          </span>
          <span
            v-if="lastScanRelative"
            class="global-search-view__empty-description"
          >
            {{ t('globalSearch.searchStats.indexed', { time: lastScanRelative }) }}
          </span>
          <Button
            variant="outline"
            size="sm"
            class="global-search-view__settings-button"
            @click="openSearchSettings"
          >
            <SettingsIcon :size="14" />
            {{ t('globalSearch.showSearchSettings') }}
          </Button>
        </div>

        <EmptyState
          v-else-if="globalSearchStore.results.length === 0 && !globalSearchStore.isSearching"
          :icon="SearchIcon"
          :title="t('globalSearch.searchStats.nothingFound')"
          :bordered="false"
        />

        <template v-else-if="globalSearchStore.results.length > 0">
          <div class="global-search-view__results-header">
            {{ t('globalSearch.searchStats.found', totalResultsCount) }}
          </div>

          <div
            v-for="group in groupedResults"
            :key="group.driveRoot"
            class="global-search-view__drive-group"
          >
            <button
              class="global-search-view__drive-header"
              @click="toggleDriveCollapse(group.driveRoot)"
            >
              <component
                :is="group.driveInfo?.is_removable ? UsbIcon : HardDriveIcon"
                :size="16"
                class="global-search-view__drive-icon"
              />
              <span class="global-search-view__drive-name">
                {{ group.driveInfo?.name || group.driveRoot }}
              </span>
              <span class="global-search-view__drive-count">
                {{ t('item', group.entries.length) }}
              </span>
              <ChevronDownIcon
                :size="16"
                class="global-search-view__drive-chevron"
                :class="{ 'global-search-view__drive-chevron--collapsed': isDriveCollapsed(group.driveRoot) }"
              />
            </button>

            <div
              v-if="!isDriveCollapsed(group.driveRoot)"
              class="global-search-view__list"
            >
              <div class="global-search-view__list-header">
                <span class="global-search-view__list-header-name">{{ t('fileBrowser.name') }}</span>
                <span class="global-search-view__list-header-size">{{ t('fileBrowser.size') }}</span>
                <span class="global-search-view__list-header-modified">{{ t('fileBrowser.modified') }}</span>
              </div>

              <button
                v-for="entry in group.entries"
                :key="entry.path"
                class="global-search-view__entry"
                :class="{
                  'global-search-view__entry--dir': entry.is_dir,
                  'global-search-view__entry--file': entry.is_file,
                  'global-search-view__entry--hidden': entry.is_hidden,
                }"
                :data-selected="isSelected(entry) || undefined"
                @mouseup="handleEntryMouseUp(entry, $event)"
              >
                <div class="global-search-view__overlay-container">
                  <div class="global-search-view__overlay global-search-view__overlay--selected" />
                  <div class="global-search-view__overlay global-search-view__overlay--hover" />
                </div>
                <div class="global-search-view__entry-name">
                  <FileBrowserEntryIcon
                    :entry="entry"
                    :size="18"
                    class="global-search-view__entry-icon"
                    :class="{ 'global-search-view__entry-icon--folder': entry.is_dir }"
                  />
                  <div class="global-search-view__entry-name-content">
                    <span class="global-search-view__entry-text">{{ entry.name }}</span>
                    <span class="global-search-view__entry-path">{{ entry.path }}</span>
                  </div>
                </div>
                <span class="global-search-view__entry-size">
                  {{ entry.is_file ? formatBytes(entry.size) : entry.item_count !== null ? t('fileBrowser.itemCount', { count: entry.item_count }) : '' }}
                </span>
                <span class="global-search-view__entry-modified">
                  {{ formatDate(entry.modified_time) }}
                </span>
              </button>
            </div>
          </div>
        </template>
      </ScrollArea>
    </div>
  </div>
</template>

<style scoped>
.global-search-view {
  --results-header-height: 36px;

  display: flex;
  height: 100%;
  flex-direction: column;
}

.global-search-view__header {
  display: flex;
  align-items: center;
  padding: 16px 4px;
  gap: 12px;
}

.global-search-view__search-container {
  position: relative;
  display: flex;
  flex: 1;
  align-items: center;
}

.global-search-view__search-icon {
  position: absolute;
  left: 12px;
  color: hsl(var(--muted-foreground));
  pointer-events: none;
}

.global-search-view__search-icon--loading {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.global-search-view__input {
  flex: 1;
  padding-right: 40px;
  padding-left: 40px;
}

.global-search-view__clear-button {
  position: absolute;
  right: 4px;
  width: 32px;
  height: 32px;
}

.global-search-view__content {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 0 4px;
}

.global-search-view__scan-status {
  display: flex;
  flex-direction: column;
  padding: 12px 16px;
  background-color: hsl(var(--primary) / 5%);
  gap: 8px;
}

.global-search-view__scan-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 13px;
  gap: 8px;
}

.global-search-view__scan-text {
  color: hsl(var(--muted-foreground));
}

.global-search-view__scan-drive {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-size: 12px;
  font-weight: 500;
}

.global-search-view__scan-count {
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.global-search-view__scan-progress-bar {
  position: relative;
  overflow: hidden;
  height: 4px;
  border-radius: 9999px;
  background-color: hsl(var(--secondary));
}

.global-search-view__scan-progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background-color: hsl(var(--primary));
  transition: width 0.2s ease-out;
}

.global-search-view__scan-items {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.global-search-view__results {
  flex: 1;
}

.global-search-view__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 64px 24px;
  gap: 12px;
}

.global-search-view__empty-icon {
  color: hsl(var(--muted-foreground) / 30%);
}

.global-search-view__empty-icon--loading {
  animation: spin 1s linear infinite;
  color: hsl(var(--primary) / 50%);
}

.global-search-view__empty-title {
  color: hsl(var(--foreground));
  font-size: 16px;
  font-weight: 500;
}

.global-search-view__empty-description {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.global-search-view__settings-button {
  margin-top: 8px;
  gap: 6px;
}

.global-search-view__header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.global-search-view__options-toggle {
  color: hsl(var(--muted-foreground));
}

.global-search-view__options-toggle[data-active] {
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.global-search-view__options {
  display: flex;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border-bottom: 1px solid hsl(var(--border));
  margin: 0 4px 16px;
  background-color: hsl(var(--muted) / 30%);
  gap: 24px;
}

.global-search-view__options-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.global-search-view__options-group-title {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
}

.global-search-view__options-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.global-search-view__option-label {
  cursor: pointer;
  font-size: 13px;
  font-weight: 400;
}

.global-search-view__options-limit-field {
  width: 120px;
}

.global-search-view__results-header {
  position: sticky;
  z-index: 10;
  top: 0;
  height: var(--results-header-height);
  padding: 0 16px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--background));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 500;
  line-height: var(--results-header-height);
  text-transform: uppercase;
}

.global-search-view__drive-group {
  border-bottom: 1px solid hsl(var(--border));
}

.global-search-view__drive-header {
  position: sticky;
  z-index: 5;
  top: var(--results-header-height);
  display: flex;
  width: 100%;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background-color: hsl(var(--background-3));
  color: hsl(var(--foreground));
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  gap: 10px;
  text-align: left;
}

.global-search-view__drive-header:hover {
  background-color: hsl(var(--background-3));
}

.global-search-view__drive-header:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: -2px;
}

.global-search-view__drive-icon {
  flex-shrink: 0;
  color: hsl(var(--primary));
}

.global-search-view__drive-name {
  flex: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}

.global-search-view__drive-count {
  padding: 2px 8px;
  border-radius: 9999px;
  background-color: hsl(var(--secondary));
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
}

.global-search-view__drive-chevron {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  transition: transform 0.15s ease-out;
}

.global-search-view__drive-chevron--collapsed {
  transform: rotate(-90deg);
}

.global-search-view__list {
  display: flex;
  flex-direction: column;
}

.global-search-view__list-header {
  position: sticky;
  z-index: 2;
  top: 0;
  display: grid;
  padding: 8px 16px;
  border-bottom: 1px solid hsl(var(--border) / 50%);
  backdrop-filter: blur(var(--backdrop-filter-blur));
  background-color: hsl(var(--background) / 90%);
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 500;
  grid-template-columns: minmax(120px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  text-transform: uppercase;
}

.global-search-view__entry {
  position: relative;
  display: grid;
  padding: 10px 16px;
  border: none;
  border-bottom: 1px solid hsl(var(--border) / 30%);
  background: transparent;
  color: hsl(var(--foreground));
  cursor: default;
  font-size: 13px;
  grid-template-columns: minmax(120px, 1fr) minmax(50px, 100px) minmax(60px, 140px);
  outline: none;
  text-align: left;
}

.global-search-view__entry--hidden {
  opacity: 0.5;
}

.global-search-view__entry-name {
  position: relative;
  z-index: 1;
  display: flex;
  overflow: hidden;
  align-items: center;
  padding-right: 16px;
  gap: 10px;
}

.global-search-view__entry-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.global-search-view__entry-icon--folder {
  color: hsl(var(--primary));
}

.global-search-view__entry-name-content {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.global-search-view__entry-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search-view__entry-path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search-view__entry-size,
.global-search-view__entry-modified {
  position: relative;
  z-index: 1;
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.global-search-view__overlay-container {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
}

.global-search-view__overlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.global-search-view__overlay--selected {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 40%);
  opacity: 0;
}

.global-search-view__entry[data-selected] .global-search-view__overlay--selected {
  opacity: 1;
}

.global-search-view__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.global-search-view__entry:hover .global-search-view__overlay--hover {
  opacity: 1;
  transition: opacity 0s;
}

.global-search-view__entry:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: -2px;
}
</style>
