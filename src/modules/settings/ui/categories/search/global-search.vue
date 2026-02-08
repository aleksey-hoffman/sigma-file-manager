<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import {
  BanIcon, CheckIcon, CircleAlertIcon, ClockIcon, DatabaseIcon, FolderTreeIcon, HardDriveIcon,
  ListIcon, LoaderCircleIcon, RefreshCcwIcon, UsbIcon, XIcon, ZapIcon,
} from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from '@/components/ui/number-field';
import { FacetedFilter } from '@/components/ui/faceted-filter';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';
import { useDrives } from '@/modules/home/composables/use-drives';
import { formatBytes } from '@/modules/navigator/components/file-browser/utils';
import { SEARCH_CONSTANTS } from '@/constants';
import normalizePath from '@/utils/normalize-path';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();
const globalSearchStore = useGlobalSearchStore();
const { indexedItemCount } = storeToRefs(globalSearchStore);
const { drives } = useDrives();

const displayTick = ref(0);
let displayTickIntervalId: ReturnType<typeof setInterval> | null = null;

const scanDepth = computed(() => userSettingsStore.userSettings.globalSearch.scanDepth);
const parallelScan = computed(() => userSettingsStore.userSettings.globalSearch.parallelScan);
const autoReindexWhenIdle = computed(() => userSettingsStore.userSettings.globalSearch.autoReindexWhenIdle);
const autoScanPeriodMinutes = computed(() => userSettingsStore.userSettings.globalSearch.autoScanPeriodMinutes);
const resultLimit = computed(() => userSettingsStore.userSettings.globalSearch.resultLimit);

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
  void displayTick.value;
  if (!globalSearchStore.lastScanTime) return null;
  return formatRelativeTime(globalSearchStore.lastScanTime);
});

const formattedIndexSize = computed(() => {
  if (globalSearchStore.indexSizeBytes === 0) return '-';
  return formatBytes(globalSearchStore.indexSizeBytes);
});

const selectedDriveCount = computed(() => {
  const selected = userSettingsStore.userSettings.globalSearch.selectedDriveRoots;
  const availableDrivePaths = drives.value.map(drive => drive.path);

  if (selected.length > 0) {
    return selected.filter(path => availableDrivePaths.includes(path)).length;
  }

  return drives.value.length;
});

const indexStatus = computed(() => {
  void displayTick.value;
  if (globalSearchStore.isCommitting) return 'committing';
  if (globalSearchStore.isScanInProgress) return 'scanning';
  if (globalSearchStore.driveScanErrors.length > 0 && globalSearchStore.indexedItemCount === 0) return 'error';
  if (globalSearchStore.indexedItemCount === 0) return 'empty';
  if (!globalSearchStore.lastScanTime) return 'empty';

  const hoursSinceLastScan = (Date.now() - globalSearchStore.lastScanTime) / (1000 * 60 * 60);
  if (hoursSinceLastScan > 24) return 'outdated';

  return 'ready';
});

const internalIgnoredPaths = new Set<string>([
  '/$Recycle.Bin',
  '/System Volume Information',
  '/proc',
  '/sys',
  '/dev',
  '/run',
  '/tmp',
  '/var/tmp',
  '/lost+found',
  '/.Trash',
  '/.Trashes',
  '/.Spotlight-V100',
  '/.fseventsd',
  '/Volumes/.Trashes',
  '/node_modules',
  '/.git',
  '/target',
  '/.cache',
  '/Library/Caches',
  '/AppData/Local/Temp',
]);

const ignoredPaths = computed({
  get: () => userSettingsStore.userSettings.globalSearch.ignoredPaths,
  set: value => userSettingsStore.set('globalSearch.ignoredPaths', value),
});

const ignoredPathsForDisplay = computed(() => ignoredPaths.value.filter(path => !internalIgnoredPaths.has(path)));
const selectedDriveRoots = computed(() => userSettingsStore.userSettings.globalSearch.selectedDriveRoots);

function setScanDepth(value: string | number | undefined) {
  const depth = Math.max(1, Math.floor(Number(value ?? 1)));
  userSettingsStore.set('globalSearch.scanDepth', depth);
}

function setParallelScan(value: boolean) {
  userSettingsStore.set('globalSearch.parallelScan', value);
}

function setResultLimit(value: string | number | undefined) {
  const limit = Math.max(
    SEARCH_CONSTANTS.MIN_RESULT_LIMIT,
    Math.min(SEARCH_CONSTANTS.MAX_RESULT_LIMIT, Math.floor(Number(value ?? SEARCH_CONSTANTS.DEFAULT_RESULT_LIMIT))),
  );
  userSettingsStore.set('globalSearch.resultLimit', limit);
}

