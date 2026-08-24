<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { AppWindowIcon } from '@lucide/vue';
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
import type { StartupPage } from '@/types/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const pageOptions: {
  name: string;
  value: StartupPage;
}[] = [
  {
    name: t('settings.general.startupPage.last'),
    value: 'last',
  },
  {
    name: t('pages.home'),
    value: 'home',
  },
  {
    name: t('pages.dashboard'),
    value: 'dashboard',
  },
  {
    name: t('pages.navigator'),
    value: 'navigator',
  },
];

const selectedPage = computed({
  get: () => {
    const value = userSettingsStore.userSettings.startupPage ?? 'home';
    return pageOptions.find(option => option.value === value) ?? pageOptions[0];
  },
  set: (option) => {
    if (option) {
      userSettingsStore.set('startupPage', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.general.startupPage.title')"
    :description="t('settings.general.startupPage.description')"
    :icon="AppWindowIcon"
  >
    <Select
      v-model="selectedPage"
      by="value"
    >
      <SelectTrigger class="startup-page-select-trigger">
        <SelectValue>
          {{ selectedPage?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="option in pageOptions"
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
.startup-page-select-trigger {
  min-width: 220px;
}
</style>
