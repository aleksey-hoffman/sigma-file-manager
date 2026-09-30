<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { AppWindowIcon } from '@lucide/vue';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
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
  {
    name: t('settings.general.startupPage.customPath'),
    value: 'customPath',
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

const customPathInput = ref(userSettingsStore.userSettings.customStartupPath ?? '');

// Keep local input in sync with store (handles external resets, etc.)
watch(
  () => userSettingsStore.userSettings.customStartupPath,
  (next) => {
    if ((next ?? '') !== customPathInput.value) {
      customPathInput.value = next ?? '';
    }
  },
);

async function onCustomPathInputChange(value: string | number | undefined) {
  const next = typeof value === 'string' ? value : String(value ?? '');
  customPathInput.value = next;
  await userSettingsStore.set('customStartupPath', next);
}

async function onBrowseCustomPath() {
  const picked = await openDialog({
    directory: true,
    multiple: false,
    title: t('settings.general.startupPage.browseTitle'),
    defaultPath: customPathInput.value || undefined,
  });

  if (typeof picked === 'string' && picked) {
    await onCustomPathInputChange(picked);
  }
}
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

    <div
      v-if="selectedPage?.value === 'customPath'"
      class="startup-page-custom-path"
    >
      <Input
        :model-value="customPathInput"
        :placeholder="t('settings.general.startupPage.customPathPlaceholder')"
        @update:model-value="onCustomPathInputChange"
      />
      <Button
        variant="secondary"
        @click="onBrowseCustomPath"
      >
        {{ t('settings.general.startupPage.browse') }}
      </Button>
    </div>
  </SettingsItem>
</template>

<style scoped>
.startup-page-select-trigger {
  min-width: 220px;
}

.startup-page-custom-path {
  display: flex;
  align-items: center;
  margin-top: 0.75rem;
  gap: 0.5rem;
}
</style>
