// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from 'vue';
import { determineFileType } from '@/stores/runtime/quick-view';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  DEFAULT_AUTO_PREVIEW_MAX_SIZE_MB,
  resolveInfoPanelPreviewBlockReason,
} from '@/modules/navigator/components/info-panel/utils/info-panel-preview-gate';
import { shouldUseImageThumbnail } from '@/modules/navigator/utils/resolve-image-display-src';
import type { DirEntry } from '@/types/dir-entry';
import type { InfoPanelPreviewFileType } from '@/types/user-settings';

export const INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS = 350;

export function useInfoPanelPreviewGate(selectedEntry: MaybeRefOrGetter<DirEntry | null>) {
  const userSettingsStore = useUserSettingsStore();
  const manuallyLoadedPath = ref<string | null>(null);
  const settledPath = ref<string | null>(null);
  let settleTimeout: ReturnType<typeof setTimeout> | null = null;

  const previewFileType = computed((): InfoPanelPreviewFileType | null => {
    const entry = toValue(selectedEntry);

    if (!entry?.path || entry.is_dir) {
      return null;
    }

    const fileType = determineFileType(entry.path);

    return fileType === 'unsupported' ? null : fileType;
  });

  const autoPreviewMaxSizeMb = computed(() => {
    const value = userSettingsStore.userSettings.navigator.infoPanel.autoPreviewMaxSizeMb;

    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      return DEFAULT_AUTO_PREVIEW_MAX_SIZE_MB;
    }

    return value;
  });

  const autoBlockReason = computed(() => {
    const entry = toValue(selectedEntry);
    const fileType = previewFileType.value;

    if (!entry || !fileType) {
      return null;
    }

    return resolveInfoPanelPreviewBlockReason({
      fileType,
      fileSizeBytes: entry.size,
      autoPreviewFileTypes: userSettingsStore.userSettings.navigator.infoPanel.autoPreviewFileTypes,
      autoPreviewMaxSizeMb: autoPreviewMaxSizeMb.value,
      imageUsesOriginalFile: !shouldUseImageThumbnail(
        entry,
        userSettingsStore.userSettings.navigator.infoPanel.showFullSizeImagePreview,
      ),
    });
  });

  const isManuallyLoaded = computed(() => {
    const path = toValue(selectedEntry)?.path;

    return Boolean(path) && manuallyLoadedPath.value === path;
  });

  const previewBlockReason = computed(() => (isManuallyLoaded.value ? null : autoBlockReason.value));

  const isPreviewReady = computed(() => {
    if (!previewFileType.value || previewBlockReason.value) {
      return false;
    }

    if (previewFileType.value !== 'pdf' || isManuallyLoaded.value) {
      return true;
    }

    return settledPath.value === toValue(selectedEntry)?.path;
  });

  function clearSettleTimeout() {
    if (settleTimeout !== null) {
      clearTimeout(settleTimeout);
      settleTimeout = null;
    }
  }

  function loadPreview() {
    manuallyLoadedPath.value = toValue(selectedEntry)?.path ?? null;
  }

  watch(
    () => toValue(selectedEntry)?.path,
    (path) => {
      clearSettleTimeout();
      settledPath.value = null;

      if (manuallyLoadedPath.value !== path) {
        manuallyLoadedPath.value = null;
      }

      if (!path || previewFileType.value !== 'pdf') {
        return;
      }

      settleTimeout = setTimeout(() => {
        settleTimeout = null;
        settledPath.value = path;
      }, INFO_PANEL_PDF_PREVIEW_SETTLE_DELAY_MS);
    },
    { immediate: true },
  );

  onBeforeUnmount(clearSettleTimeout);

  return {
    previewFileType,
    previewBlockReason,
    isPreviewReady,
    loadPreview,
  };
}
