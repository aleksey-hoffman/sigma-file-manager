// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import type { GlobalSearchScanReason } from '@/stores/runtime/global-search';
import { useGlobalSearchStore } from '@/stores/runtime/global-search';

const {
  invokeMock,
  userSettings,
  setUserSettingMock,
  getIsUserIdleMock,
  startUserIdleDetectionMock,
} = vi.hoisted(() => {
  const userSettingsState = {
    globalSearch: {
      scanDepth: 7,
      autoScanPeriodMinutes: 60,
      autoReindexWhenIdle: true,
      ignoredPaths: ['/node_modules'],
      selectedDriveRoots: [] as string[],
      parallelScan: false,
      resultLimit: 100,
      includeFiles: true,
      includeDirectories: true,
      exactMatch: false,
      typoTolerance: true,
      lastManualCancelTime: null as number | null,
    },
  };

  function setNestedValue(path: string, value: unknown) {
    const keys = path.split('.');
    let current: Record<string, unknown> = userSettingsState as unknown as Record<string, unknown>;

    for (const key of keys.slice(0, -1)) {
      current = current[key] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
  }

  return {
    invokeMock: vi.fn(),
    userSettings: userSettingsState,
    setUserSettingMock: vi.fn(async (path: string, value: unknown) => {
      setNestedValue(path, value);
    }),
    getIsUserIdleMock: vi.fn(() => false),
    startUserIdleDetectionMock: vi.fn(),
  };
});

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings,
    set: setUserSettingMock,
  }),
}));

vi.mock('@/stores/storage/user-stats', () => ({
  useUserStatsStore: () => ({
    favorites: [],
    history: [],
    frequentItems: [],
    taggedItems: [],
  }),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    userPaths: {
      downloadDir: '',
      documentDir: '',
      desktopDir: '',
      pictureDir: '',
      videoDir: '',
      audioDir: '',
    },
  }),
}));

vi.mock('@/stores/runtime/app-state', () => ({
  useAppStateStore: () => ({
    getIsUserIdle: getIsUserIdleMock,
    startUserIdleDetection: startUserIdleDetectionMock,
  }),
}));

vi.mock('@/modules/home/composables/use-drives', async () => {
  const { ref } = await import('vue');
  return {
    sharedDrives: ref([{ path: 'C:/' }]),
  };
});

function createStatus(overrides: Partial<{
  is_scan_in_progress: boolean;
  is_committing: boolean;
  is_parallel_scan: boolean;
  scan_phase: 'idle' | 'scanning' | 'canceling' | 'committing';
  scan_reason: GlobalSearchScanReason | null;
  last_scan_time: number | null;
  last_scan_outcome: 'completed' | 'canceled' | 'failed' | null;
  last_scan_reason: GlobalSearchScanReason | null;
  last_scan_started_time: number | null;
  last_scan_finished_time: number | null;
  last_scan_duration_ms: number | null;
  last_scan_indexed_item_count: number | null;
  last_scan_error: string | null;
  indexed_item_count: number;
  scan_indexed_item_count: number;
  indexed_drive_roots: string[];
  index_size_bytes: number;
  current_drive_root: string | null;
  current_scan_path: string | null;
  drive_scan_errors: Array<{
    drive_root: string;
    message: string;
  }>;
  is_index_valid: boolean;
  scanned_drives_count: number;
  total_drives_count: number;
}> = {}) {
  return {
    is_scan_in_progress: false,
    is_committing: false,
    is_parallel_scan: false,
    scan_phase: 'idle',
    scan_reason: null,
    last_scan_time: Date.now(),
    last_scan_outcome: 'completed',
    last_scan_reason: 'manual',
    last_scan_started_time: Date.now() - 1000,
    last_scan_finished_time: Date.now(),
    last_scan_duration_ms: 1000,
    last_scan_indexed_item_count: 42,
    last_scan_error: null,
    indexed_item_count: 42,
    scan_indexed_item_count: 0,
    indexed_drive_roots: ['C:/'],
    index_size_bytes: 1024,
    current_drive_root: null,
    current_scan_path: null,
    drive_scan_errors: [],
    is_index_valid: true,
    scanned_drives_count: 1,
    total_drives_count: 1,
    ...overrides,
  };
}

