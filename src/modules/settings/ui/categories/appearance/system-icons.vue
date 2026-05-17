<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { BaseCombobox } from '@/components/base';
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

type IconThemeOptionGroup = {
  heading?: string;
  options: NavigatorIconThemeOption[];
};

const userSettingsStore = useUserSettingsStore();
const extensionsStore = useExtensionsStore();
const { t } = useI18n();

const builtinIconThemeOptions = computed<NavigatorIconThemeOption[]>(() => {
  return getBuiltinNavigatorIconThemeOptions(t);
});

const extensionIconThemeOptions = computed<NavigatorIconThemeOption[]>(() => {
  return getExtensionNavigatorIconThemeOptions(extensionsStore.enabledExtensions);
});

const themeOptions = computed<NavigatorIconThemeOption[]>(() => {
  return [
    ...builtinIconThemeOptions.value,
    ...extensionIconThemeOptions.value,
  ];
});

const iconThemeOptionGroups = computed<IconThemeOptionGroup[]>(() => {
  const groups: IconThemeOptionGroup[] = [
    {
      options: builtinIconThemeOptions.value,
    },
  ];

  if (extensionIconThemeOptions.value.length > 0) {
    groups.push({
      heading: t('settings.homeBannerEffects.theme.extensionThemes'),
      options: extensionIconThemeOptions.value,
    });
  }

  return groups;
});

function getIconThemeOption(iconThemeId: string): NavigatorIconThemeOption | null {
  const selectedId = normalizeNavigatorIconThemeId(iconThemeId);
  return themeOptions.value.find(option => option.id === selectedId)
    ?? themeOptions.value.find(option => option.id === BUILTIN_NAVIGATOR_ICON_THEME_IDS.default)
    ?? null;
}

const selectedFolderIconTheme = computed({
  get: () => {
    return getIconThemeOption(userSettingsStore.userSettings.navigator.folderIconTheme);
  },
  set: (option: NavigatorIconThemeOption | null) => {
    if (option) {
      userSettingsStore.set('navigator.folderIconTheme', option.id);
    }
  },
});

const selectedFileIconTheme = computed({
  get: () => {
    return getIconThemeOption(userSettingsStore.userSettings.navigator.fileIconTheme);
  },
  set: (option: NavigatorIconThemeOption | null) => {
    if (option) {
      userSettingsStore.set('navigator.fileIconTheme', option.id);
    }
  },
});
</script>

<template>
  <SettingsItem
    :title="t('settings.navigator.systemIcons')"
    :icon="ImageIcon"
  >
    <template #nested>
      <div class="system-icons-settings">
        <div class="system-icons-settings__row">
          <span class="system-icons-settings__label">{{ t('settings.navigator.systemIconsDirectories') }}</span>
          <BaseCombobox
            v-model="selectedFolderIconTheme"
            :options="themeOptions"
            :option-groups="iconThemeOptionGroups"
            by="id"
            display-key="label"
            :search-placeholder="t('search')"
            :empty-text="t('noData')"
          />
        </div>

        <div class="system-icons-settings__row">
          <span class="system-icons-settings__label">{{ t('settings.navigator.systemIconsFiles') }}</span>
          <BaseCombobox
            v-model="selectedFileIconTheme"
            :options="themeOptions"
            :option-groups="iconThemeOptionGroups"
            by="id"
            display-key="label"
            :search-placeholder="t('search')"
            :empty-text="t('noData')"
          />
        </div>
      </div>
    </template>
  </SettingsItem>
</template>

<style scoped>
.system-icons-settings {
  display: flex;
  width: 100%;
  flex-direction: column;
  gap: 4px;
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
