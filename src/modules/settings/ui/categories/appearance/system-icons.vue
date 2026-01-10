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
import { ImageIcon } from 'lucide-vue-next';

const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const useSystemIconsForDirectories = computed(() => userSettingsStore.userSettings.navigator.useSystemIconsForDirectories);
const useSystemIconsForFiles = computed(() => userSettingsStore.userSettings.navigator.useSystemIconsForFiles);

function setUseSystemIconsForDirectories(checked: boolean) {
  userSettingsStore.set('navigator.useSystemIconsForDirectories', checked);
}

function setUseSystemIconsForFiles(checked: boolean) {
  userSettingsStore.set('navigator.useSystemIconsForFiles', checked);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.systemIcons')"
    :icon="ImageIcon"
  >
    <div class="system-icons-settings">
      <div class="system-icons-settings__row">
        <span class="system-icons-settings__label">
          {{ t('settings.navigator.systemIconsDirectories') }}
        </span>
        <Switch
          :model-value="useSystemIconsForDirectories"
          @update:model-value="setUseSystemIconsForDirectories"
        />
      </div>

      <div class="system-icons-settings__row">
        <span class="system-icons-settings__label">
          {{ t('settings.navigator.systemIconsFiles') }}
        </span>
        <Switch
          :model-value="useSystemIconsForFiles"
          @update:model-value="setUseSystemIconsForFiles"
        />
      </div>
    </div>
  </SettingsItem>
</template>

<style scoped>
.system-icons-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 1rem;
}

.system-icons-settings__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.system-icons-settings__label {
  flex-shrink: 0;
  color: hsl(var(--foreground));
  font-size: 0.875rem;
}
</style>