function resetUserSettings() {
  userSettings.globalSearch.scanDepth = 7;
  userSettings.globalSearch.autoScanPeriodMinutes = 60;
  userSettings.globalSearch.autoReindexWhenIdle = true;
  userSettings.globalSearch.ignoredPaths = ['/node_modules', '/ProgramData/Microsoft'];
  userSettings.globalSearch.selectedDriveRoots = [];
  userSettings.globalSearch.parallelScan = false;
  userSettings.globalSearch.lastManualCancelTime = null;
}

describe('global search store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.useRealTimers();
    invokeMock.mockReset();
    setUserSettingMock.mockClear();
    getIsUserIdleMock.mockReset();
    getIsUserIdleMock.mockReturnValue(false);
    startUserIdleDetectionMock.mockClear();
    resetUserSettings();
  });

  it('starts manual scans with an explicit scan reason', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_system_drives') return [{ path: 'C:/' }];
      if (command === 'global_search_get_status') return createStatus();
      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.startScan();

    expect(invokeMock).toHaveBeenCalledWith('global_search_start_scan', {
      settings: expect.objectContaining({
        drive_roots: ['C:/'],
        scan_reason: 'manual',
      }),
    });
  });

  it('maps committed indexed drive roots from backend status', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'global_search_get_status') {
        return createStatus({
          indexed_drive_roots: ['C:/', 'D:/'],
        });
      }

      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.refreshStatus();

    expect(globalSearchStore.indexedDriveRoots).toEqual(['C:/', 'D:/']);
  });

  it('ignores stale search results from earlier input', async () => {
    vi.useFakeTimers();

    const pendingSearches = new Map<string, (value: unknown) => void>();
    invokeMock.mockImplementation((command: string, args?: { query?: string }) => {
      if (command === 'global_search_query') {
        return new Promise(resolve => pendingSearches.set(args?.query ?? '', resolve));
      }

      return Promise.resolve([]);
    });

    const globalSearchStore = useGlobalSearchStore();
    globalSearchStore.indexedItemCount = 1;

    globalSearchStore.setQuery('ex');
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    expect(pendingSearches.has('ex')).toBe(true);

    globalSearchStore.setQuery('exile');
    await nextTick();
    await vi.advanceTimersByTimeAsync(200);
    expect(pendingSearches.has('exile')).toBe(true);

    pendingSearches.get('exile')?.([
      {
        name: 'Exile by Aleksey Hoffman.jpg',
        path: 'C:/current.jpg',
        score: 1,
        is_file: true,
        is_dir: false,
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(globalSearchStore.results.map(result => result.path)).toEqual(['C:/current.jpg']);

    pendingSearches.get('ex')?.([
      {
        name: 'Example.jpg',
        path: 'C:/stale.jpg',
        score: 1,
        is_file: true,
        is_dir: false,
      },
    ]);
    await Promise.resolve();
    await Promise.resolve();

    expect(globalSearchStore.results.map(result => result.path)).toEqual(['C:/current.jpg']);
  });

  it('clears manual cancel suppression for settings-change scans', async () => {
    userSettings.globalSearch.lastManualCancelTime = Date.now();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_system_drives') return [{ path: 'C:/' }];
      if (command === 'global_search_get_status') return createStatus();
      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.startScan('settingsChange');

    expect(setUserSettingMock).toHaveBeenCalledWith('globalSearch.lastManualCancelTime', null);
    expect(invokeMock).toHaveBeenCalledWith('global_search_start_scan', {
      settings: expect.objectContaining({
        scan_reason: 'settingsChange',
      }),
    });
  });

  it('clears manual cancel suppression for drive-change scans', async () => {
    userSettings.globalSearch.lastManualCancelTime = Date.now();
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'get_system_drives') return [{ path: 'C:/' }];
      if (command === 'global_search_get_status') return createStatus();
      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.startScan('driveChange');

    expect(setUserSettingMock).toHaveBeenCalledWith('globalSearch.lastManualCancelTime', null);
    expect(invokeMock).toHaveBeenCalledWith('global_search_start_scan', {
      settings: expect.objectContaining({
        scan_reason: 'driveChange',
      }),
    });
  });

  it('persists manual cancel time and maps canceling status', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'global_search_cancel_scan') return undefined;

      if (command === 'global_search_get_status') {
        return createStatus({
          is_scan_in_progress: false,
          scan_phase: 'idle',
          last_scan_outcome: 'canceled',
        });
      }

      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    globalSearchStore.isScanInProgress = true;
    await globalSearchStore.cancelScan();

    expect(invokeMock).toHaveBeenCalledWith('global_search_cancel_scan');
    expect(setUserSettingMock).toHaveBeenCalledWith('globalSearch.lastManualCancelTime', expect.any(Number));
    expect(globalSearchStore.lastScanOutcome).toBe('canceled');
  });

  it('does not persist manual cancel time when cancel was not accepted', async () => {
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'global_search_cancel_scan') return undefined;

      if (command === 'global_search_get_status') {
        return createStatus({
          is_scan_in_progress: false,
          scan_phase: 'idle',
          last_scan_outcome: 'completed',
        });
      }

      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    globalSearchStore.isScanInProgress = true;
    await globalSearchStore.cancelScan();

    expect(invokeMock).toHaveBeenCalledWith('global_search_cancel_scan');
    expect(setUserSettingMock).not.toHaveBeenCalledWith('globalSearch.lastManualCancelTime', expect.any(Number));
    expect(globalSearchStore.lastScanOutcome).toBe('completed');
  });

  it('does not auto-start on launch when manual cancel suppression is active', async () => {
    const now = Date.now();
    userSettings.globalSearch.lastManualCancelTime = now;
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'global_search_init') {
        return createStatus({
          indexed_item_count: 0,
          is_index_valid: false,
          last_scan_time: null,
          last_scan_outcome: 'canceled',
        });
      }

      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.initOnLaunch();

    expect(invokeMock).toHaveBeenCalledWith('global_search_init');
    expect(invokeMock).not.toHaveBeenCalledWith('global_search_start_scan', expect.anything());
  });

  it('starts idle scans with an idle reason after suppression expires', async () => {
    vi.useFakeTimers();
    const scanTime = new Date('2026-05-23T12:00:00Z').getTime();
    vi.setSystemTime(scanTime);
    userSettings.globalSearch.lastManualCancelTime = Date.now() - (61 * 60 * 1000);
    getIsUserIdleMock.mockReturnValue(true);
    let idleCallback: (() => void) | undefined;
    startUserIdleDetectionMock.mockImplementation((callback: () => void) => {
      idleCallback = callback;
    });
    invokeMock.mockImplementation(async (command: string) => {
      if (command === 'global_search_init') {
        return createStatus({
          last_scan_time: scanTime,
          is_index_valid: true,
        });
      }

      if (command === 'get_system_drives') return [{ path: 'C:/' }];
      if (command === 'global_search_get_status') return createStatus();

      return undefined;
    });

    const globalSearchStore = useGlobalSearchStore();
    await globalSearchStore.initOnLaunch();
    vi.setSystemTime(scanTime + (61 * 60 * 1000));
    idleCallback?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(setUserSettingMock).toHaveBeenCalledWith('globalSearch.lastManualCancelTime', null);
    expect(invokeMock).toHaveBeenCalledWith('global_search_start_scan', {
      settings: expect.objectContaining({
        scan_reason: 'idle',
      }),
    });
  });
});
