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
import type { Theme } from '@/types/user-settings';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const themeOptions: {
  name: string;
  value: Theme;
}[] = [
  {
    name: t('settings.homeBannerEffects.theme.themeTypeRadio.dark'),
    value: 'dark',
  },
  {
    name: t('settings.homeBannerEffects.theme.themeTypeRadio.light'),
    value: 'light',
  },
  {
    name: t('system'),
    value: 'system',
  },
];

const selectedTheme = computed({
  get: () => themeOptions.find(option => option.value === userSettingsStore.userSettings.theme),
  set: (option) => {
    if (option) {
      userSettingsStore.set('theme', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem :title="t('settings.homeBannerEffects.theme.title')">
    <Select
      v-model="selectedTheme"
      by="value"
    >
      <SelectTrigger class="theme-select-trigger">
        <SelectValue>
          {{ selectedTheme?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in themeOptions"
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
.theme-select-trigger {
  min-width: 100px;
}
</style>
