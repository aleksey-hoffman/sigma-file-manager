// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, markRaw } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { toast, CustomSimple } from '@/components/ui/toaster';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_COOLDOWN_MS = 10 * 60 * 1000;

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  releaseUrl: string;
}

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
}

const isChecking = ref(false);
const updateAvailable = ref(false);
const updateInfo = ref<UpdateInfo | null>(null);
const lastCheckError = ref<string | null>(null);
const currentVersion = ref<string>('');
const isInitialized = ref(false);

let checkIntervalId: ReturnType<typeof setInterval> | null = null;

export function useAppUpdater() {
  const { t } = useI18n();
  const userSettingsStore = useUserSettingsStore();

  const isCooldownActive = computed(() => {
    const lastCheckTimestamp = userSettingsStore.userSettings.appUpdates.lastCheckTimestamp;
    return Date.now() - lastCheckTimestamp < CHECK_COOLDOWN_MS;
  });

  async function persistCheckTimestamp() {
    await userSettingsStore.set('appUpdates.lastCheckTimestamp', Date.now());
  }

  async function initVersion() {
    if (!currentVersion.value) {
      try {
        currentVersion.value = await getVersion();
      }
      catch {
        currentVersion.value = '0.0.0';
      }
    }
  }

  async function checkForUpdates(): Promise<UpdateInfo | null> {
    if (isCooldownActive.value) {
      return updateInfo.value;
    }

    isChecking.value = true;
    lastCheckError.value = null;

    try {
      await initVersion();

      const result = await invoke<UpdateCheckResult>('check_for_updates', {
        currentVersion: currentVersion.value,
      });

      await persistCheckTimestamp();

      if (result.updateAvailable) {
        const info: UpdateInfo = {
          latestVersion: result.latestVersion,
          currentVersion: currentVersion.value,
          releaseUrl: result.releaseUrl,
        };

        updateAvailable.value = true;
        updateInfo.value = info;
        isChecking.value = false;
        return info;
      }

      updateAvailable.value = false;
      updateInfo.value = null;
      isChecking.value = false;
      return null;
    }
    catch (error) {
      lastCheckError.value = error instanceof Error ? error.message : String(error);
      isChecking.value = false;
      return null;
    }
  }

  function showUpdateToast(info: UpdateInfo) {
    toast.custom(markRaw(CustomSimple), {
      componentProps: {
        title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
        description: `${t('currentVersion')}: v${info.currentVersion}`,
        actionText: t('download'),
        onAction: () => {
          openUrl(info.releaseUrl);
        },
      },
      duration: 15000,
    });
  }

  function stopPeriodicCheck() {
    if (checkIntervalId !== null) {
      clearInterval(checkIntervalId);
      checkIntervalId = null;
    }
  }

  function startPeriodicCheck() {
    stopPeriodicCheck();
    checkIntervalId = setInterval(async () => {
      const result = await checkForUpdates();

      if (result) {
        showUpdateToast(result);
      }
    }, CHECK_INTERVAL_MS);
  }

  async function initAutoCheck() {
    if (isInitialized.value) {
      return;
    }

    isInitialized.value = true;
    await initVersion();

    if (userSettingsStore.userSettings.appUpdates.autoCheck) {
      const result = await checkForUpdates();

      if (result) {
        showUpdateToast(result);
      }

      startPeriodicCheck();
    }
  }

  async function onAutoCheckSettingChanged(enabled: boolean) {
    if (enabled) {
      const result = await checkForUpdates();

      if (result) {
        showUpdateToast(result);
      }

      startPeriodicCheck();
    }
    else {
      stopPeriodicCheck();
    }
  }

  return {
    isChecking,
    updateAvailable,
    updateInfo,
    lastCheckError,
    currentVersion,
    isCooldownActive,
    checkForUpdates,
    initAutoCheck,
    onAutoCheckSettingChanged,
    stopPeriodicCheck,
  };
}
