// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { NavigatorGrouping } from '@/types/user-settings';

export const NAVIGATOR_GROUPING_OPTIONS: readonly {
  value: NavigatorGrouping;
  labelKey: string;
}[] = [
  {
    value: 'none',
    labelKey: 'none',
  },
  {
    value: 'kind',
    labelKey: 'fileBrowser.kind',
  },
  {
    value: 'modified',
    labelKey: 'fileBrowser.modified',
  },
];
