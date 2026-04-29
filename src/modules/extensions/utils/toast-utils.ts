// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { openSettingsTab } from '@/modules/settings/utils/open-settings';
import type { ExtensionManifest } from '@/types/extension';
import {
  getBinaryDownloadCount, clearBinaryDownloadCount,
  getBinaryReuseCount, clearBinaryReuseCount,
} from '@/modules/extensions/api';

export function getExtensionDisplayName(extensionId: string, fallbackName?: string): string {
  if (fallbackName) {
    return fallbackName;
  }

  const storageStore = useExtensionsStorageStore();
  const installedExt = storageStore.extensionsData.installedExtensions[extensionId];
  return installedExt?.manifest?.name || extensionId.split('.').pop() || extensionId;
}

export function getExtensionToastTitle(extensionId: string, fallbackName?: string): string {
  const { t } = i18n.global;
  const extensionName = getExtensionDisplayName(extensionId, fallbackName);
  return `${t('featureExtension')} | ${extensionName}`;
}

export function getExtensionToastIconPath(extensionId: string): string | undefined {
  const storageStore = useExtensionsStorageStore();
  const installedExtension = storageStore.extensionsData.installedExtensions[extensionId];
  const manifestIcon = installedExtension?.manifest?.icon;

  if (typeof manifestIcon === 'string' && manifestIcon.trim().length > 0) {
    return manifestIcon.trim();
  }

  return undefined;
}

export function showDependenciesInstalledToast(extensionId: string): void {
  const downloadCount = getBinaryDownloadCount(extensionId);
  const reuseCount = getBinaryReuseCount(extensionId);
  if (downloadCount === 0 && reuseCount === 0) return;

  clearBinaryDownloadCount(extensionId);
  clearBinaryReuseCount(extensionId);

  const { t } = i18n.global;
  const toastId = `ext-ready-${extensionId}`;
  const description = reuseCount > 0 ? t('extensions.reusedDependencies', { count: reuseCount }) : '';

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: Infinity,
    componentProps: {
      data: {
        title: getExtensionToastTitle(extensionId),
        subtitle: t('extensions.api.extensionReady'),
        description,
        extensionId,
        extensionIconPath: getExtensionToastIconPath(extensionId),
      },
    },
  });

  setTimeout(() => {
    toast.dismiss(toastId);
  }, 3000);
}

export function manifestContributesThemes(manifest: ExtensionManifest): boolean {
  return (manifest.contributes?.themes?.length ?? 0) > 0;
}

export function showThemesInstalledToast(extensionId: string, manifest: ExtensionManifest): void {
  if (!manifestContributesThemes(manifest)) return;

  const { t } = i18n.global;
  const toastId = `ext-themes-installed-${extensionId}`;

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: Infinity,
    componentProps: {
      data: {
        title: getExtensionToastTitle(extensionId),
        subtitle: t('extensions.themesInstalled'),
        actionText: t('openSettings'),
        onAction: () => {
          toast.dismiss(toastId);
          void openSettingsTab('appearance');
        },
        onDismiss: () => toast.dismiss(toastId),
        extensionId,
        extensionIconPath: getExtensionToastIconPath(extensionId),
      },
    },
  });
}

export function showExtensionNoLongerAvailableToast(extensionId: string, extensionName: string): void {
  const { t } = i18n.global;
  const toastId = `ext-removed-${extensionId}`;

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: 5000,
    componentProps: {
      data: {
        title: getExtensionToastTitle(extensionId, extensionName),
        subtitle: t('extensions.noLongerAvailable'),
        description: t('extensions.removedBecauseUnapproved'),
      },
    },
  });
}

export function showExtensionBusyToast(extensionId: string): void {
  const { t } = i18n.global;
  const toastId = `ext-busy-${extensionId}`;

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: Infinity,
    componentProps: {
      data: {
        title: getExtensionToastTitle(extensionId),
        subtitle: t('extensions.api.waitForDependencies'),
        description: '',
        extensionId,
        extensionIconPath: getExtensionToastIconPath(extensionId),
      },
    },
  });

  setTimeout(() => {
    toast.dismiss(toastId);
  }, 3000);
}
