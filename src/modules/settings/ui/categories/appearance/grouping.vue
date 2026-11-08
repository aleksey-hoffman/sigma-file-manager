<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { LayersIcon } from '@lucide/vue';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { NAVIGATOR_GROUPING_OPTIONS } from '@/modules/navigator/utils/navigator-grouping-options';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const groupingOptions = computed(() => NAVIGATOR_GROUPING_OPTIONS.map(option => ({
  name: t(option.labelKey),
  value: option.value,
})));

const selectedGrouping = computed({
  get: () => {
    const value = userSettingsStore.userSettings.navigator.grouping;
    return groupingOptions.value.find(option => option.value === value) ?? groupingOptions.value[0];
  },
  set: (option) => {
    if (option) {
      return userSettingsStore.set('navigator.grouping', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.grouping')"
    :icon="LayersIcon"
  >
    <Select
      v-model="selectedGrouping"
      by="value"
    >
      <SelectTrigger class="navigator-grouping-select-trigger">
        <SelectValue>
          {{ selectedGrouping?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in groupingOptions"
          :key="option.value"
          :value="option"
        >
          <SelectItemText>
            {{ option.name }}
          </SelectItemText>
        </SelectItem>
      </SelectContent>
    </Select>
  </SettingsItem>
</template>

<style scoped>
.navigator-grouping-select-trigger {
  min-width: 140px;
}
</style>
