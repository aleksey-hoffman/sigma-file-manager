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

export type UserSettings = {
  language: LocalizationLanguage;
  theme: Theme;
  transparentToolbars: boolean;
  dateTime: DateTime;
  navigator: UserSettingsNavigator;
  UIZoomLevel?: number;
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
