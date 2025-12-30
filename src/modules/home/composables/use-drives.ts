// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, onMounted, onUnmounted } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { DriveInfo } from '@/types/drive-info';

const DRIVE_POLL_INTERVAL_MS = 1000;

const drives = ref<DriveInfo[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

let pollIntervalId: ReturnType<typeof setInterval> | null = null;
let activeSubscribers = 0;

async function fetchDrives() {
  try {
    const result = await invoke<DriveInfo[]>('get_system_drives');
    drives.value = result;
    error.value = null;
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

export function useDrives() {
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
  };
}
