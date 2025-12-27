// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DirEntry } from '@/types/dir-entry';

export type ViewFilterProperty = {
  name: string;
  title: string;
  prefix: string;
  itemPropertyPath: string;
  isDeepProperty?: boolean;
  processing?: (propertyValue: string) => string;
};

export type ViewFilterParams = {
  options: {
    glob: boolean;
  };
  properties: ViewFilterProperty[];
};

export type ViewFilter = {
  navigator: ViewFilterParams;
  notes: ViewFilterParams;
  dashboard: ViewFilterParams;
  settings: ViewFilterParams;
  extensions: ViewFilterParams;
};

export type ViewFilterName = keyof ViewFilter;

export type FilterNavigatorViewParams = ViewFilterParams & {
  items: DirEntry[];
  showHiddenItems: boolean;
};

export type FilterNavigatorViewResult = DirEntry[];
