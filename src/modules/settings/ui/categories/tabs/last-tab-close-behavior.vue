<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
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
import type { LastTabCloseBehavior } from '@/types/user-settings';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { XCircleIcon } from 'lucide-vue-next';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const behaviorOptions: { name: string;
  value: LastTabCloseBehavior; }[] = [
  {
    name: t('settings.tabs.lastTabCloseBehavior.createDefaultTab'),
    value: 'createDefaultTab',
  },
  {
    name: t('settings.tabs.lastTabCloseBehavior.closeWindow'),
    value: 'closeWindow',
  },
  {
    name: t('settings.tabs.lastTabCloseBehavior.navigateToHomePage'),
    value: 'navigateToHomePage',
  },
];

const selectedBehavior = computed({
  get: () => {
    const value = userSettingsStore.userSettings.navigator?.lastTabCloseBehavior ?? 'createDefaultTab';
    return behaviorOptions.find(option => option.value === value) ?? behaviorOptions[0];
  },
  set: (option) => {
    if (option) {
      userSettingsStore.set('navigator.lastTabCloseBehavior', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.tabs.lastTabCloseBehavior.title')"
    :icon="XCircleIcon"
  >
    <Select
      v-model="selectedBehavior"
      by="value"
    >
      <SelectTrigger class="last-tab-close-behavior-select-trigger">
        <SelectValue>
          {{ selectedBehavior?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in behaviorOptions"
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
.last-tab-close-behavior-select-trigger {
  min-width: 180px;
}
</style>
