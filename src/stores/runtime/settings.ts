// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import {
  ref,
  computed,
  shallowRef,
  markRaw,
  type Component,
} from 'vue';
import { useI18n } from 'vue-i18n';
import { messages } from '@/localization/data';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { usePlatformStore } from '@/stores/runtime/platform';

export interface SettingsSection {
  key: string;
  titleKey: string;
  tags: string;
  component: Component;
  category: string;
}

export interface SettingsTab {
  name: string;
  labelKey: string;
}

function normalizeSettingsTabName(tabName: string): string {
  return tabName === 'advanced' ? 'experimental' : tabName;
}

const settingsTabs: SettingsTab[] = [
  {
    name: 'general',
    labelKey: 'settingsTabs.general',
  },
  {
    name: 'appearance',
    labelKey: 'settingsTabs.uiAppearance',
  },
  {
    name: 'shortcuts',
    labelKey: 'settingsTabs.shortcuts',
  },
  {
    name: 'tabs',
    labelKey: 'settingsTabs.tabsWorkspaces',
  },
  {
    name: 'input',
    labelKey: 'settingsTabs.input',
  },
  {
    name: 'search',
    labelKey: 'settingsTabs.search',
  },
  {
    name: 'storage',
    labelKey: 'settingsTabs.dataStorage',
  },
  {
    name: 'extensions',
    labelKey: 'settingsTabs.extensions',
  },
  {
    name: 'stats',
    labelKey: 'settingsTabs.stats',
  },
  {
    name: 'experimental',
    labelKey: 'settingsTabs.experimental',
  },
];

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === 'string' ? current : undefined;
}

function getAllTranslations(key: string): string[] {
  const translations: string[] = [];

  for (const locale of Object.keys(messages)) {
    const localeMessages = messages[locale as keyof typeof messages];
    const value = getNestedValue(localeMessages as Record<string, unknown>, key);

    if (value) {
      translations.push(value.toLowerCase());
    }
  }

  return translations;
}

function matchesAnyLocale(key: string, searchTerm: string): boolean {
  const translations = getAllTranslations(key);
  return translations.some(translation => translation.includes(searchTerm));
}

