<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { BaseCombobox } from '@/components/base';
import { SettingsItem } from '@/modules/settings';
import {
  getAvailableThemeOptions,
  normalizeThemeSelection,
} from '@/modules/themes/registry';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import type { Theme } from '@/types/user-settings';
import { useI18n } from 'vue-i18n';
import { computed } from 'vue';
import { SunMoonIcon } from '@lucide/vue';
import type { ComboboxHighlightPayload } from '@/components/base/combobox-utils';

type ThemeSelectOption = {
  name: string;
  value: Theme;
  source: 'builtin' | 'extension';
};

type ThemeSelectOptionGroup = {
  heading?: string;
  options: ThemeSelectOption[];
};

const extensionsStorageStore = useExtensionsStorageStore();
const userSettingsStore = useUserSettingsStore();
const { t } = useI18n();

const availableThemeOptions = computed(() => {
  return getAvailableThemeOptions(extensionsStorageStore.extensionsData.installedExtensions);
});

const builtinThemeOptions = computed<ThemeSelectOption[]>(() => {
  return availableThemeOptions.value.flatMap((option) => {
    if (option.source === 'builtin') {
      return [{
        name: option.builtinThemeId === 'dark'
          ? t('settings.homeBannerEffects.theme.themeTypeRadio.dark')
          : option.builtinThemeId === 'light'
            ? t('settings.homeBannerEffects.theme.themeTypeRadio.light')
            : t('system'),
        value: option.id,
        source: option.source,
      }];
    }

    return [];
  });
});

const extensionThemeOptions = computed<ThemeSelectOption[]>(() => {
  return availableThemeOptions.value.flatMap((option) => {
    if (option.source === 'builtin') {
      return [];
    }

    return [{
      name: option.title,
      value: option.id,
      source: option.source,
    }];
  });
});

const themeOptions = computed<ThemeSelectOption[]>(() => [
  ...builtinThemeOptions.value,
  ...extensionThemeOptions.value,
]);

const themeOptionGroups = computed<ThemeSelectOptionGroup[]>(() => {
  const groups: ThemeSelectOptionGroup[] = [
    {
      options: builtinThemeOptions.value,
    },
  ];

  if (extensionThemeOptions.value.length > 0) {
    groups.push({
      heading: t('settings.homeBannerEffects.theme.extensionThemes'),
      options: extensionThemeOptions.value,
    });
  }

  return groups;
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

function setThemeTransitionOrigin(element: HTMLElement) {
  const { left, top, width, height } = element.getBoundingClientRect();

  userSettingsStore.setThemeTransitionOrigin({
    x: left + width / 2,
    y: top + height / 2,
  });
}

function onThemeComboboxKeyboardHighlight(payload: ComboboxHighlightPayload) {
  if (payload?.ref) {
    setThemeTransitionOrigin(payload.ref);
  }
}

function onThemeComboboxSelect(payload: { ref: HTMLElement }) {
  setThemeTransitionOrigin(payload.ref);
}
</script>

<template>
  <SettingsItem
    :title="t('settings.homeBannerEffects.theme.title')"
    :icon="SunMoonIcon"
  >
    <BaseCombobox
      v-model="selectedTheme"
      :options="themeOptions"
      :option-groups="themeOptionGroups"
      by="value"
      :search-placeholder="t('search')"
      :empty-text="t('noData')"
      :select-on-highlight="true"
      :close-on-select="false"
      @keyboard-highlight="onThemeComboboxKeyboardHighlight"
      @select="onThemeComboboxSelect"
    />
  </SettingsItem>
</template>
