// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { computed, ref, watch } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { sharedDrives } from '@/modules/home/composables/use-drives';

type GlobalSearchDriveScanError = {
  drive_root: string;
  message: string;
};

type GlobalSearchStatus = {
  is_scan_in_progress: boolean;
  is_committing: boolean;
  is_parallel_scan: boolean;
  last_scan_time: number | null;
  indexed_item_count: number;
  index_size_bytes: number;
  current_drive_root: string | null;
  drive_scan_errors: GlobalSearchDriveScanError[];
  is_index_valid: boolean;
  scanned_drives_count: number;
  total_drives_count: number;
};

const DEBOUNCE_DELAY_MS = 200;
const POLL_INTERVAL_ACTIVE_MS = 300;
const POLL_INTERVAL_IDLE_MS = 5000;
const IDLE_THRESHOLD_MS = 60 * 1000;
const IDLE_CHECK_INTERVAL_MS = 10 * 1000;

export const useGlobalSearchStore = defineStore('globalSearch', () => {
  const isOpen = ref(false);
  const query = ref('');
  const results = ref<DirEntry[]>([]);
  const isSearching = ref(false);
  const isScanInProgress = ref(false);
  const isCommitting = ref(false);
  const isParallelScan = ref(false);
  const lastScanTime = ref<number | null>(null);
  const indexedItemCount = ref<number>(0);
  const indexSizeBytes = ref<number>(0);
  const currentDriveRoot = ref<string | null>(null);
  const driveScanErrors = ref<GlobalSearchDriveScanError[]>([]);
  const isIndexValid = ref(false);
  const scannedDrivesCount = ref(0);
  const totalDrivesCount = ref(0);
  const isInitialized = ref(false);
  const lastError = ref<string | null>(null);

  const statusPollIntervalId = ref<ReturnType<typeof setInterval> | null>(null);
  const debounceTimerId = ref<ReturnType<typeof setTimeout> | null>(null);
  const searchAbortController = ref<AbortController | null>(null);
  const idleCheckIntervalId = ref<ReturnType<typeof setInterval> | null>(null);
  const driveChangeDebounceTimerId = ref<ReturnType<typeof setTimeout> | null>(null);
  const lastActivityTime = ref<number>(Date.now());
  const lastKnownDriveCount = ref<number>(0);

  const userSettingsStore = useUserSettingsStore();

  const scanProgress = computed(() => {
    if (totalDrivesCount.value === 0) return 0;
    return Math.round((scannedDrivesCount.value / totalDrivesCount.value) * 100);
  });

  const needsScan = computed(() => {
    if (isScanInProgress.value) return false;
    if (!isIndexValid.value) return true;
    if (indexedItemCount.value === 0) return true;
    return false;
  });

  const isIndexStale = computed(() => {
    if (!lastScanTime.value) return true;
    if (!isIndexValid.value) return true;
    if (indexedItemCount.value === 0) return true;

    const settings = userSettingsStore.userSettings.globalSearch;
    const staleThresholdMs = (settings.autoScanPeriodMinutes ?? 60) * 60 * 1000;
    const timeSinceLastScan = Date.now() - lastScanTime.value;

    return timeSinceLastScan > staleThresholdMs;
  });

  const isUserIdle = computed(() => {
    return (Date.now() - lastActivityTime.value) > IDLE_THRESHOLD_MS;
  });

  async function getDriveRoots(): Promise<string[]> {
    const selected = userSettingsStore.userSettings.globalSearch.selectedDriveRoots;
    if (selected.length > 0) return selected;

    try {
      const systemDrives = await invoke<Array<{ path: string }>>('get_system_drives');
      return systemDrives.map(drive => drive.path);
    }
    catch (error) {
      lastError.value = String(error);
      return [];
    }
  }

  function updateStatusFromResponse(status: GlobalSearchStatus) {
    isScanInProgress.value = status.is_scan_in_progress;
    isCommitting.value = status.is_committing ?? false;
    isParallelScan.value = status.is_parallel_scan ?? false;
    lastScanTime.value = status.last_scan_time ?? null;
    indexedItemCount.value = status.indexed_item_count ?? 0;
    indexSizeBytes.value = status.index_size_bytes ?? 0;
    currentDriveRoot.value = status.current_drive_root ?? null;
    driveScanErrors.value = Array.isArray(status.drive_scan_errors) ? status.drive_scan_errors : [];
    isIndexValid.value = status.is_index_valid ?? false;
    scannedDrivesCount.value = status.scanned_drives_count ?? 0;
    totalDrivesCount.value = status.total_drives_count ?? 0;
  }

  async function refreshStatus() {
    try {
      const status = await invoke<GlobalSearchStatus>('global_search_get_status');
      updateStatusFromResponse(status);
      lastError.value = null;
    }
    catch (error) {
      lastError.value = String(error);
    }
  }

  async function initOnLaunch() {
    if (isInitialized.value) return;

    try {
      const status = await invoke<GlobalSearchStatus>('global_search_init');
      updateStatusFromResponse(status);
      isInitialized.value = true;
      lastError.value = null;

      lastKnownDriveCount.value = sharedDrives.value.length;

      startIdleDetection();

      if (needsScan.value) {
        await startScan();
      }
    }
    catch (error) {
      lastError.value = String(error);
      isInitialized.value = true;
      startIdleDetection();
    }
  }

  function pollStatus() {
    refreshStatus();

    if (statusPollIntervalId.value !== null) {
      clearInterval(statusPollIntervalId.value);
    }

    const isActive = isScanInProgress.value || isCommitting.value;
    const interval = isActive ? POLL_INTERVAL_ACTIVE_MS : POLL_INTERVAL_IDLE_MS;
    statusPollIntervalId.value = setInterval(pollStatus, interval);
  }

  function startStatusPolling() {
    if (statusPollIntervalId.value !== null) return;
    pollStatus();
  }

  function stopStatusPolling() {
    if (statusPollIntervalId.value === null) return;
    clearInterval(statusPollIntervalId.value);
    statusPollIntervalId.value = null;
  }

  async function startScan() {
    if (isScanInProgress.value) return;

    try {
      const settings = userSettingsStore.userSettings.globalSearch;
      const driveRoots = await getDriveRoots();

      if (driveRoots.length === 0) {
        lastError.value = 'No drives available for scanning';
        return;
      }

      startStatusPolling();

      await invoke('global_search_start_scan', {
        settings: {
          scan_depth: Math.max(1, Math.floor(settings.scanDepth)),
          ignored_paths: settings.ignoredPaths,
          drive_roots: driveRoots,
          parallel_scan: settings.parallelScan ?? false,
        },
      });

      await refreshStatus();
      lastError.value = null;
    }
    catch (error) {
      lastError.value = String(error);
      isScanInProgress.value = false;
    }
  }

  async function cancelScan() {
    if (!isScanInProgress.value) return;

    try {
      await invoke('global_search_cancel_scan');

      const maxWaitMs = 5000;
      const pollIntervalMs = 100;
      let waited = 0;

      while (waited < maxWaitMs) {
        await refreshStatus();

        if (!isScanInProgress.value) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
        waited += pollIntervalMs;
      }
    }
    catch (error) {
      lastError.value = String(error);
    }
  }

  function cancelPendingSearch() {
    if (debounceTimerId.value) {
      clearTimeout(debounceTimerId.value);
      debounceTimerId.value = null;
    }

    if (searchAbortController.value) {
      searchAbortController.value.abort();
      searchAbortController.value = null;
    }
  }

  async function executeSearch(searchQuery: string) {
    if (!searchQuery.trim()) {
      results.value = [];
      return;
    }

    if (indexedItemCount.value === 0) {
      results.value = [];
      return;
    }

    searchAbortController.value = new AbortController();
    isSearching.value = true;

    try {
      const settings = userSettingsStore.userSettings.globalSearch;
      const list = await invoke<Array<DirEntry & { score?: number }>>('global_search_query', {
        query: searchQuery.trim(),
        options: {
          limit: settings.resultLimit ?? 50,
          include_files: true,
          include_directories: true,
          exact_match: settings.exactMatch ?? false,
          typo_tolerance: settings.typoTolerance ?? true,
          min_score_threshold: null,
        },
      });

      if (searchAbortController.value?.signal.aborted) {
        return;
      }

      results.value = list.map(item => ({
        name: item.name,
        ext: item.ext ?? null,
        path: item.path,
        size: item.size ?? 0,
        item_count: item.item_count ?? null,
        modified_time: item.modified_time ?? 0,
        accessed_time: item.accessed_time ?? 0,
        created_time: item.created_time ?? 0,
        mime: item.mime ?? null,
        is_file: Boolean(item.is_file),
        is_dir: Boolean(item.is_dir),
        is_symlink: Boolean(item.is_symlink),
        is_hidden: Boolean(item.is_hidden),
      }));

      lastError.value = null;
    }
    catch (error) {
      if (!searchAbortController.value?.signal.aborted) {
        lastError.value = String(error);
        results.value = [];
      }
    }
    finally {
      isSearching.value = false;
      searchAbortController.value = null;
    }
  }

  function search() {
    cancelPendingSearch();

    debounceTimerId.value = setTimeout(() => {
      executeSearch(query.value);
    }, DEBOUNCE_DELAY_MS);
  }

  function open() {
    isOpen.value = true;
    refreshStatus();
    startStatusPolling();
  }

  function close() {
    isOpen.value = false;
    cancelPendingSearch();
    stopStatusPolling();
  }

  function toggle() {
    if (isOpen.value) {
      close();
    }
    else {
      open();
    }
  }

  function setQuery(value: string) {
    query.value = value;
  }

  function clearQuery() {
    cancelPendingSearch();
    query.value = '';
    results.value = [];
  }

  function recordActivity() {
    lastActivityTime.value = Date.now();
  }

  function checkIdleReindex() {
    const settings = userSettingsStore.userSettings.globalSearch;

    if (!settings.autoReindexWhenIdle) return;
    if (isScanInProgress.value) return;
    if (!isInitialized.value) return;
    if (!isIndexStale.value) return;
    if (!isUserIdle.value) return;

    startScan();
  }

  function startIdleDetection() {
    if (idleCheckIntervalId.value !== null) return;

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, recordActivity, { passive: true });
    });

    idleCheckIntervalId.value = setInterval(checkIdleReindex, IDLE_CHECK_INTERVAL_MS);
  }

  function stopIdleDetection() {
    if (idleCheckIntervalId.value !== null) {
      clearInterval(idleCheckIntervalId.value);
      idleCheckIntervalId.value = null;
    }

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];
    activityEvents.forEach((event) => {
      window.removeEventListener(event, recordActivity);
    });
  }

  async function handleDriveListChange() {
    if (!isInitialized.value) return;

    const currentCount = sharedDrives.value.length;

    if (lastKnownDriveCount.value === 0) {
      lastKnownDriveCount.value = currentCount;
      return;
    }

    if (currentCount !== lastKnownDriveCount.value) {
      lastKnownDriveCount.value = currentCount;

      if (driveChangeDebounceTimerId.value !== null) {
        clearTimeout(driveChangeDebounceTimerId.value);
      }

      if (isScanInProgress.value) {
        await cancelScan();
      }

      driveChangeDebounceTimerId.value = setTimeout(() => {
        driveChangeDebounceTimerId.value = null;
        startScanWithCurrentDrives();
      }, 2000);
    }
  }

  async function startScanWithCurrentDrives() {
    if (!isInitialized.value) return;

    const settings = userSettingsStore.userSettings.globalSearch;
    const selectedRoots = settings.selectedDriveRoots;
    let driveRoots: string[];

    if (selectedRoots.length > 0) {
      driveRoots = selectedRoots.filter(root =>
        sharedDrives.value.some(drive => drive.path === root),
      );
    }
    else {
      driveRoots = sharedDrives.value.map(drive => drive.path);
    }

    if (driveRoots.length === 0) {
      return;
    }

    try {
      await invoke('global_search_start_scan', {
        settings: {
          scan_depth: Math.max(1, Math.floor(settings.scanDepth)),
          ignored_paths: settings.ignoredPaths,
          drive_roots: driveRoots,
          parallel_scan: settings.parallelScan ?? false,
        },
      });

      startStatusPolling();
    }
    catch (error) {
      lastError.value = String(error);
    }
  }

  watch(query, () => {
    search();
  });

  watch(sharedDrives, () => {
    handleDriveListChange();
  }, { deep: true });

  watch(
    () => userSettingsStore.userSettings.globalSearch.ignoredPaths,
    async (newPaths, oldPaths) => {
      if (!isInitialized.value) return;

      const pathsChanged = JSON.stringify(newPaths) !== JSON.stringify(oldPaths);

      if (pathsChanged) {
        if (isScanInProgress.value) {
          await cancelScan();
        }

        startScan();
      }
    },
    { deep: true },
  );

  return {
    isOpen,
    query,
    results,
    isSearching,
    isScanInProgress,
    isCommitting,
    isParallelScan,
    lastScanTime,
    indexedItemCount,
    indexSizeBytes,
    currentDriveRoot,
    driveScanErrors,
    isIndexValid,
    scannedDrivesCount,
    totalDrivesCount,
    scanProgress,
    needsScan,
    isIndexStale,
    isUserIdle,
    isInitialized,
    lastError,
    open,
    close,
    toggle,
    setQuery,
    clearQuery,
    refreshStatus,
    initOnLaunch,
    startStatusPolling,
    stopStatusPolling,
    startScan,
    cancelScan,
    search,
    startIdleDetection,
    stopIdleDetection,
  };
});
