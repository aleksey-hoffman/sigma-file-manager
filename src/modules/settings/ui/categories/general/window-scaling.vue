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
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ContextMenuShortcut } from '@/components/ui/context-menu';
import { useShortcutsStore } from '@/stores/runtime/shortcuts';
import { useI18n } from 'vue-i18n';
import { FullscreenIcon, MinusIcon, PlusIcon } from 'lucide-vue-next';
import {
  applyUiZoomStep,
  resetUiZoom,
  UI_ZOOM_DEFAULT,
  UI_ZOOM_MAX,
  UI_ZOOM_MIN,
} from '@/utils/ui-zoom';
import { toggleMainWindowFullscreen } from '@/utils/window-fullscreen';

const webview = getCurrentWebview();
const userSettingsStore = useUserSettingsStore();
const shortcutsStore = useShortcutsStore();
const { t } = useI18n();

const currentZoomFactor = ref(UI_ZOOM_DEFAULT);

onMounted(async () => {
  const savedZoom = userSettingsStore.userSettings.UIZoomLevel ?? UI_ZOOM_DEFAULT;
  currentZoomFactor.value = savedZoom;
  webview.setZoom(savedZoom);
});

async function increaseZoom() {
  await applyUiZoomStep(1);
  currentZoomFactor.value = userSettingsStore.userSettings.UIZoomLevel ?? UI_ZOOM_DEFAULT;
}

async function decreaseZoom() {
  await applyUiZoomStep(-1);
  currentZoomFactor.value = userSettingsStore.userSettings.UIZoomLevel ?? UI_ZOOM_DEFAULT;
}

async function resetZoom() {
  await resetUiZoom();
  currentZoomFactor.value = UI_ZOOM_DEFAULT;
}

async function toggleFullscreen() {
  await toggleMainWindowFullscreen();
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
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              @click="decreaseZoom"
              :disabled="currentZoomFactor <= UI_ZOOM_MIN"
              class="zoom-btn"
            >
              <MinusIcon :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div class="window-scaling__tooltip-row">
              <span>{{ t('settings.general.decreaseZoomLevel') }}</span>
              <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('uiZoomDecrease') }}</ContextMenuShortcut>
            </div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              size="icon"
              @click="increaseZoom"
              :disabled="currentZoomFactor >= UI_ZOOM_MAX"
              class="zoom-btn"
            >
              <PlusIcon :size="16" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <div class="window-scaling__tooltip-row">
              <span>{{ t('settings.general.increaseZoomLevel') }}</span>
              <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('uiZoomIncrease') }}</ContextMenuShortcut>
            </div>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="outline"
              @click="resetZoom"
              class="zoom-reset"
            >
              {{ t('reset') }}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            {{ t('settings.general.resetZoomLevel') }}
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger as-child>
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
            <div class="window-scaling__tooltip-row">
              <span>{{ t('fullScreen') }}</span>
              <ContextMenuShortcut>{{ shortcutsStore.getShortcutLabel('toggleFullscreen') }}</ContextMenuShortcut>
            </div>
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

.window-scaling__tooltip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
