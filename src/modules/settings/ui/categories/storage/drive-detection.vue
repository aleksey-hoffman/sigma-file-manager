<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { UsbIcon } from 'lucide-vue-next';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const focusWindowOnDriveConnected = computed(
  () => userSettingsStore.userSettings.focusWindowOnDriveConnected,
);

function setFocusWindowOnDriveConnected(checked: boolean) {
  userSettingsStore.set('focusWindowOnDriveConnected', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.drives.focusAppWhenDriveConnected')"
    :icon="UsbIcon"
  >
    <Switch
      :model-value="focusWindowOnDriveConnected"
      @update:model-value="setFocusWindowOnDriveConnected"
    />
  </SettingsItem>
</template>
