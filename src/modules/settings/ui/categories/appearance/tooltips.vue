<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { MessageSquareTextIcon } from '@lucide/vue';
import { Slider } from '@/components/ui/slider';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

function clampTooltipDelayMs(raw: number): number {
  const bounded = Math.min(1000, Math.max(0, raw));
  return Math.round(bounded / 10) * 10;
}

const tooltipDelaySlider = computed({
  get: () => [clampTooltipDelayMs(userSettingsStore.userSettings.tooltipDelayMs)],
  set: (value: number[]) => {
    const next = clampTooltipDelayMs(value[0]);
    void userSettingsStore.set('tooltipDelayMs', next);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.tooltips.title')"
    :icon="MessageSquareTextIcon"
  >
    <template #nested>
      <div class="tooltips-settings">
        <div class="tooltips-settings__row">
          <span class="tooltips-settings__label">
            {{ t('settings.tooltips.delay', { n: tooltipDelaySlider[0] }) }}
          </span>
          <Slider
            v-model="tooltipDelaySlider"
            :min="0"
            :max="1000"
            :step="10"
            class="tooltips-settings__slider"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.tooltips-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.tooltips-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tooltips-settings__label {
  flex-shrink: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}

.tooltips-settings__slider {
  width: 200px;
}
</style>
