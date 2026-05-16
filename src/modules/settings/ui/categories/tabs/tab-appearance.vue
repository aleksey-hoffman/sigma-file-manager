<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BoldIcon } from '@lucide/vue';
import { Switch } from '@/components/ui/switch';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const boldActiveTabTitle = computed({
  get: () => userSettingsStore.userSettings.navigator.boldActiveTabTitle,
  set: (value: boolean) => {
    userSettingsStore.set('navigator.boldActiveTabTitle', value);
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.tabs.tabAppearance.title')"
    :description="t('settings.tabs.tabAppearance.description')"
    :icon="BoldIcon"
  >
    <div class="tab-appearance-settings__row">
      <span class="tab-appearance-settings__label">
        {{ t('settings.tabs.tabAppearance.boldActiveTabTitle') }}
      </span>
      <Switch
        :model-value="boldActiveTabTitle"
        @update:model-value="boldActiveTabTitle = $event"
      />
    </div>
  </SettingsItem>
</template>

<style scoped>
.tab-appearance-settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.tab-appearance-settings__label {
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}
</style>
