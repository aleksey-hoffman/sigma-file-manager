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
import { i18n } from '@/localization';
import { formatKeybindingKeys } from '@/modules/extensions/api';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { usePlatformStore } from '@/stores/runtime/platform';
import {
  formatShortcutKeys,
  useShortcutsStore,
} from '@/stores/runtime/shortcuts';
import { useGlobalShortcutsStore } from '@/stores/runtime/global-shortcuts';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import {
  filterSettingsSections,
  shortcutSearchItemMatches,
} from '@/modules/settings/utils/settings-search';

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

function normalizeSettingsTabName(tabName: string): string {
  return settingsTabs.some(tab => tab.name === tabName) ? tabName : 'general';
}

function getExtensionCommandSearchTitles(extensionId: string, commandId: string): string[] {
  const extensionsStore = useExtensionsStore();
  const titles = [commandId];
  const command = extensionsStore.commands.find(registeredCommand => registeredCommand.command.id === commandId);

  if (command?.command.title) {
    titles.push(command.command.title);
  }

  const contextMenuItem = extensionsStore.contextMenuItems.find(
    item => item.extensionId === extensionId && item.item.id === commandId,
  );

  if (contextMenuItem?.item.title) {
    titles.push(contextMenuItem.item.title);
  }

  return titles;
}

function shortcutsSectionMatchesSearch(searchTerm: string): boolean {
  const shortcutsStore = useShortcutsStore();
  const globalShortcutsStore = useGlobalShortcutsStore();
  const extensionsStore = useExtensionsStore();

  const appShortcutMatches = shortcutsStore.definitions.some(definition =>
    shortcutSearchItemMatches({
      labelKey: definition.labelKey,
      combinations: [shortcutsStore.getShortcutBindingLabel(definition)],
    }, searchTerm),
  );

  if (appShortcutMatches) {
    return true;
  }

  const globalShortcutMatches = globalShortcutsStore.definitions.some(definition =>
    shortcutSearchItemMatches({
      labelKey: definition.labelKey,
      combinations: [globalShortcutsStore.getShortcutLabel(definition.id)],
    }, searchTerm),
  );

  if (globalShortcutMatches) {
    return true;
  }

  const extensionLocalMatches = extensionsStore.keybindings.some(keybinding =>
    shortcutSearchItemMatches({
      titles: getExtensionCommandSearchTitles(keybinding.extensionId, keybinding.commandId),
      combinations: [
        formatKeybindingKeys(keybinding.keys),
        formatShortcutKeys(keybinding.keys),
      ],
    }, searchTerm),
  );

  if (extensionLocalMatches) {
    return true;
  }

  return globalShortcutsStore.extensionDefinitions.some(shortcut =>
    shortcutSearchItemMatches({
      titles: [shortcut.commandTitle],
      combinations: [
        formatKeybindingKeys(shortcut.keys),
        formatShortcutKeys(shortcut.keys),
      ],
    }, searchTerm),
  );
}

