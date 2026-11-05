<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FolderIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const showDirectoriesOnTop = computed({
  get: () => userSettingsStore.userSettings.navigator.showDirectoriesOnTop,
  set: (value: boolean) => {
    userSettingsStore.set('navigator.showDirectoriesOnTop', value);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.showDirectoriesOnTop')"
    :description="t('settings.navigator.showDirectoriesOnTopDescription')"
    :icon="FolderIcon"
  >
    <Switch
      :model-value="showDirectoriesOnTop"
      @update:model-value="showDirectoriesOnTop = $event"
    />
  </SettingsItem>
</template>