export const useSettingsStore = defineStore('settings', () => {
  const { t } = useI18n();
  const userSettingsStore = useUserSettingsStore();
  const platformStore = usePlatformStore();

  const currentTab = computed({
    get: () => normalizeSettingsTabName(userSettingsStore.userSettings.settingsCurrentTab),
    set: (value: string) => {
      const normalizedValue = normalizeSettingsTabName(value);
      userSettingsStore.userSettings.settingsCurrentTab = normalizedValue;
      userSettingsStore.setUserSettingsStorage('settingsCurrentTab', normalizedValue);
    },
  });

  const search = ref<string>('');
  const sections = shallowRef<SettingsSection[]>([]);
  const isInitialized = ref(false);

  const tabs = computed(() =>
    settingsTabs
      .filter((tab) => {
        if (tab.name !== 'advanced') return true;
        return sections.value.some(section => section.category === 'advanced');
      })
      .map(tab => ({
        name: tab.name,
        label: t(tab.labelKey),
      })),
  );

  async function init() {
    if (isInitialized.value) return;

    const [
      { default: LanguageSection },
      { default: DateTimeSection },
      { default: WindowScalingSection },
      { default: WhatsNewSection },
      { default: StartupSection },
      { default: ThemeSection },
      { default: DriveCardSection },
      { default: VisualEffectsSection },
      { default: VisualFiltersSection },
      { default: SystemIconsSection },
      { default: ShowHiddenItemsSection },
      { default: FontsSection },
      { default: DropdownFocusSection },
      { default: QuickAccessHoverSection },
      { default: GlobalSearchSection },
      { default: ShortcutsSection },
      { default: FilterOnTypingSection },
      { default: UserDataSection },
      { default: DriveDetectionSection },
      { default: AutoplaySection },
      { default: AppUpdatesSection },
      { default: LastTabCloseBehaviorSection },
      { default: ExtensionsListSection },
      { default: DefaultFileManagerSection },
    ] = await Promise.all([
      import('@/modules/settings/ui/categories/general/language.vue'),
      import('@/modules/settings/ui/categories/general/date-time.vue'),
      import('@/modules/settings/ui/categories/general/window-scaling.vue'),
      import('@/modules/settings/ui/categories/general/whats-new.vue'),
      import('@/modules/settings/ui/categories/general/startup.vue'),
      import('@/modules/settings/ui/categories/appearance/theme.vue'),
      import('@/modules/settings/ui/categories/appearance/drive-card.vue'),
      import('@/modules/settings/ui/categories/appearance/visual-effects.vue'),
      import('@/modules/settings/ui/categories/appearance/visual-filters.vue'),
      import('@/modules/settings/ui/categories/appearance/system-icons.vue'),
      import('@/modules/settings/ui/categories/appearance/show-hidden-items.vue'),
      import('@/modules/settings/ui/categories/appearance/fonts.vue'),
      import('@/modules/settings/ui/categories/appearance/dropdown-focus.vue'),
      import('@/modules/settings/ui/categories/appearance/quick-access-hover.vue'),
      import('@/modules/settings/ui/categories/search/global-search.vue'),
      import('@/modules/settings/ui/categories/shortcuts/shortcuts.vue'),
      import('@/modules/settings/ui/categories/input/filter-on-typing.vue'),
      import('@/modules/settings/ui/categories/stats/user-data.vue'),
      import('@/modules/settings/ui/categories/storage/drive-detection.vue'),
      import('@/modules/settings/ui/categories/storage/autoplay.vue'),
      import('@/modules/settings/ui/categories/general/app-updates.vue'),
      import('@/modules/settings/ui/categories/tabs/last-tab-close-behavior.vue'),
      import('@/modules/settings/ui/categories/extensions/extensions-list.vue'),
      import('@/modules/settings/ui/categories/experimental/default-file-manager.vue'),
    ]);

    sections.value = [
      {
        key: 'language',
        titleKey: 'language.language',
        tags: 'settingsTags.language',
        component: markRaw(LanguageSection),
        category: 'general',
      },
      {
        key: 'uiScaling',
        titleKey: 'settings.general.windowScaling',
        tags: 'settingsTags.uiScaling',
        component: markRaw(WindowScalingSection),
        category: 'general',
      },
      {
        key: 'whatsNew',
        titleKey: 'changelog.settingsTitle',
        tags: 'settingsTags.whatsNew',
        component: markRaw(WhatsNewSection),
        category: 'general',
      },
      {
        key: 'appUpdates',
        titleKey: 'appUpdates',
        tags: 'settingsTags.updates',
        component: markRaw(AppUpdatesSection),
        category: 'general',
      },
      {
        key: 'startup',
        titleKey: 'settings.general.startupBehavior',
        tags: 'settingsTags.autostart',
        component: markRaw(StartupSection),
        category: 'general',
      },
      {
        key: 'dateTime',
        titleKey: 'settings.dateTime.dateTime',
        tags: 'settingsTags.dateTime',
        component: markRaw(DateTimeSection),
        category: 'general',
      },
      {
        key: 'theme',
        titleKey: 'settings.homeBannerEffects.theme.title',
        tags: 'settingsTags.theme',
        component: markRaw(ThemeSection),
        category: 'appearance',
      },
      {
        key: 'visualEffects',
        titleKey: 'settings.visualEffects.title',
        tags: 'settingsTags.visualEffects',
        component: markRaw(VisualEffectsSection),
        category: 'appearance',
      },
      {
        key: 'visualFilters',
        titleKey: 'settings.visualFilters.title',
        tags: 'settingsTags.visualFilters',
        component: markRaw(VisualFiltersSection),
        category: 'appearance',
      },
      {
        key: 'driveCard',
        titleKey: 'settings.uiElements.showDriveSpaceIndicator',
        tags: 'settingsTags.driveCard',
        component: markRaw(DriveCardSection),
        category: 'appearance',
      },
      {
        key: 'systemIcons',
        titleKey: 'settings.navigator.systemIcons',
        tags: 'settingsTags.systemIcons',
        component: markRaw(SystemIconsSection),
        category: 'appearance',
      },
      {
        key: 'showHiddenItems',
        titleKey: 'filter.showHiddenItems',
        tags: 'settingsTags.navigator',
        component: markRaw(ShowHiddenItemsSection),
        category: 'appearance',
      },
      {
        key: 'fonts',
        titleKey: 'settings.fonts.fonts',
        tags: 'settingsTags.fonts',
        component: markRaw(FontsSection),
        category: 'appearance',
      },
      {
        key: 'dropdownFocus',
        titleKey: 'settings.uiElements.preventDropdownCloseFocusReturn',
        tags: 'settingsTags.uiElements',
        component: markRaw(DropdownFocusSection),
        category: 'appearance',
      },
      {
        key: 'quickAccessHover',
        titleKey: 'settings.uiElements.quickAccessOnHover',
        tags: 'settingsTags.quickAccess',
        component: markRaw(QuickAccessHoverSection),
        category: 'appearance',
      },
      {
        key: 'globalSearch',
        titleKey: 'settings.globalSearch.title',
        tags: 'settingsTags.globalSearch',
        component: markRaw(GlobalSearchSection),
        category: 'search',
      },
      {
        key: 'shortcuts',
        titleKey: 'settingsTabs.shortcuts',
        tags: 'settingsTags.shortcuts',
        component: markRaw(ShortcutsSection),
        category: 'shortcuts',
      },
      {
        key: 'filterOnTyping',
        titleKey: 'settings.input.activateWhenTyping',
        tags: 'settingsTags.inputElements',
        component: markRaw(FilterOnTypingSection),
        category: 'input',
      },
      {
        key: 'lastTabCloseBehavior',
        titleKey: 'settings.tabs.lastTabCloseBehavior.title',
        tags: 'settingsTags.tabsWorkspaces',
        component: markRaw(LastTabCloseBehaviorSection),
        category: 'tabs',
      },
      {
        key: 'userData',
        titleKey: 'settings.stats.title',
        tags: 'settingsTags.stats',
        component: markRaw(UserDataSection),
        category: 'stats',
      },
      {
        key: 'driveDetection',
        titleKey: 'settings.drives.driveDetection',
        tags: 'settingsTags.driveDetection',
        component: markRaw(DriveDetectionSection),
        category: 'storage',
      },
      {
        key: 'autoplay',
        titleKey: 'settings.drives.autoplaySettings',
        tags: 'settingsTags.autoplay',
        component: markRaw(AutoplaySection),
        category: 'storage',
      },
      {
        key: 'extensionSettings',
        titleKey: 'extensions.settings.title',
        tags: 'settingsTags.extensions',
        component: markRaw(ExtensionsListSection),
        category: 'extensions',
      },
      ...(platformStore.isWindows
        ? [{
            key: 'defaultFileManager',
            titleKey: 'settings.experimental.defaultFileManager.title',
            tags: 'settingsTags.experimental',
            component: markRaw(DefaultFileManagerSection),
            category: 'experimental',
          }]
        : []),
    ];

    const normalizedStoredTab = normalizeSettingsTabName(userSettingsStore.userSettings.settingsCurrentTab);

    if (normalizedStoredTab !== userSettingsStore.userSettings.settingsCurrentTab) {
      setCurrentTab(normalizedStoredTab);
    }

    if (!sections.value.some(section => section.category === currentTab.value)) {
      setCurrentTab('general');
    }

    isInitialized.value = true;
  }

  function getSectionsForCategory(category: string): SettingsSection[] {
    return sections.value.filter(section => section.category === category);
  }

  const filteredSections = computed(() => {
    if (!search.value) {
      return sections.value.filter(section => section.category === currentTab.value);
    }

    const searchTerm = search.value.toLowerCase();

    return sections.value.filter((section) => {
      const titleMatches = matchesAnyLocale(section.titleKey, searchTerm);
      const tagsMatch = matchesAnyLocale(section.tags, searchTerm);

      return titleMatches || tagsMatch;
    });
  });

  const currentTabSections = computed(() => filteredSections.value);

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
    sections,
    isInitialized,
    filteredSections,
    currentTabSections,
    init,
    getSectionsForCategory,
    setCurrentTab,
    clearSearch,
  };
});
