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

export type HomeBannerPositions = Record<number, HomeBannerPosition>;

export type UserDirectoryCustomization = {
  title?: string;
  path?: string;
  icon?: string;
};

export type UserDirectoriesCustomizations = Record<string, UserDirectoryCustomization>;

export type InfusionPageSettings = {
  blur: number;
  opacity: number;
  noise: number;
  noiseScale: number;
  background: {
    type: 'image' | 'video';
    path: string;
    index: number;
  };
};

export type InfusionPage = '' | 'home' | 'navigator' | 'dashboard' | 'settings' | 'extensions';

export type InfusionSettings = {
  enabled: boolean;
  sameSettingsForAllPages: boolean;
  selectedPageToCustomize: InfusionPage;
  pages: Record<InfusionPage, InfusionPageSettings>;
};

export type ShortcutKeys = {
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
  key: string;
};

export type ShortcutId
  = 'toggleGlobalSearch'
    | 'toggleFilter'
    | 'copy'
    | 'cut'
    | 'paste'
    | 'selectAll'
    | 'delete'
    | 'deletePermanently'
    | 'rename'
    | 'escape';

export type UserShortcuts = Partial<Record<ShortcutId, ShortcutKeys>>;

export type UserSettings = {
  language: LocalizationLanguage;
  theme: Theme;
  transparentToolbars: boolean;
  dateTime: DateTime;
  navigator: UserSettingsNavigator;
  globalSearch: UserSettingsGlobalSearch;
  UIZoomLevel?: number;
  homeBannerIndex: number;
  homeBannerPositions: HomeBannerPositions;
  driveCard: DriveCardSettings;
  userDirectories: UserDirectoriesCustomizations;
  infusion: InfusionSettings;
  settingsCurrentTab: string;
  shortcuts?: UserShortcuts;
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

export type Theme = 'light' | 'dark' | 'system';

export type DateTime = {
  month: 'short' | 'long';
  regionalFormat: {
    code: string;
    name: string;
  };
  autoDetectRegionalFormat: boolean;
  hour12: boolean;
  properties: {
    showSeconds: boolean;
    showMilliseconds: boolean;
  };
};

export type UserSettingsNavigator = {
  layout: NavigatorLayout;
  infoPanel: UserSettingsNavigatorInfoPanel;
  showHiddenFiles: boolean;
  useSystemIconsForDirectories: boolean;
  useSystemIconsForFiles: boolean;
};

export type UserSettingsNavigatorInfoPanel = {
  show: boolean;
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
