<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsItem } from '@/modules/settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { ImageIcon } from '@lucide/vue';
import {
  BUILTIN_NAVIGATOR_ICON_THEME_IDS,
  normalizeNavigatorIconThemeId,
  type NavigatorIconThemeOption,
} from '@/types/icon-theme';
import {
  getBuiltinNavigatorIconThemeOptions,
  getExtensionNavigatorIconThemeOptions,
} from '@/modules/icon-theme/extension-icon-themes';

const userSettingsStore = useUserSettingsStore();
const extensionsStore = useExtensionsStore();
const { t } = useI18n();

const themeOptions = computed<NavigatorIconThemeOption[]>(() => {
  return [
    ...getBuiltinNavigatorIconThemeOptions(t),
    ...getExtensionNavigatorIconThemeOptions(extensionsStore.enabledExtensions),
  ];
});

const selectedIconTheme = computed({
  get: () => {
    const selectedId = normalizeNavigatorIconThemeId(userSettingsStore.userSettings.navigator.iconTheme);
    return themeOptions.value.find(option => option.id === selectedId)
      ?? themeOptions.value.find(option => option.id === BUILTIN_NAVIGATOR_ICON_THEME_IDS.default)
      ?? null;
  },
  set: (option: NavigatorIconThemeOption | null) => {
    if (option) {
      userSettingsStore.set('navigator.iconTheme', option.id);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.systemIcons')"
    :icon="ImageIcon"
  >
    <Select
      v-model="selectedIconTheme"
      by="id"
    >
      <SelectTrigger class="system-icons-select-trigger">
        <SelectValue>
          {{ selectedIconTheme?.label }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem
          v-for="option in themeOptions"
          :key="option.id"
          :value="option"
        >
          <SelectItemText>
            {{ option.label }}
          </SelectItemText>
        </SelectItem>
      </SelectContent>
    </Select>
  </SettingsItem>
</template>

<style scoped>
.system-icons-select-trigger {
  min-width: 160px;
}
</style>
