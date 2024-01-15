// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {DirEntry} from '@/types/dirEntry';

export type ViewFilterProperty = {
  name: string;
  title: string;
  prefix: string;
  itemPropertyPath: string;
  isDeepProperty?: boolean;
  processing?: (propertyValue: any) => any;
}

export type NavigatorViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
}

export type NotesViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
}

export type DashboardViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
}

export type SettingsViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
}

export type ExtensionsViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
}

export type ViewFilter = {
  navigator: NavigatorViewFilterParams;
  notes: NotesViewFilterParams;
  dashboard: DashboardViewFilterParams;
  settings: SettingsViewFilterParams;
  extensions: ExtensionsViewFilterParams;
}

export type ViewFilterName = 'navigator' | 'notes' | 'dashboard' | 'settings' | 'extensions';

export type FilterNavigatorViewParams = NavigatorViewFilterParams & {
  items: DirEntry[];
  showHiddenItems: boolean;
}

export type FilterNavigatorViewResult = DirEntry[]