function setAutoReindexWhenIdle(value: boolean) {
  userSettingsStore.set('globalSearch.autoReindexWhenIdle', value);
}

function setAutoScanPeriodMinutes(value: string | number | undefined) {
  const period = Math.max(15, Math.floor(Number(value ?? 60)));
  userSettingsStore.set('globalSearch.autoScanPeriodMinutes', period);
}

function addIgnoredPathFromFilter(value: string) {
  const next = value.trim();
  if (!next) return;
  const set = new Set(ignoredPaths.value);
  set.add(normalizePath(next));
  ignoredPaths.value = Array.from(set);
}

function setIgnoredPaths(value: string[]) {
  ignoredPaths.value = value;
}

function toggleDriveRoot(path: string) {
  const set = new Set(selectedDriveRoots.value);
  if (set.has(path)) set.delete(path);
  else set.add(path);
  userSettingsStore.set('globalSearch.selectedDriveRoots', Array.from(set));
}

async function rescan() {
  await globalSearchStore.startScan();
}

async function cancelScan() {
  await globalSearchStore.cancelScan();
}

onMounted(async () => {
  await globalSearchStore.refreshStatus();
  globalSearchStore.startStatusPolling();
  displayTickIntervalId = setInterval(() => {
    displayTick.value++;
  }, 30000);
});

onUnmounted(() => {
  const isActive = globalSearchStore.isScanInProgress || globalSearchStore.isCommitting;

  if (!isActive) {
    globalSearchStore.stopStatusPolling();
  }

  if (displayTickIntervalId !== null) {
    clearInterval(displayTickIntervalId);
    displayTickIntervalId = null;
  }
});
</script>

