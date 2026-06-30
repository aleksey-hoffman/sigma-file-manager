// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

type NestedPaths<T, K extends keyof T = keyof T> = K extends string
  ? T[K] extends Record<string, unknown>
    ? T[K] extends unknown[]
      ? K
      : K | `${K}.${NestedPaths<T[K]>}`
    : K
  : never;

type GetNestedValue<T, P extends string> = P extends keyof T
  ? T[P]
  : P extends `${infer K}.${infer Rest}`
    ? K extends keyof T
      ? GetNestedValue<T[K], Rest>
      : never
    : never;

export type UserSettingsPath = NestedPaths<UserSettings>;

export type UserSettingsValue<P extends UserSettingsPath> = GetNestedValue<UserSettings, P>;

export type HomeBannerPosition = {
  positionX: number;
  positionY: number;
  zoom: number;
};

export type HomeBannerPositions = Record<string, HomeBannerPosition>;

export type CustomBackgroundMediaItem = {
  path: string;
  id: string;
};

export type CustomBackgroundMedia = CustomBackgroundMediaItem[];

export type UserDirectoryCustomization = {
  title?: string;
  path?: string;
  icon?: string;
  deleted?: boolean;
};

export type UserDirectoriesCustomizations = Record<string, UserDirectoryCustomization>;

export type MixBlendMode = 'normal' | 'multiply' | 'screen' | 'overlay' | 'darken' | 'lighten' | 'color-dodge' | 'color-burn' | 'hard-light' | 'soft-light' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';

export type InfusionPageSettings = {
  blur: number;
  mediaContrast: number;
  mediaBrightness: number;
  opacity: number;
  noise: number;
  noiseScale: number;
  mixBlendMode: MixBlendMode;
  background: {
    type: 'image' | 'video';
    path: string;
    index: number;
    mediaId?: string;
  };
};

export type InfusionPage = '' | 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions';

export type InfusionSettings = {
  enabled: boolean;
  sameSettingsForAllPages: boolean;
  selectedPageToCustomize: InfusionPage;
  pauseVideoWhenIdle: boolean;
  pages: Record<InfusionPage, InfusionPageSettings>;
};

export type VisualFiltersSettings = {
  brightness: number;
  contrast: number;
  dialogOverlayBlur: number;
};

export type ShortcutKeys = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  key: string;
};

export type UserShortcutStoredValue = ShortcutKeys | Array<ShortcutKeys | null>;

export type ShortcutId
  = 'toggleGlobalSearch'
    | 'switchToHomePage'
    | 'switchToNavigatorPage'
    | 'switchToDashboardPage'
    | 'switchToSettingsPage'
    | 'switchToExtensionsPage'
    | 'navigatePageBack'
    | 'navigatePageForward'
    | 'toggleFilter'
    | 'toggleSettingsSearch'
    | 'toggleCommandPalette'
    | 'toggleAddressBar'
    | 'openEntry'
    | 'toggleSplitView'
    | 'createNewFile'
    | 'createNewDirectory'
    | 'copyCurrentDirectoryPath'
    | 'openCopiedPath'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'selectAll'
    | 'delete'
    | 'deletePermanently'
    | 'rename'
    | 'escape'
    | 'quickView'
    | 'print'
    | 'properties'
    | 'openNewTab'
    | 'closeCurrentTab'
    | 'restoreLastClosedTab'
    | 'openTerminal'
    | 'openTerminalAdmin'
    | 'navigateUp'
    | 'navigateDown'
    | 'navigateLeft'
    | 'navigateRight'
    | 'openSelected'
    | 'navigateHistoryBack'
    | 'navigateHistoryForward'
    | 'goUpDirectory'
    | 'switchToLeftPane'
    | 'switchToRightPane'
    | 'reloadCurrentDirectory'
    | 'uiZoomIncrease'
    | 'uiZoomDecrease'
    | 'toggleFullscreen';

export type UserShortcuts = Partial<Record<ShortcutId, UserShortcutStoredValue>>;

export type ShortcutUserAlternateChordSlots = Partial<Record<ShortcutId, number[]>>;

export type GlobalShortcutId = 'launchApp';

export type UserGlobalShortcuts = Partial<Record<GlobalShortcutId, string>>;

export type AppUpdatesSettings = {
  autoCheck: boolean;
  lastCheckTimestamp: number;
};

export type ChangelogSettings = {
  showOnUpdate: boolean;
  lastSeenVersion: string;
};

export type PerformanceSettings = {
  prelaunchQuickViewWindow: boolean;
  prelaunchPrintViewWindow: boolean;
};

export type TextSettings = {
  font: string;
};

