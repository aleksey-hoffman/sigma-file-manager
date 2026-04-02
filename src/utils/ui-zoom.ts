// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { markRaw } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { toast, ToastStatic } from '@/components/ui/toaster';
import { i18n } from '@/localization';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

export const UI_ZOOM_DEFAULT = 1.0;
export const UI_ZOOM_MIN = 0.6;
export const UI_ZOOM_MAX = 1.5;
const UI_ZOOM_STEP = 0.1;

const UI_ZOOM_TOAST_ID = 'ui-zoom-level';

function showCurrentUiZoomToast(zoomLevel: number): void {
  const translatedLabel = String(i18n.global.t('settings.general.currentUiZoomLevel'));
  const title = translatedLabel.replace(/[\s\u00A0]*[:：]\s*$/u, '').trim();
  const percentLabel = `${(zoomLevel * 100).toFixed(0)}%`;
  toast.custom(markRaw(ToastStatic), {
    id: UI_ZOOM_TOAST_ID,
    componentProps: {
      data: {
        title,
        description: percentLabel,
      },
    },
    duration: 2000,
  });
}

export async function applyUiZoomStep(stepDirection: 1 | -1): Promise<void> {
  const userSettingsStore = useUserSettingsStore();
  const webview = getCurrentWebview();
  let currentLevel = userSettingsStore.userSettings.UIZoomLevel ?? UI_ZOOM_DEFAULT;
  currentLevel = Number(Number(currentLevel).toFixed(1));
  const nextLevel = Number((currentLevel + UI_ZOOM_STEP * stepDirection).toFixed(1));

  if (stepDirection > 0 && nextLevel > UI_ZOOM_MAX) return;
  if (stepDirection < 0 && nextLevel < UI_ZOOM_MIN) return;

  await webview.setZoom(nextLevel);
  await userSettingsStore.set('UIZoomLevel', nextLevel);
  showCurrentUiZoomToast(nextLevel);
}

export async function resetUiZoom(): Promise<void> {
  const userSettingsStore = useUserSettingsStore();
  const webview = getCurrentWebview();
  await webview.setZoom(UI_ZOOM_DEFAULT);
  await userSettingsStore.set('UIZoomLevel', UI_ZOOM_DEFAULT);
}