<template>
  <div class="global-search-settings">
    <SettingsItem
      :title="t('settings.globalSearch.searchData')"
      :icon="DatabaseIcon"
    >
      <template #description>
        <div class="global-search-settings__status-container">
          <div class="global-search-settings__status-header">
            <div
              class="global-search-settings__status-badge"
              :data-status="indexStatus"
            >
              <LoaderCircleIcon
                v-if="indexStatus === 'scanning' || indexStatus === 'committing'"
                :size="14"
                class="global-search-settings__status-badge-icon global-search-settings__status-badge-icon--spinning"
              />
              <CheckIcon
                v-else-if="indexStatus === 'ready'"
                :size="14"
                class="global-search-settings__status-badge-icon"
              />
              <CircleAlertIcon
                v-else
                :size="14"
                class="global-search-settings__status-badge-icon"
              />
              <span>{{ t(`globalSearch.indexStatus.${indexStatus}`) }}</span>
            </div>
            <div class="global-search-settings__status-actions">
              <Button
                v-if="globalSearchStore.isScanInProgress && !globalSearchStore.isCommitting"
                variant="outline"
                size="sm"
                class="global-search-settings__cancel-button"
                @click="cancelScan"
              >
                <XIcon :size="14" />
                <span>{{ t('cancel') }}</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                class="global-search-settings__rescan-button"
                :disabled="globalSearchStore.isScanInProgress || globalSearchStore.isCommitting"
                @click="rescan"
              >
                <RefreshCcwIcon
                  :size="14"
                  :class="{ 'global-search-settings__rescan-icon--spinning': globalSearchStore.isScanInProgress || globalSearchStore.isCommitting }"
                />
                <span>{{ t('settings.globalSearch.reScanDrives') }}</span>
              </Button>
            </div>
          </div>

          <div
            v-if="globalSearchStore.isScanInProgress"
            class="global-search-settings__scan-progress"
          >
            <div class="global-search-settings__scan-progress-info">
              <span class="global-search-settings__scan-progress-label">
                {{ globalSearchStore.isParallelScan ? t('globalSearch.scanningInParallel') : t('globalSearch.scanning') }}
              </span>
              <span
                v-if="globalSearchStore.currentDriveRoot && !globalSearchStore.isParallelScan"
                class="global-search-settings__scan-progress-drive"
              >
                {{ globalSearchStore.currentDriveRoot }}
              </span>
              <span class="global-search-settings__scan-progress-count">
                {{ globalSearchStore.scannedDrivesCount }} / {{ globalSearchStore.totalDrivesCount }}
              </span>
            </div>
            <div class="global-search-settings__progress-bar">
              <div
                class="global-search-settings__progress-bar-fill"
                :style="{ width: `${globalSearchStore.scanProgress}%` }"
              />
            </div>
          </div>

          <div class="global-search-settings__metrics">
            <div class="global-search-settings__metric">
              <span class="global-search-settings__metric-value">
                {{ indexedItemCount.toLocaleString() }}
              </span>
              <span class="global-search-settings__metric-label">
                {{ t('globalSearch.indexedItems') }}
              </span>
            </div>
            <div class="global-search-settings__metric">
              <span class="global-search-settings__metric-value">
                {{ formattedIndexSize }}
              </span>
              <span class="global-search-settings__metric-label">
                {{ t('globalSearch.indexSize') }}
              </span>
            </div>
            <div class="global-search-settings__metric">
              <span class="global-search-settings__metric-value">
                {{ selectedDriveCount }}
              </span>
              <span class="global-search-settings__metric-label">
                {{ t('drives') }}
              </span>
            </div>
            <div class="global-search-settings__metric">
              <span class="global-search-settings__metric-value">
                {{ lastScanRelative ?? '-' }}
              </span>
              <span class="global-search-settings__metric-label">
                {{ t('globalSearch.lastScan') }}
              </span>
            </div>
          </div>

          <div
            v-if="globalSearchStore.driveScanErrors.length > 0"
            class="global-search-settings__errors"
          >
            <div
              v-for="errorItem in globalSearchStore.driveScanErrors"
              :key="errorItem.drive_root"
              class="global-search-settings__error-item"
            >
              <CircleAlertIcon
                :size="14"
                class="global-search-settings__error-icon"
              />
              <div class="global-search-settings__error-content">
                <span class="global-search-settings__error-drive">
                  {{ errorItem.drive_root }}
                </span>
                <span class="global-search-settings__error-message">
                  {{ errorItem.message }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </SettingsItem>

    <SettingsItem
      :title="t('settings.globalSearch.parallelScanning')"
      :description="t('settings.globalSearch.parallelScanningDescription')"
      :icon="ZapIcon"
    >
      <Switch
        :model-value="parallelScan"
        @update:model-value="setParallelScan"
      />
    </SettingsItem>

    <SettingsItem
      :title="t('settings.globalSearch.autoReindexWhenIdle')"
      :icon="ClockIcon"
      class="global-search-settings__auto-reindex-item"
    >
      <template #description>
        <div class="global-search-settings__auto-reindex-row">
          <span class="global-search-settings__auto-reindex-description">
            {{ t('settings.globalSearch.autoReindexWhenIdleDescription') }}
          </span>
          <div class="global-search-settings__auto-reindex-controls">
            <Switch
              :model-value="autoReindexWhenIdle"
              @update:model-value="setAutoReindexWhenIdle"
            />
            <NumberField
              v-if="autoReindexWhenIdle"
              :model-value="autoScanPeriodMinutes"
              class="global-search-settings__auto-reindex-period"
              :min="15"
              :step="15"
              @update:model-value="setAutoScanPeriodMinutes"
            >
              <NumberFieldContent>
                <NumberFieldDecrement />
                <NumberFieldInput />
                <NumberFieldIncrement />
              </NumberFieldContent>
            </NumberField>
            <span
              v-if="autoReindexWhenIdle"
              class="global-search-settings__auto-reindex-unit"
            >
              {{ t('minutes') }}
            </span>
          </div>
        </div>
      </template>
    </SettingsItem>

    <SettingsItem
      :title="t('settings.globalSearch.scanDepth')"
      :icon="FolderTreeIcon"
      class="global-search-settings__scan-depth-item"
    >
      <template #description>
        <div class="global-search-settings__scan-depth-description-row">
          <span class="global-search-settings__scan-depth-description">
            {{ t('settings.globalSearch.higherDepthScansWillIncrease') }}
          </span>
          <NumberField
            :model-value="scanDepth"
            class="global-search-settings__scan-depth"
            :min="1"
            :step="1"
            @update:model-value="setScanDepth"
          >
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>
      </template>
    </SettingsItem>

    <SettingsItem
      :title="t('settings.globalSearch.resultLimit')"
      :icon="ListIcon"
      class="global-search-settings__result-limit-item"
    >
      <template #description>
        <div class="global-search-settings__result-limit-description-row">
          <span class="global-search-settings__result-limit-description">
            {{ t('settings.globalSearch.resultLimitDescription') }}
          </span>
          <NumberField
            :model-value="resultLimit"
            class="global-search-settings__result-limit"
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
      </template>
    </SettingsItem>

    <SettingsItem
      :title="t('settings.globalSearch.ignoredPaths')"
      :description="t('settings.globalSearch.enterPathToAddToIgnored')"
      :icon="BanIcon"
    >
      <FacetedFilter
        :title="t('settings.globalSearch.ignoredPaths')"
        :options="ignoredPathsForDisplay"
        :model-value="ignoredPathsForDisplay"
        :min-width="400"
        allow-create
        @update:model-value="setIgnoredPaths"
        @create="addIgnoredPathFromFilter"
      />
    </SettingsItem>

    <SettingsItem
      :title="t('drives')"
      :description="t('globalSearch.selectDrives')"
      :icon="HardDriveIcon"
    >
      <template #nested>
        <div class="global-search-settings__drives">
          <button
            v-for="drive in drives"
            :key="drive.path"
            class="global-search-settings__drive-item"
            :data-selected="selectedDriveRoots.includes(drive.path) || undefined"
            @click="toggleDriveRoot(drive.path)"
          >
            <component
              :is="drive.is_removable ? UsbIcon : HardDriveIcon"
              :size="18"
              class="global-search-settings__drive-icon"
            />
            <div class="global-search-settings__drive-main">
              <span class="global-search-settings__drive-name">{{ drive.name }}</span>
            </div>
            <div class="global-search-settings__drive-checkbox">
              <CheckIcon
                v-if="selectedDriveRoots.includes(drive.path)"
                :size="14"
                class="global-search-settings__drive-checkbox-icon"
              />
            </div>
          </button>
        </div>
      </template>
    </SettingsItem>
  </div>
</template>

<style scoped>
.global-search-settings {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.global-search-settings__status-container {
  display: flex;
  flex-direction: column;
  padding: 16px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  margin-top: 12px;
  background-color: hsl(var(--background));
  gap: 16px;
}

.global-search-settings__status-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.global-search-settings__status-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.global-search-settings__status-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 9999px;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
}

.global-search-settings__status-badge[data-status="ready"] {
  background-color: hsl(var(--success) / 15%);
  color: hsl(var(--success));
}

.global-search-settings__status-badge[data-status="scanning"] {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.global-search-settings__status-badge[data-status="committing"] {
  background-color: hsl(var(--primary) / 15%);
  color: hsl(var(--primary));
}

.global-search-settings__status-badge[data-status="outdated"] {
  background-color: hsl(var(--warning) / 15%);
  color: hsl(var(--warning));
}

.global-search-settings__status-badge[data-status="empty"],
.global-search-settings__status-badge[data-status="error"] {
  background-color: hsl(var(--destructive) / 15%);
  color: hsl(var(--destructive));
}

.global-search-settings__status-badge-icon {
  flex-shrink: 0;
}

.global-search-settings__status-badge-icon--spinning {
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

.global-search-settings__rescan-button,
.global-search-settings__cancel-button {
  gap: 6px;
}

.global-search-settings__cancel-button {
  border-color: hsl(0deg 85% 60% / 40%);
  color: hsl(0deg 85% 65%);
}

.global-search-settings__cancel-button:hover {
  border-color: hsl(0deg 85% 60% / 60%);
  background-color: hsl(0deg 85% 60% / 15%);
}

.global-search-settings__rescan-icon--spinning {
  animation: spin 1s linear infinite;
}

.global-search-settings__scan-progress {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 8%);
  gap: 10px;
}

.global-search-settings__scan-progress-info {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  font-size: 13px;
  gap: 8px;
}

.global-search-settings__scan-progress-label {
  color: hsl(var(--muted-foreground));
}

.global-search-settings__scan-progress-drive {
  color: hsl(var(--foreground));
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  font-weight: 500;
}

.global-search-settings__scan-progress-count {
  margin-left: auto;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.global-search-settings__progress-bar {
  position: relative;
  overflow: hidden;
  height: 4px;
  border-radius: 9999px;
  background-color: hsl(var(--muted));
}

.global-search-settings__progress-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background-color: hsl(var(--primary));
  transition: width 0.2s ease-out;
}

.global-search-settings__metrics {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(4, 1fr);
}

.global-search-settings__metric {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--card));
  gap: 4px;
  text-align: center;
}

