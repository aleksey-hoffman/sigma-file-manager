<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { FocusIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const preventDropdownCloseFocusReturn = computed({
  get: () => userSettingsStore.userSettings.preventDropdownCloseFocusReturn,
  set: (value: boolean) => {
    userSettingsStore.set('preventDropdownCloseFocusReturn', value);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.uiElements.preventDropdownCloseFocusReturn')"
    :description="t('settings.uiElements.preventDropdownCloseFocusReturnDescription')"
    :icon="FocusIcon"
  >
    <Switch
      :model-value="preventDropdownCloseFocusReturn"
      @update:model-value="preventDropdownCloseFocusReturn = $event"
    />
  </SettingsItem>
</template>
