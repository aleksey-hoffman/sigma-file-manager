// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useI18n } from 'vue-i18n';

export interface SettingsSection {
  key: string;
  titleKey: string;
  tags: string;
  component: string;
  category: string;
}

export const useSettingsStore = defineStore('settings', () => {
  const { t } = useI18n();

  const currentTab = ref<string>('general');
  const search = ref<string>('');

  const tabs = computed(() => [
    {
      name: 'general',
      label: t('settingsTabs.general'),
    },
    {
      name: 'appearance',
      label: t('settingsTabs.uiAppearance'),
    },
    {
      name: 'shortcuts',
      label: t('settingsTabs.shortcuts'),
    },
    {
      name: 'tabs',
      label: t('settingsTabs.tabsWorkspaces'),
    },
    {
      name: 'navigation',
      label: t('settingsTabs.navigation'),
    },
    {
      name: 'input',
      label: t('settingsTabs.input'),
    },
    {
      name: 'search',
      label: t('settingsTabs.search'),
    },
    {
      name: 'storage',
      label: t('settingsTabs.dataStorage'),
    },
    {
      name: 'stats',
      label: t('settingsTabs.stats'),
    },
    {
      name: 'advanced',
      label: t('settingsTabs.advanced'),
    },
  ]);

  const allSettingsSections: SettingsSection[] = [
    {
      key: 'language',
      titleKey: 'language.language',
      tags: 'settingsTags.language',
      component: 'LanguageSelector',
      category: 'general',
    },
    {
      key: 'uiScaling',
      titleKey: 'settings.appearance.windowScaling.windowScaling',
      tags: 'settingsTags.uiScaling',
      component: 'UIScaling',
      category: 'general',
    },
    {
      key: 'updates',
      titleKey: 'appUpdates',
      tags: 'settingsTags.updates',
      component: 'AppUpdates',
      category: 'general',
    },
    {
      key: 'theme',
      titleKey: 'settings.appearance.theme.theme',
      tags: 'settingsTags.theme',
      component: 'ThemeSelector',
      category: 'appearance',
    },
    {
      key: 'windowControls',
      titleKey: 'settings.general.windowControls',
      tags: 'settingsTags.windowControls',
      component: 'WindowControls',
      category: 'general',
    },
    {
      key: 'visualEffects',
      titleKey: 'settings.appearance.visualEffects.visualEffects',
      tags: 'settingsTags.visualEffects',
      component: 'VisualEffects',
      category: 'appearance',
    },
    {
      key: 'animations',
      titleKey: 'settings.appearance.animations.animations',
      tags: 'settingsTags.animations',
      component: 'Animations',
      category: 'appearance',
    },
    {
      key: 'fonts',
      titleKey: 'settings.appearance.fonts.fonts',
      tags: 'settingsTags.fonts',
      component: 'FontSettings',
      category: 'appearance',
    },
  ];

  const filteredSections = computed(() => {
    if (!search.value) {
      return allSettingsSections.filter(section => section.category === currentTab.value);
    }

    const searchTerm = search.value.toLowerCase();

    // When searching, show ALL matching sections regardless of current tab
    return allSettingsSections.filter((section) => {
      const title = t(section.titleKey).toLowerCase();
      const tags = t(section.tags).toLowerCase();
      return title.includes(searchTerm) || tags.includes(searchTerm);
    });
  });

  const currentTabSections = computed(() => {
    return filteredSections.value;
  });

  function setCurrentTab(tab: string) {
    currentTab.value = tab;
  }

  function clearSearch() {
    search.value = '';
  }

  return {
    currentTab,
    tabs,
    search,
    allSettingsSections,
    filteredSections,
    currentTabSections,
    setCurrentTab,
    clearSearch,
    // Legacy aliases for backward compatibility
    allSettings: allSettingsSections,
    filteredSettings: filteredSections,
    currentTabSettings: currentTabSections,
  };
});
