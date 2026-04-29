<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  Select,
  SelectContent,
  SelectItem,
  SelectItemText,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsItem } from '@/modules/settings';
import {
  getAvailableThemeOptions,
  normalizeThemeSelection,
} from '@/modules/themes/registry';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { SunMoonIcon } from '@lucide/vue';

const extensionsStorageStore = useExtensionsStorageStore();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const themeOptions = computed(() => {
  return getAvailableThemeOptions(extensionsStorageStore.extensionsData.installedExtensions).map((option) => {
    if (option.source === 'builtin') {
      return {
        name: option.builtinThemeId === 'dark'
          ? t('settings.homeBannerEffects.theme.themeTypeRadio.dark')
          : option.builtinThemeId === 'light'
            ? t('settings.homeBannerEffects.theme.themeTypeRadio.light')
            : t('system'),
        value: option.id,
      };
    }

    return {
      name: option.title,
      value: option.id,
    };
  });
});

const selectedThemeId = computed(() => {
  return normalizeThemeSelection(
    userSettingsStore.userSettings.theme,
    extensionsStorageStore.extensionsData.installedExtensions,
  );
});

const selectedTheme = computed({
  get: () => {
    return themeOptions.value.find(option => option.value === selectedThemeId.value)
      ?? themeOptions.value[0];
  },
  set: (option) => {
    if (option) {
      userSettingsStore.set('theme', option.value);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.homeBannerEffects.theme.title')"
    :icon="SunMoonIcon"
  >
    <Select
      v-model="selectedTheme"
      by="value"
    >
      <SelectTrigger class="theme-select-trigger">
        <SelectValue>
          {{ selectedTheme?.name }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem
          v-for="option in themeOptions"
          :key="option.value"
          :value="option"
        >
          <SelectItemText>
            {{ option.name }}
          </SelectItemText>
        </SelectItem>
      </SelectContent>
    </Select>
  </SettingsItem>
</template>

<style scoped>
.theme-select-trigger {
  min-width: 100px;
}
</style>
