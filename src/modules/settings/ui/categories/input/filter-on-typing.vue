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
import { TextSearchIcon } from 'lucide-vue-next';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const focusFilterOnTyping = computed(() => userSettingsStore.userSettings.navigator.focusFilterOnTyping);

function setFocusFilterOnTyping(checked: boolean) {
  userSettingsStore.set('navigator.focusFilterOnTyping', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.input.activateWhenTyping')"
    :icon="TextSearchIcon"
  >
    <Switch
      :model-value="focusFilterOnTyping"
      @update:model-value="setFocusFilterOnTyping"
    />
  </SettingsItem>
</template>
