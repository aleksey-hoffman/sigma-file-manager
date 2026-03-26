<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PanelLeftIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const quickAccessOnHover = computed({
  get: () => userSettingsStore.userSettings.quickAccessOnHover,
  set: (value: boolean) => {
    userSettingsStore.set('quickAccessOnHover', value);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.uiElements.quickAccessOnHover')"
    :description="t('settings.uiElements.quickAccessOnHoverDescription')"
    :icon="PanelLeftIcon"
  >
    <Switch
      :model-value="quickAccessOnHover"
      @update:model-value="quickAccessOnHover = $event"
    />
  </SettingsItem>
</template>
