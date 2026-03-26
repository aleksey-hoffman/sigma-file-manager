// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, computed, markRaw, nextTick } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { getVersion } from '@tauri-apps/api/app';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useI18n } from 'vue-i18n';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { toast, ToastStatic, ToastProgress } from '@/components/ui/toaster';

const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const CHECK_COOLDOWN_MS = 10 * 60 * 1000;

const EMULATE_INSTALLED_AS_BETA1_FOR_UPDATE_TEST = !false;
const EMULATED_CURRENT_VERSION_FOR_UPDATE_CHECK = '2.0.0-beta.1';

function currentVersionSentToUpdateCheck(realVersion: string): string {
  if (!EMULATE_INSTALLED_AS_BETA1_FOR_UPDATE_TEST) {
    return realVersion;
  }

  return EMULATED_CURRENT_VERSION_FOR_UPDATE_CHECK;
}

interface UpdateCheckResult {
  updateAvailable: boolean;
  latestVersion: string;
  releaseUrl: string;
  installerDownloadUrl: string | null;
  installerFileName: string | null;
}

export interface UpdateInfo {
  latestVersion: string;
  currentVersion: string;
  releaseUrl: string;
  installerDownloadUrl: string | null;
  installerFileName: string | null;
}

const isChecking = ref(false);
const updateAvailable = ref(false);
const updateInfo = ref<UpdateInfo | null>(null);
const lastCheckError = ref<string | null>(null);
const currentVersion = ref<string>('');
const isInitialized = ref(false);

let checkIntervalId: ReturnType<typeof setInterval> | null = null;

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileBaseNameFromPath(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const segments = normalized.split('/');
  const last = segments[segments.length - 1];
  return last && last.length > 0 ? last : filePath;
}