export const useSettingsStore = defineStore('settings', () => {
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
  const allSections = shallowRef<SettingsSection[]>([]);
  const isInitialized = ref(false);

  const sections = computed(() => allSections.value.filter(
    section => section.key !== 'defaultFileManager' || platformStore.isWindows,
  ));
  const tabs = computed(() =>
    settingsTabs
      .filter(tab =>
        tab.name !== 'experimental'
        || sections.value.some(section => section.category === 'experimental'),
      )
      .map(tab => ({
        name: tab.name,
        label: i18n.global.t(tab.labelKey),
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
      { default: StartupPageSection },
      { default: PerformanceSection },
      { default: FileViewSection },
      { default: ThemeSection },
      { default: HomePageMediaBannerSection },
      { default: DriveCardSection },
      { default: VisualEffectsSection },
      { default: VisualFiltersSection },
      { default: SystemIconsSection },
      { default: ShowHiddenItemsSection },
      { default: FontsSection },
      { default: DropdownFocusSection },
      { default: QuickAccessHoverSection },
      { default: TooltipsSection },
      { default: ClipboardSection },
      { default: InfoPanelSection },
      { default: GlobalSearchSection },
      { default: ShortcutsSection },
      { default: UserDataSection },
      { default: DriveDetectionSection },
      { default: AutoplaySection },
      { default: AppUpdatesSection },
      { default: LastTabCloseBehaviorSection },
      { default: DefaultDirectorySection },
      { default: TabAppearanceSection },
      { default: ExtensionsListSection },
      { default: DefaultFileManagerSection },
    ] = await Promise.all([
      import('@/modules/settings/ui/categories/general/language.vue'),
      import('@/modules/settings/ui/categories/general/date-time.vue'),
      import('@/modules/settings/ui/categories/general/window-scaling.vue'),
      import('@/modules/settings/ui/categories/general/whats-new.vue'),
      import('@/modules/settings/ui/categories/general/startup.vue'),
      import('@/modules/settings/ui/categories/general/startup-page.vue'),
      import('@/modules/settings/ui/categories/general/performance.vue'),
      import('@/modules/settings/ui/categories/general/file-view.vue'),
      import('@/modules/settings/ui/categories/appearance/theme.vue'),
      import('@/modules/settings/ui/categories/appearance/home-page-media-banner.vue'),
      import('@/modules/settings/ui/categories/appearance/drive-card.vue'),
      import('@/modules/settings/ui/categories/appearance/visual-effects.vue'),
      import('@/modules/settings/ui/categories/appearance/visual-filters.vue'),
      import('@/modules/settings/ui/categories/appearance/system-icons.vue'),
      import('@/modules/settings/ui/categories/appearance/show-hidden-items.vue'),
      import('@/modules/settings/ui/categories/appearance/fonts.vue'),
      import('@/modules/settings/ui/categories/appearance/dropdown-focus.vue'),
      import('@/modules/settings/ui/categories/appearance/quick-access-hover.vue'),
      import('@/modules/settings/ui/categories/appearance/tooltips.vue'),
      import('@/modules/settings/ui/categories/appearance/clipboard.vue'),
      import('@/modules/settings/ui/categories/appearance/info-panel.vue'),
      import('@/modules/settings/ui/categories/search/global-search.vue'),
      import('@/modules/settings/ui/categories/shortcuts/shortcuts.vue'),
      import('@/modules/settings/ui/categories/stats/user-data.vue'),
      import('@/modules/settings/ui/categories/storage/drive-detection.vue'),
      import('@/modules/settings/ui/categories/storage/autoplay.vue'),
      import('@/modules/settings/ui/categories/general/app-updates.vue'),
      import('@/modules/settings/ui/categories/tabs/last-tab-close-behavior.vue'),
      import('@/modules/settings/ui/categories/tabs/default-directory.vue'),
      import('@/modules/settings/ui/categories/tabs/tab-appearance.vue'),
      import('@/modules/settings/ui/categories/extensions/extensions-list.vue'),
      import('@/modules/settings/ui/categories/experimental/default-file-manager.vue'),
    ]);

    allSections.value = [
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
      ...(platformStore.appUpdatesManagedExternally
        ? []
        : [
            {
              key: 'appUpdates',
              titleKey: 'appUpdates',
              tags: 'settingsTags.updates',
              component: markRaw(AppUpdatesSection),
              category: 'general',
            },
          ]),
      {
        key: 'startup',
        titleKey: 'settings.general.startupBehavior',
        tags: 'settingsTags.autostart',
        component: markRaw(StartupSection),
        category: 'general',
      },
      {
        key: 'startupPage',
        titleKey: 'settings.general.startupPage.title',
        tags: 'settingsTags.startupPage',
        component: markRaw(StartupPageSection),
        category: 'general',
      },
      {
        key: 'performance',
        titleKey: 'settings.general.performance.title',
        tags: 'settingsTags.performance',
        component: markRaw(PerformanceSection),
        category: 'general',
      },
      {
        key: 'fileView',
        titleKey: 'settings.general.fileView.title',
        tags: 'settingsTags.fileView',
        component: markRaw(FileViewSection),
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
        key: 'systemIcons',
        titleKey: 'settings.navigator.systemIcons',
        tags: 'settingsTags.systemIcons',
        component: markRaw(SystemIconsSection),
        category: 'appearance',
      },
      {
        key: 'homePageMediaBanner',
        titleKey: 'settings.homePageMediaBanner.title',
        tags: 'settingsTags.homePageMediaBanner',
        component: markRaw(HomePageMediaBannerSection),
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
        key: 'tooltips',
        titleKey: 'settings.tooltips.title',
        tags: 'settingsTags.tooltips',
        component: markRaw(TooltipsSection),
        category: 'appearance',
      },
      {
        key: 'clipboard',
        titleKey: 'settings.clipboard.title',
        tags: 'settingsTags.clipboard',
        component: markRaw(ClipboardSection),
        category: 'appearance',
      },
      {
        key: 'infoPanel',
        titleKey: 'settings.infoPanel.title',
        tags: 'settingsTags.infoPanelPreview',
        component: markRaw(InfoPanelSection),
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
        key: 'lastTabCloseBehavior',
        titleKey: 'settings.tabs.lastTabCloseBehavior.title',
        tags: 'settingsTags.tabsWorkspaces',
        component: markRaw(LastTabCloseBehaviorSection),
        category: 'tabs',
      },
      {
        key: 'defaultDirectory',
        titleKey: 'settings.tabs.defaultDirectory.title',
        tags: 'settingsTags.defaultDirectory',
        component: markRaw(DefaultDirectorySection),
        category: 'tabs',
      },
      {
        key: 'tabAppearance',
        titleKey: 'settings.tabs.tabAppearance.title',
        tags: 'settingsTags.tabAppearance',
        component: markRaw(TabAppearanceSection),
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
      {
        key: 'defaultFileManager',
        titleKey: 'settings.experimental.defaultFileManager.title',
        tags: 'settingsTags.experimental',
        component: markRaw(DefaultFileManagerSection),
        category: 'experimental',
      },
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

  const filteredSections = computed(() => filterSettingsSections(
    sections.value,
    search.value,
    currentTab.value,
    {
      shortcuts: shortcutsSectionMatchesSearch,
    },
  ));

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
