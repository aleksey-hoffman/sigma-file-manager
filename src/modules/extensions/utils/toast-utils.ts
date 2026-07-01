// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { openSettingsTab } from '@/modules/settings/utils/open-settings';
import type { ExtensionManifest } from '@/types/extension';
import type { InvalidCustomBinary } from '@/modules/extensions/utils/binary-health-check';
import type { BinarySetupRowState } from '@/modules/extensions/utils/extension-binary-setup-state';
import { openExtensionsBinaryEdit } from '@/modules/extensions/utils/open-extensions-binary-edit';
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

export function getBinarySetupSavedMessage(
  rows: Pick<BinarySetupRowState, 'name' | 'useManagedDownload'>[],
): {
  key: string;
  params: Record<string, string>;
} {
  const hasManagedDownload = rows.some(row => row.useManagedDownload);
  const hasCustomPath = rows.some(row => !row.useManagedDownload);

  if (hasManagedDownload && hasCustomPath) {
    return {
      key: 'extensions.binaries.savedUpdated',
      params: {},
    };
  }

  const relevantRows = hasCustomPath
    ? rows.filter(row => !row.useManagedDownload)
    : rows.filter(row => row.useManagedDownload);

  if (relevantRows.length === 1) {
    const name = relevantRows[0]!.name;

    return hasCustomPath
      ? {
          key: 'extensions.binaries.savedUsingLocalBinary',
          params: { name },
        }
      : {
          key: 'extensions.binaries.savedManagedAutomatically',
          params: { name },
        };
  }

  const names = relevantRows.map(row => row.name).join(', ');

  return hasCustomPath
    ? {
        key: 'extensions.binaries.savedUsingLocalBinaries',
        params: { names },
      }
    : {
        key: 'extensions.binaries.savedManagedAutomaticallyPlural',
        params: { names },
      };
}

export function getExtensionReadyDescription(
  extensionId: string,
  options: { reuseCount: number },
): string {
  const { t } = i18n.global;
  const storageStore = useExtensionsStorageStore();
  const manifest = storageStore.extensionsData.installedExtensions[extensionId]?.manifest;
  const binaryDefinitions = manifest?.binaries ?? [];

  if (binaryDefinitions.length === 0) {
    return options.reuseCount > 0
      ? t('extensions.reusedDependencies', { count: options.reuseCount })
      : '';
  }

  const rows = binaryDefinitions.map(binaryDefinition => ({
    name: binaryDefinition.name,
    useManagedDownload: storageStore.getBinaryPathPreference(binaryDefinition.id).mode !== 'custom',
  }));
  const hasCustomPath = rows.some(row => !row.useManagedDownload);
  const handlingMessage = getBinarySetupSavedMessage(rows);
  const handlingDescription = t(handlingMessage.key, handlingMessage.params);

  if (options.reuseCount > 0 && !hasCustomPath) {
    return t('extensions.reusedDependencies', { count: options.reuseCount });
  }

  if (options.reuseCount > 0 && hasCustomPath) {
    const reuseDescription = t('extensions.reusedDependencies', { count: options.reuseCount });
    return `${reuseDescription} ${handlingDescription}`;
  }

  return handlingDescription;
}

export function showDependenciesInstalledToast(extensionId: string): void {
  const downloadCount = getBinaryDownloadCount(extensionId);
  const reuseCount = getBinaryReuseCount(extensionId);
  const storageStore = useExtensionsStorageStore();
  const binaryCount = storageStore.extensionsData.installedExtensions[extensionId]?.manifest?.binaries?.length ?? 0;

  if (binaryCount === 0 && downloadCount === 0 && reuseCount === 0) {
    return;
  }

  clearBinaryDownloadCount(extensionId);
  clearBinaryReuseCount(extensionId);

  const { t } = i18n.global;
  const toastId = `ext-ready-${extensionId}`;
  const description = getExtensionReadyDescription(extensionId, { reuseCount });

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

export function showBinaryEditBlockedToast(): void {
  const { t } = i18n.global;
  const toastId = 'ext-binaries-edit-blocked';

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: Infinity,
    componentProps: {
      data: {
        title: t('featureExtension'),
        subtitle: t('extensions.binaries.editBlockedWhileInstalling'),
      },
    },
  });

  setTimeout(() => {
    toast.dismiss(toastId);
  }, 3000);
}

function getBinaryDisplayName(binaryId: string): string {
  const storageStore = useExtensionsStorageStore();

  for (const extensionData of Object.values(storageStore.extensionsData.installedExtensions)) {
    const manifestBinary = (extensionData.manifest.binaries ?? []).find(
      binaryDefinition => binaryDefinition.id === binaryId,
    );

    if (manifestBinary?.name) {
      return manifestBinary.name;
    }
  }

  return binaryId;
}

export function showBinarySetupSavedToast(
  rows: Pick<BinarySetupRowState, 'name' | 'useManagedDownload'>[],
  extensionId?: string,
): void {
  const { t } = i18n.global;
  const toastId = extensionId
    ? `ext-binaries-saved-${extensionId}`
    : 'ext-binaries-saved-dependencies';
  const message = getBinarySetupSavedMessage(rows);
  const title = extensionId?.trim()
    ? getExtensionToastTitle(extensionId)
    : `${t('featureExtension')} | ${t('extensions.tabs.dependencies')}`;

  toast.custom(markRaw(ToastStatic), {
    id: toastId,
    duration: Infinity,
    componentProps: {
      data: {
        title,
        subtitle: t(message.key, message.params),
        extensionId,
        extensionIconPath: extensionId ? getExtensionToastIconPath(extensionId) : undefined,
      },
    },
  });

  setTimeout(() => {
    toast.dismiss(toastId);
  }, 3000);
}

export function showInvalidCustomBinaryToasts(invalidBinaries: InvalidCustomBinary[]): void {
  if (invalidBinaries.length === 0) {
    return;
  }

  const { t } = i18n.global;

  for (const invalidBinary of invalidBinaries) {
    const toastId = `invalid-custom-binary-${invalidBinary.binaryId}`;
    const binaryName = getBinaryDisplayName(invalidBinary.binaryId);
    const targetExtensionId = invalidBinary.affectedExtensionIds[0];

    toast.custom(markRaw(ToastStatic), {
      id: toastId,
      duration: Infinity,
      componentProps: {
        data: {
          title: t('featureExtension'),
          subtitle: t('extensions.binaries.invalidPathTitle', { name: binaryName }),
          description: t('extensions.binaries.invalidPathDescription'),
          actionText: t('extensions.binaries.fixBinaryPath'),
          onAction: () => {
            toast.dismiss(toastId);

            if (targetExtensionId) {
              void openExtensionsBinaryEdit(targetExtensionId);
            }
          },
          onDismiss: () => toast.dismiss(toastId),
        },
      },
    });
  }
}
