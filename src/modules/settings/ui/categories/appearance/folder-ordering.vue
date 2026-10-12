<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { FolderTreeIcon } from '@lucide/vue';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const foldersFirst = computed(() => userSettingsStore.userSettings.navigator.foldersFirst);

function setFoldersFirst(checked: boolean) {
  userSettingsStore.set('navigator.foldersFirst', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.foldersFirst')"
    :description="t('settings.navigator.foldersFirstDescription')"
    :icon="FolderTreeIcon"
  >
    <Switch
      :model-value="foldersFirst"
      @update:model-value="setFoldersFirst"
    />
  </SettingsItem>
</template>