.global-search-settings__metric-value {
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
}

.global-search-settings__metric-label {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  text-transform: uppercase;
}

.global-search-settings__priority-index-status {
  display: flex;
  flex-direction: column;
  padding: 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background-color: hsl(var(--card));
  gap: 8px;
}

.global-search-settings__priority-index-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.global-search-settings__priority-index-title {
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 500;
}

.global-search-settings__priority-index-value {
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--success) / 15%);
  color: hsl(var(--success));
  font-size: 12px;
  font-weight: 500;
}

.global-search-settings__priority-index-description {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.5;
}

.global-search-settings__errors {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.global-search-settings__error-item {
  display: flex;
  align-items: flex-start;
  padding: 10px 12px;
  border: 1px solid hsl(var(--destructive) / 30%);
  border-radius: var(--radius-sm);
  background: hsl(var(--destructive) / 6%);
  gap: 10px;
}

.global-search-settings__error-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: hsl(var(--destructive));
}

.global-search-settings__error-content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 2px;
}

.global-search-settings__error-drive {
  color: hsl(var(--foreground));
  font-size: 12px;
  font-weight: 600;
}

.global-search-settings__error-message {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.global-search-settings > :deep(.settings-view-item:first-child .settings-view-item__main) {
  flex-direction: column;
  align-items: stretch;
}

.global-search-settings > :deep(.settings-view-item:first-child .settings-view-item__header) {
  flex: 1;
}

.global-search-settings > :deep(.settings-view-item:first-child .settings-view-item__header > div) {
  width: 100%;
}

.global-search-settings > :deep(.settings-view-item:first-child .settings-view-item__content:empty) {
  display: none;
}

.global-search-settings__scan-depth-description-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.global-search-settings__scan-depth-item :deep(.settings-view-item__header) {
  flex: 1;
}

.global-search-settings__scan-depth-item :deep(.settings-view-item__header > div) {
  min-width: 0;
  flex: 1;
}

.global-search-settings__scan-depth-item :deep(.settings-view-item__content:empty) {
  display: none;
}

.global-search-settings__scan-depth-description {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  padding-right: 16px;
  text-overflow: ellipsis;
}

.global-search-settings__scan-depth {
  width: 140px;
  flex-shrink: 0;
}

.global-search-settings__auto-reindex-item :deep(.settings-view-item__header) {
  flex: 1;
}

.global-search-settings__auto-reindex-item :deep(.settings-view-item__header > div) {
  min-width: 0;
  flex: 1;
}

.global-search-settings__auto-reindex-item :deep(.settings-view-item__content:empty) {
  display: none;
}

.global-search-settings__auto-reindex-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.global-search-settings__auto-reindex-description {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  padding-right: 16px;
  text-overflow: ellipsis;
}

.global-search-settings__auto-reindex-controls {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
}

.global-search-settings__auto-reindex-period {
  width: 100px;
}

.global-search-settings__auto-reindex-unit {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.global-search-settings__result-limit-item :deep(.settings-view-item__header) {
  flex: 1;
}

.global-search-settings__result-limit-item :deep(.settings-view-item__header > div) {
  min-width: 0;
  flex: 1;
}

.global-search-settings__result-limit-item :deep(.settings-view-item__content:empty) {
  display: none;
}

.global-search-settings__result-limit-description-row {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
}

.global-search-settings__result-limit-description {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  padding-right: 16px;
  text-overflow: ellipsis;
}

.global-search-settings__result-limit {
  width: 140px;
  flex-shrink: 0;
}

.global-search-settings__ignored-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.global-search-settings__ignored-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  gap: 12px;
}

.global-search-settings__ignored-text {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  user-select: text;
  white-space: nowrap;
}

.global-search-settings__ignored-remove.sigma-ui-button {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
}

.global-search-settings__drives {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 6px;
}

.global-search-settings__drive-item {
  display: flex;
  width: 100%;
  align-items: center;
  justify-content: flex-start;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--foreground));
  gap: 12px;
  text-align: left;
}