export type UserSettings = {
  language: LocalizationLanguage;
  theme: Theme;
  text: TextSettings;
  transparentToolbars: boolean;
  dateTime: DateTime;
  navigator: UserSettingsNavigator;
  globalSearch: UserSettingsGlobalSearch;
  UIZoomLevel?: number;
  showHomeBanner: boolean;
  homeBannerIndex: number;
  homeBannerMediaId: string;
  homeBannerPauseVideoWhenIdle: boolean;
  customBackgroundMedia: CustomBackgroundMedia;
  homeBannerPositions: HomeBannerPositions;
  driveCard: DriveCardSettings;
  userDirectories: UserDirectoriesCustomizations;
  infusion: InfusionSettings;
  visualFilters: VisualFiltersSettings;
  settingsCurrentTab: string;
  shortcuts?: UserShortcuts;
  shortcutUserAlternateChordSlots?: ShortcutUserAlternateChordSlots;
  globalShortcuts?: UserGlobalShortcuts;
  focusWindowOnDriveConnected: boolean;
  preventDropdownCloseFocusReturn: boolean;
  quickAccessOnHover: boolean;
  tooltipDelayMs: number;
  launchAtStartup: boolean;
  launchAtStartupHidden: boolean;
  performance: PerformanceSettings;
  appUpdates: AppUpdatesSettings;
  changelog: ChangelogSettings;
};

export type UserSettingsGlobalSearch = {
  scanDepth: number;
  autoScanPeriodMinutes: number;
  autoReindexWhenIdle: boolean;
  ignoredPaths: string[];
  selectedDriveRoots: string[];
  parallelScan: boolean;
  resultLimit: number;
  includeFiles: boolean;
  includeDirectories: boolean;
  exactMatch: boolean;
  typoTolerance: boolean;
  lastManualCancelTime: number | null;
};

export type DriveSpaceIndicatorStyle = 'linearVertical' | 'linearHorizontal' | 'linearHorizontalCentered' | 'circular';

export type DriveCardSettings = {
  showSpaceIndicator: boolean;
  spaceIndicatorStyle: DriveSpaceIndicatorStyle;
};

export type LocalizationLanguage = {
  name: string;
  locale: string;
  isCorrected: boolean;
  isRtl: boolean;
};

export type BuiltinThemeId = 'light' | 'dark' | 'system';
export type Theme = BuiltinThemeId | `extension:${string}:${string}`;
export type NavigatorIconTheme = string;

export type DateTime = {
  month: 'numeric' | 'short' | 'long';
  regionalFormat: {
    code: string;
    name: string;
  };
  autoDetectRegionalFormat: boolean;
  hour12: boolean;
  showRelativeDates: boolean;
  properties: {
    showSeconds: boolean;
    showMilliseconds: boolean;
  };
};

export type ListColumnVisibility = {
  kind: boolean;
  links: boolean;
  linkTarget: boolean;
  linkStatus: boolean;
  items: boolean;
  size: boolean;
  modified: boolean;
  created: boolean;
  tags: boolean;
};

export type ListColumnWidths = {
  name?: number;
  items?: number;
  size?: number;
  modified?: number;
  created?: number;
  tags?: number;
  kind?: number;
  links?: number;
  linkStatus?: number;
};

export type ListColumnFlexWeights = {
  name?: number;
  items?: number;
  size?: number;
  modified?: number;
  created?: number;
  tags?: number;
  kind?: number;
  links?: number;
  linkStatus?: number;
};

export type ListReorderableColumnId
  = | 'items'
    | 'size'
    | 'modified'
    | 'created'
    | 'tags'
    | 'kind'
    | 'links'
    | 'linkStatus';

export type ListColumnOrder = ListReorderableColumnId[];

export type ListSortColumn = 'name' | 'kind' | 'links' | 'items' | 'size' | 'modified' | 'created' | 'linkStatus' | 'tags';

export type ListSortDirection = 'asc' | 'desc';

export type LastTabCloseBehavior = 'createDefaultTab' | 'closeWindow' | 'navigateToHomePage';

export type SplitViewMode = 'split' | 'linked';

export type UserSettingsNavigator = {
  lastTabCloseBehavior: LastTabCloseBehavior;
  boldActiveTabTitle: boolean;
  layout: NavigatorLayout;
  infoPanel: UserSettingsNavigatorInfoPanel;
  showHiddenFiles: boolean;
  splitViewMode: SplitViewMode;
  folderIconTheme: NavigatorIconTheme;
  fileIconTheme: NavigatorIconTheme;
  listColumnVisibility: ListColumnVisibility;
  listColumnFillWidth: boolean;
  listColumnWidths: ListColumnWidths;
  listColumnFlexWeights: ListColumnFlexWeights;
  listColumnOrder: ListColumnOrder;
  listSortColumn: ListSortColumn | null;
  listSortDirection: ListSortDirection;
  gridSortColumn: ListSortColumn | null;
  gridSortDirection: ListSortDirection;
};

export type UserSettingsNavigatorInfoPanel = {
  show: boolean;
  dynamicSize: boolean;
  widthPx: number | null;
  previewHeightPx: number | null;
  showFullSizeImagePreview: boolean;
  muteVideoPreviewByDefault: boolean;
  autoplayVideoPreview: boolean;
};

export type NavigatorLayout = {
  type: {
    title: 'compactListLayout' | 'listLayout' | 'gridLayout';
    name: 'compact-list' | 'list' | 'grid';
  };
  dirItemOptions: {
    title: {
      height: number;
    };
    directory: {
      height: number;
    };
    file: {
      height: number;
    };
  };
};
