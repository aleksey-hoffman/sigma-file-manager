// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DriveInfo } from '@/types/drive-info';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const DRIVE_POLL_FAST_INTERVAL_MS = 1000;
const DRIVE_POLL_SLOW_INTERVAL_MS = 5000;
const DRIVE_FETCH_SLOW_THRESHOLD_MS = 1500;
const DRIVE_FETCH_HEALTHY_RECOVERY_COUNT = 3;

const drives = ref<DriveInfo[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

let pollTimeoutId: ReturnType<typeof setTimeout> | null = null;
let activeSubscribers = 0;
let previousDriveCount = 0;
let isInitialFetch = true;
let isFetchInFlight = false;
let pollIntervalMs = DRIVE_POLL_FAST_INTERVAL_MS;
let consecutiveHealthyFetchCount = 0;
let userSettingsStoreRef: ReturnType<typeof useUserSettingsStore> | null = null;

async function focusWindowOnDriveConnected(newDriveCount: number) {
  const driveCountIncreased = newDriveCount > previousDriveCount;
  const hasPreviousData = previousDriveCount > 0;
  const shouldFocus = userSettingsStoreRef?.userSettings.focusWindowOnDriveConnected ?? false;

  if (hasPreviousData && driveCountIncreased && shouldFocus && !isInitialFetch) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.unminimize();
      await appWindow.show();
      await appWindow.setFocus();
    }
    catch (focusError) {
      console.error('Failed to focus window:', focusError);
    }
  }

  previousDriveCount = newDriveCount;
  isInitialFetch = false;
}

function recordFetchHealth(succeeded: boolean, durationMs: number) {
  const isFetchHealthy = succeeded && durationMs < DRIVE_FETCH_SLOW_THRESHOLD_MS;

  if (isFetchHealthy) {
    consecutiveHealthyFetchCount += 1;

    if (
      pollIntervalMs !== DRIVE_POLL_FAST_INTERVAL_MS
      && consecutiveHealthyFetchCount >= DRIVE_FETCH_HEALTHY_RECOVERY_COUNT
    ) {
      pollIntervalMs = DRIVE_POLL_FAST_INTERVAL_MS;
    }
    return;
  }

  consecutiveHealthyFetchCount = 0;
  pollIntervalMs = DRIVE_POLL_SLOW_INTERVAL_MS;
}

async function fetchDrives() {
  if (isFetchInFlight) {
    return;
  }

  isFetchInFlight = true;
  const fetchStartTime = performance.now();
  let fetchSucceeded = false;

  try {
    const result = await invoke<DriveInfo[]>('get_system_drives');
    drives.value = result;
    error.value = null;
    fetchSucceeded = true;

    await focusWindowOnDriveConnected(result.length);
  }
  catch (fetchError: unknown) {
    const errorMessage = fetchError instanceof Error ? fetchError.message : String(fetchError);
    error.value = errorMessage;
    console.error('Failed to fetch drives:', fetchError);
  }
  finally {
    const fetchDurationMs = performance.now() - fetchStartTime;
    recordFetchHealth(fetchSucceeded, fetchDurationMs);
    isFetchInFlight = false;
  }
}

async function initialFetch() {
  isLoading.value = true;

  try {
    await fetchDrives();
  }
  finally {
    isLoading.value = false;
  }
}

function schedulePoll() {
  if (pollTimeoutId !== null || activeSubscribers === 0) {
    return;
  }

  pollTimeoutId = setTimeout(async () => {
    pollTimeoutId = null;
    await fetchDrives();
    schedulePoll();
  }, pollIntervalMs);
}

function startPolling() {
  schedulePoll();
}

function stopPolling() {
  if (pollTimeoutId !== null) {
    clearTimeout(pollTimeoutId);
    pollTimeoutId = null;
  }
}

async function refresh() {
  await fetchDrives();
}

function getDriveByPath(path: string): DriveInfo | null {
  const normalizedPath = path.toUpperCase();

  return drives.value.find((drive) => {
    const drivePath = drive.path.toUpperCase();
    return drivePath === normalizedPath
      || drivePath === normalizedPath.replace(/\/$/, '')
      || drivePath + '/' === normalizedPath;
  }) ?? null;
}

export function useDrives() {
  if (!userSettingsStoreRef) {
    userSettingsStoreRef = useUserSettingsStore();
  }

  onMounted(() => {
    activeSubscribers++;

    if (activeSubscribers === 1) {
      void initialFetch().finally(() => {
        startPolling();
      });
    }
  });

  onUnmounted(() => {
    activeSubscribers--;

    if (activeSubscribers === 0) {
      stopPolling();
    }
  });

  return {
    drives,
    isLoading,
    error,
    fetchDrives,
    refresh,
    getDriveByPath,
  };
}

export { drives as sharedDrives, getDriveByPath };
