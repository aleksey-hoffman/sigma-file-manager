<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import { SlidersHorizontalIcon, RotateCcwIcon } from '@lucide/vue';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const brightnessValue = computed({
  get: () => [userSettingsStore.userSettings.visualFilters.brightness],
  set: (value: number[]) => {
    userSettingsStore.userSettings.visualFilters.brightness = value[0];
    userSettingsStore.setUserSettingsStorage('visualFilters.brightness', value[0]);
  },
});

const contrastValue = computed({
  get: () => [userSettingsStore.userSettings.visualFilters.contrast],
  set: (value: number[]) => {
    userSettingsStore.userSettings.visualFilters.contrast = value[0];
    userSettingsStore.setUserSettingsStorage('visualFilters.contrast', value[0]);
  },
});

const dialogOverlayBlurValue = computed({
  get: () => [userSettingsStore.userSettings.visualFilters.dialogOverlayBlur],
  set: (value: number[]) => {
    userSettingsStore.userSettings.visualFilters.dialogOverlayBlur = value[0];
    userSettingsStore.setUserSettingsStorage('visualFilters.dialogOverlayBlur', value[0]);
  },
});

async function resetVisualFiltersSection() {
  const defaultsSnapshot = userSettingsStore.userSettingsDefault;

  if (!defaultsSnapshot) {
    return;
  }

  userSettingsStore.userSettings.visualFilters = {
    ...defaultsSnapshot.visualFilters,
  };

  await userSettingsStore.setUserSettingsStorage(
    'visualFilters.brightness',
    defaultsSnapshot.visualFilters.brightness,
  );
  await userSettingsStore.setUserSettingsStorage(
    'visualFilters.contrast',
    defaultsSnapshot.visualFilters.contrast,
  );
  await userSettingsStore.setUserSettingsStorage(
    'visualFilters.dialogOverlayBlur',
    defaultsSnapshot.visualFilters.dialogOverlayBlur,
  );
}
</script>

<template>
  <SettingsItem
    :title="t('settings.visualFilters.title')"
    :icon="SlidersHorizontalIcon"
  >
    <div class="visual-filters-settings__header-controls">
      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            variant="outline"
            size="icon"
            :disabled="!userSettingsStore.userSettingsDefault"
            @click="resetVisualFiltersSection"
          >
            <RotateCcwIcon class="visual-filters-settings__header-action-icon" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('settings.visualEffects.resetToDefaults') }}
        </TooltipContent>
      </Tooltip>
    </div>

    <template #nested>
      <div class="visual-filters-settings">
        <div class="visual-filters-settings__row">
          <span class="visual-filters-settings__label">
            {{ t('settings.visualFilters.brightness', { n: brightnessValue[0] }) }}
          </span>
          <Slider
            v-model="brightnessValue"
            :min="80"
            :max="200"
            :step="1"
            class="visual-filters-settings__slider"
          />
        </div>

        <div class="visual-filters-settings__row">
          <span class="visual-filters-settings__label">
            {{ t('settings.visualFilters.contrast', { n: contrastValue[0] }) }}
          </span>
          <Slider
            v-model="contrastValue"
            :min="80"
            :max="200"
            :step="1"
            class="visual-filters-settings__slider"
          />
        </div>

        <div class="visual-filters-settings__row">
          <span class="visual-filters-settings__label">
            {{ t('settings.visualFilters.dialogOverlayBlur', { n: dialogOverlayBlurValue[0] }) }}
          </span>
          <Slider
            v-model="dialogOverlayBlurValue"
            :min="0"
            :max="32"
            :step="1"
            class="visual-filters-settings__slider"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.visual-filters-settings__header-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 1rem;
}

.visual-filters-settings__header-action-icon {
  width: 1rem;
  height: 1rem;
}

.visual-filters-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.visual-filters-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.visual-filters-settings__label {
  flex-shrink: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.visual-filters-settings__slider {
  width: 200px;
}
</style>
