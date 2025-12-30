<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { GaugeIcon } from 'lucide-vue-next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { DriveSpaceIndicatorStyle } from '@/types/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const styleOptions = computed(() => [
  {
    name: t('settings.uiElements.linearVertical'),
    value: 'linearVertical' as DriveSpaceIndicatorStyle,
  },
  {
    name: t('settings.uiElements.linearHorizontal'),
    value: 'linearHorizontal' as DriveSpaceIndicatorStyle,
  },
  {
    name: t('settings.uiElements.linearHorizontalCentered'),
    value: 'linearHorizontalCentered' as DriveSpaceIndicatorStyle,
  },
  {
    name: t('settings.uiElements.circular'),
    value: 'circular' as DriveSpaceIndicatorStyle,
  },
]);

const showIndicator = computed({
  get: () => userSettingsStore.userSettings.driveCard.showSpaceIndicator,
  set: (value: boolean) => {
    userSettingsStore.set('driveCard.showSpaceIndicator', value);
  },
});

const selectedStyle = computed({
  get: () => styleOptions.value.find(
    option => option.value === userSettingsStore.userSettings.driveCard.spaceIndicatorStyle,
  ),
  set: (option) => {
    if (option) {
      userSettingsStore.set('driveCard.spaceIndicatorStyle', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.uiElements.showDriveSpaceIndicator')"
    :icon="GaugeIcon"
  >
    <Switch
      :model-value="showIndicator"
      @update:model-value="showIndicator = $event"
    />

    <template
      v-if="showIndicator"
      #nested
    >
      <div class="nested-label">
        {{ t('settings.uiElements.driveSpaceIndicatorStyle') }}
      </div>
      <Select
        v-model="selectedStyle"
        by="value"
      >
        <SelectTrigger class="style-select-trigger">
          <SelectValue>
            {{ selectedStyle?.name }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in styleOptions"
            :key="option.value"
            :value="option"
          >
            <SelectItemText>
              {{ option.name }}
            </SelectItemText>
          </SelectItem>
        </SelectContent>
      </Select>
    </template>
  </SettingsItem>
</template>

<style scoped>
.nested-label {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
}

.style-select-trigger {
  width: 260px;
}
</style>
