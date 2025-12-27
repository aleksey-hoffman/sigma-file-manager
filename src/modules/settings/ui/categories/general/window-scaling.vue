<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { Button } from '@/components/ui/button';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { ref, onMounted } from 'vue';
import { getCurrentWebview } from '@tauri-apps/api/webview';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useI18n } from 'vue-i18n';
import { FullscreenIcon, MinusIcon, PlusIcon } from 'lucide-vue-next';

const webview = getCurrentWebview();
const currentWindow = getCurrentWindow();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const currentZoomFactor = ref(1.0);
const isFullscreen = ref(false);

onMounted(async () => {
  const savedZoom = userSettingsStore.userSettings.UIZoomLevel || 1.0;
  currentZoomFactor.value = savedZoom;
  webview.setZoom(savedZoom);

  isFullscreen.value = await currentWindow.isFullscreen();
});

async function increaseZoom() {
  if (currentZoomFactor.value < 1.5) {
    const newZoomFactor = Number((currentZoomFactor.value + 0.1).toFixed(1));
    currentZoomFactor.value = newZoomFactor;
    await webview.setZoom(newZoomFactor);
    await userSettingsStore.set('UIZoomLevel', newZoomFactor);
  }
}

async function decreaseZoom() {
  if (currentZoomFactor.value > 0.6) {
    const newZoomFactor = Number((currentZoomFactor.value - 0.1).toFixed(1));
    currentZoomFactor.value = newZoomFactor;
    await webview.setZoom(newZoomFactor);
    await userSettingsStore.set('UIZoomLevel', newZoomFactor);
  }
}

async function resetZoom() {
  currentZoomFactor.value = 1.0;
  await webview.setZoom(1.0);
  await userSettingsStore.set('UIZoomLevel', 1.0);
}

async function toggleFullscreen() {
  const newFullscreenState = !isFullscreen.value;
  await currentWindow.setFullscreen(newFullscreenState);
  isFullscreen.value = newFullscreenState;
}
</script>

<template>
  <SettingsItem
    :title="t('settings.general.windowScaling')"
    :description="`${t('settings.general.currentUiZoomLevel')} ${(currentZoomFactor * 100).toFixed(0) }%`"
    :icon="FullscreenIcon"
  >
    <div class="scaling-section">
      <div class="zoom-controls">
        <Button
          variant="outline"
          size="icon"
          @click="decreaseZoom"
          :disabled="currentZoomFactor <= 0.6"
          class="zoom-btn"
        >
          <MinusIcon :size="16" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          @click="increaseZoom"
          :disabled="currentZoomFactor >= 1.5"
          class="zoom-btn"
        >
          <PlusIcon :size="16" />
        </Button>
        <Button
          variant="outline"
          @click="resetZoom"
          class="zoom-reset"
        >
          {{ t('reset') }}
        </Button>
        <Tooltip>
          <TooltipTrigger>
            <Button
              variant="outline"
              size="icon"
              @click="toggleFullscreen"
              class="zoom-btn"
            >
              <FullscreenIcon :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{{ t('fullScreen') }}</p>
          </TooltipContent>
        </Tooltip>
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.scaling-section {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius);
  gap: 1rem;
}

.zoom-info {
  display: flex;
  align-items: center;
}

.zoom-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.zoom-btn {
  width: 2.5rem;
  height: 2.5rem;
  font-size: 1.25rem;
  font-weight: 600;
}

.zoom-reset {
  padding: 0 1rem;
  color: hsl(var(--foreground));
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.05em;
}
</style>
