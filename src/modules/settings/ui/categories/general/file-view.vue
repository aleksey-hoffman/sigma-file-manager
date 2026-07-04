<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MousePointerSquareDashedIcon } from '@lucide/vue';
import { Slider } from '@/components/ui/slider';
import { SettingsItem } from '@/modules/settings';
import { Switch } from '@/components/ui/switch';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const { t } = useI18n();
const userSettingsStore = useUserSettingsStore();

function clampDoubleClickDelayMs(raw: number): number {
  const bounded = Math.min(1000, Math.max(200, raw));
  return Math.round(bounded / 50) * 50;
}

const enableBoxSelection = computed(
  () => userSettingsStore.userSettings.navigator.enableBoxSelection,
);
const enableDragAndDrop = computed(
  () => userSettingsStore.userSettings.navigator.enableDragAndDrop,
);
const increaseFileViewGaps = computed(
  () => userSettingsStore.userSettings.navigator.increaseFileViewGaps,
);
const doubleClickDelaySlider = computed({
  get: () => [clampDoubleClickDelayMs(userSettingsStore.userSettings.navigator.doubleClickDelayMs)],
  set: (value: number[]) => {
    const next = clampDoubleClickDelayMs(value[0]);
    void userSettingsStore.set('navigator.doubleClickDelayMs', next);
  },
});

async function onEnableDragAndDropChange(enabled: boolean) {
  await userSettingsStore.set('navigator.enableDragAndDrop', enabled);
}

async function onEnableBoxSelectionChange(enabled: boolean) {
  await userSettingsStore.set('navigator.enableBoxSelection', enabled);
}

async function onIncreaseFileViewGapsChange(enabled: boolean) {
  await userSettingsStore.set('navigator.increaseFileViewGaps', enabled);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.general.fileView.title')"
    :icon="MousePointerSquareDashedIcon"
  >
    <template #nested>
      <div class="file-view-settings">
        <div class="file-view-settings__row">
          <div class="file-view-settings__copy">
            <span class="file-view-settings__label">
              {{ t('settings.general.fileView.doubleClickDelay', { n: doubleClickDelaySlider[0] }) }}
            </span>
            <p class="file-view-settings__description">
              {{ t('settings.general.fileView.doubleClickDelayDescription') }}
            </p>
          </div>
          <Slider
            v-model="doubleClickDelaySlider"
            :min="200"
            :max="1000"
            :step="50"
            class="file-view-settings__slider"
          />
        </div>

        <div class="file-view-settings__row">
          <div class="file-view-settings__copy">
            <span class="file-view-settings__label">
              {{ t('settings.general.fileView.enableDragAndDrop') }}
            </span>
            <p class="file-view-settings__description">
              {{ t('settings.general.fileView.enableDragAndDropDescription') }}
            </p>
          </div>
          <Switch
            :model-value="enableDragAndDrop"
            @update:model-value="onEnableDragAndDropChange"
          />
        </div>

        <div class="file-view-settings__row">
          <div class="file-view-settings__copy">
            <span class="file-view-settings__label">
              {{ t('settings.general.fileView.enableBoxSelection') }}
            </span>
            <p class="file-view-settings__description">
              {{ t('settings.general.fileView.enableBoxSelectionDescription') }}
            </p>
          </div>
          <Switch
            :model-value="enableBoxSelection"
            @update:model-value="onEnableBoxSelectionChange"
          />
        </div>

        <div class="file-view-settings__row">
          <div class="file-view-settings__copy">
            <span class="file-view-settings__label">
              {{ t('settings.general.fileView.increaseFileViewGaps') }}
            </span>
            <p class="file-view-settings__description">
              {{ t('settings.general.fileView.increaseFileViewGapsDescription') }}
            </p>
          </div>
          <Switch
            :model-value="increaseFileViewGaps"
            @update:model-value="onIncreaseFileViewGapsChange"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.file-view-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.file-view-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem 2rem;
}

.file-view-settings__copy {
  display: flex;
  min-width: min(100%, 16rem);
  flex: 1 1 12rem;
  flex-direction: column;
}

.file-view-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.file-view-settings__slider {
  width: 200px;
}

.file-view-settings__description {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  line-height: 1.4;
}
</style>
