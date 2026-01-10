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
import { EyeOffIcon } from 'lucide-vue-next';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const showHiddenFiles = computed(() => userSettingsStore.userSettings.navigator.showHiddenFiles);

function setShowHiddenFiles(checked: boolean) {
  userSettingsStore.set('navigator.showHiddenFiles', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('filter.showHiddenItems')"
    :icon="EyeOffIcon"
  >
    <Switch
      :model-value="showHiddenFiles"
      @update:model-value="setShowHiddenFiles"
    />
  </SettingsItem>
</template>