function formatDownloadSize(
  downloaded: number | null,
  total: number | null,
): string | undefined {
  if (downloaded === null && total === null) return undefined;
  if (downloaded !== null && total !== null) return `${formatBytes(downloaded)} / ${formatBytes(total)}`;
  if (downloaded !== null) return formatBytes(downloaded);
  if (total !== null) return `? / ${formatBytes(total)}`;
  return undefined;
}

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
    if (isCooldownActive.value && !EMULATE_INSTALLED_AS_BETA1_FOR_UPDATE_TEST) {
      return updateInfo.value;
    }

    isChecking.value = true;
    lastCheckError.value = null;

    try {
      await initVersion();

      const result = await invoke<UpdateCheckResult>('check_for_updates', {
        currentVersion: currentVersionSentToUpdateCheck(currentVersion.value),
      });

      if (!EMULATE_INSTALLED_AS_BETA1_FOR_UPDATE_TEST) {
        await persistCheckTimestamp();
      }

      if (result.updateAvailable) {
        const info: UpdateInfo = {
          latestVersion: result.latestVersion,
          currentVersion: currentVersion.value,
          releaseUrl: result.releaseUrl,
          installerDownloadUrl: result.installerDownloadUrl ?? null,
          installerFileName: result.installerFileName ?? null,
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

  async function runInstallerDownload(info: UpdateInfo, toastId: string) {
    if (!info.installerDownloadUrl || !info.installerFileName) {
      return;
    }

    let progressValue = 0;
    let downloadedBytes: number | null = null;
    let totalBytes: number | null = null;

    const progressInterval = setInterval(() => {
      if (progressValue < 90 && (downloadedBytes === null || totalBytes === null || totalBytes === 0)) {
        progressValue = Math.min(90, progressValue + 3);
      }

      const sizeLabel = formatDownloadSize(downloadedBytes, totalBytes);
      const realProgress = (downloadedBytes !== null && totalBytes !== null && totalBytes > 0)
        ? Math.min(99, Math.round((downloadedBytes / totalBytes) * 100))
        : null;
      const displayProgress = realProgress ?? progressValue;

      toast.custom(markRaw(ToastProgress), {
        id: toastId,
        duration: Infinity,
        componentProps: {
          data: {
            id: toastId,
            title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
            subtitle: t('notifications.downloadingUpdate'),
            description: info.installerFileName,
            downloadSize: sizeLabel,
            progress: displayProgress,
            timer: 0,
            actionText: '',
            cleanup: () => {},
          },
        },
      });
    }, 200);

    const initialSizeLabel = formatDownloadSize(null, null);
    toast.custom(markRaw(ToastProgress), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          id: toastId,
          title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
          subtitle: t('notifications.downloadingUpdate'),
          description: info.installerFileName,
          downloadSize: initialSizeLabel,
          progress: 0,
          timer: 0,
          actionText: '',
          cleanup: () => {},
        },
      },
    });

    const unlistenProgress = await listen<{
      progressEventId: string;
      downloaded: number;
      total: number | null;
    }>(
      'binary-download-progress',
      (event) => {
        if (event.payload?.progressEventId === toastId && event.payload.downloaded !== undefined) {
          downloadedBytes = event.payload.downloaded;
          totalBytes = event.payload.total ?? null;
        }
      },
    );

    try {
      const downloadedPath = await invoke<string>('download_release_installer', {
        downloadUrl: info.installerDownloadUrl,
        fileName: info.installerFileName,
        progressEventId: toastId,
      });

      unlistenProgress();
      clearInterval(progressInterval);

      showUpdateToast(info, { downloadedPath });
    }
    catch (error) {
      unlistenProgress();
      clearInterval(progressInterval);
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`${t('notifications.downloadInstallerFailed')}: ${message}`);
      showUpdateToast(info);
    }
  }

  function showUpdateToast(info: UpdateInfo, options?: { downloadedPath?: string }) {
    const toastId = `app-update-${info.latestVersion}`;
    const downloadedPath = options?.downloadedPath;

    const dismissThisToast = () => {
      toast.dismiss(toastId);
    };

    if (downloadedPath) {
      const savedName = fileBaseNameFromPath(downloadedPath);
      toast.custom(markRaw(ToastStatic), {
        id: toastId,
        duration: Infinity,
        componentProps: {
          data: {
            title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
            subtitle: t('notifications.updateDownloaded'),
            description:
              `${t('currentVersion')}: v${info.currentVersion}\n`
              + t('notifications.installerSavedAs', { name: savedName }),
            actionText: t('openWith.open'),
            onAction: async () => {
              const result = await invoke<{
                success: boolean;
                error?: string;
              }>('open_with_default', {
                filePath: downloadedPath,
              });

              if (!result.success && result.error) {
                toast.error(result.error);
              }
            },
            secondaryActionText: t('notifications.viewRelease'),
            onSecondaryAction: () => {
              openUrl(info.releaseUrl);
            },
            onDismiss: dismissThisToast,
          },
        },
      });
      return;
    }

    const hasInstaller = Boolean(info.installerDownloadUrl && info.installerFileName);

    if (hasInstaller) {
      toast.custom(markRaw(ToastStatic), {
        id: toastId,
        duration: 15000,
        componentProps: {
          data: {
            title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
            description: `${t('currentVersion')}: v${info.currentVersion}`,
            actionText: t('download'),
            onAction: () => {
              void runInstallerDownload(info, toastId);
            },
            secondaryActionText: t('notifications.viewRelease'),
            onSecondaryAction: () => {
              openUrl(info.releaseUrl);
            },
            onDismiss: dismissThisToast,
          },
        },
      });
      return;
    }

    toast.custom(markRaw(ToastStatic), {
      id: toastId,
      duration: 15000,
      componentProps: {
        data: {
          title: `${t('notifications.updateAvailable')}: v${info.latestVersion}`,
          description: `${t('currentVersion')}: v${info.currentVersion}`,
          actionText: t('notifications.viewRelease'),
          onAction: () => {
            openUrl(info.releaseUrl);
          },
          onDismiss: dismissThisToast,
        },
      },
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

    const runInitialCheck
      = userSettingsStore.userSettings.appUpdates.autoCheck
        || EMULATE_INSTALLED_AS_BETA1_FOR_UPDATE_TEST;

    if (runInitialCheck) {
      const result = await checkForUpdates();

      if (result) {
        await nextTick();
        showUpdateToast(result);
      }
    }

    if (userSettingsStore.userSettings.appUpdates.autoCheck) {
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