.global-search-settings__drive-item:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

.global-search-settings__drive-icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.global-search-settings__drive-item[data-selected] {
  border-color: hsl(var(--primary) / 50%);
  background: hsl(var(--primary) / 10%);
}

.global-search-settings__drive-main {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  margin-right: auto;
}

.global-search-settings__drive-name {
  font-weight: 500;
}

.global-search-settings__drive-checkbox {
  display: flex;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  background: transparent;
}

.global-search-settings__drive-item[data-selected] .global-search-settings__drive-checkbox {
  border-color: hsl(var(--primary) / 60%);
  background: hsl(var(--primary) / 15%);
}

.global-search-settings__drive-checkbox-icon {
  color: hsl(var(--primary));
}

@media (width <= 720px) {
  .global-search-settings__metrics {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (width <= 520px) {
  .global-search-settings__scan-depth-description-row,
  .global-search-settings__result-limit-description-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .global-search-settings__scan-depth,
  .global-search-settings__result-limit {
    width: 100%;
  }

  .global-search-settings__metrics {
    grid-template-columns: 1fr;
  }

  .global-search-settings__status-header {
    flex-direction: column;
    align-items: stretch;
  }

  .global-search-settings__status-badge {
    justify-content: center;
  }

  .global-search-settings__status-actions {
    justify-content: stretch;
  }

  .global-search-settings__status-actions > * {
    flex: 1;
  }
}
</style>
