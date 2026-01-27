// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import type { DriveInfo } from '@/types/drive-info';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const DRIVE_POLL_INTERVAL_MS = 1000;

const drives = ref<DriveInfo[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let activeSubscribers = 0;
let previousDriveCount = 0;
let isInitialFetch = true;
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

async function fetchDrives() {
  try {
    const result = await invoke<DriveInfo[]>('get_system_drives');
    drives.value = result;
    error.value = null;

    await focusWindowOnDriveConnected(result.length);
  }
  catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    error.value = errorMessage;
    console.error('Failed to fetch drives:', err);
  }
}

async function initialFetch() {
  isLoading.value = true;
  await fetchDrives();
  isLoading.value = false;
}

function startPolling() {
  if (pollIntervalId !== null) {
    return;
  }

  pollIntervalId = setInterval(fetchDrives, DRIVE_POLL_INTERVAL_MS);
}

function stopPolling() {
  if (pollIntervalId !== null) {
    clearInterval(pollIntervalId);
    pollIntervalId = null;
  }
}

async function refresh() {
  await fetchDrives();
}

function getDriveByPath(path: string): DriveInfo | null {
  const normalizedPath = path.replace(/\\/g, '/').toUpperCase();

  return drives.value.find((drive) => {
    const drivePath = drive.path.replace(/\\/g, '/').toUpperCase();
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
      initialFetch();
      startPolling();
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
