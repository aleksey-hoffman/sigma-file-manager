// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type UserSettings = {
  language: LocalizationLanguage;
  theme: Theme;
  transparentToolbars: boolean;
  dateTime: DateTime;
  navigator: Navigator;
}

export type LocalizationLanguage = {
  name: string;
  locale: string;
  isCorrected: boolean;
  isRtl: boolean;
}

export type Theme = {
  type: 'light' | 'dark';
}

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
}

export type Navigator = {
  layout: NavigatorLayout;
  infoPanel: NavigatorInfoPanel;
}

export type NavigatorInfoPanel = {
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
}