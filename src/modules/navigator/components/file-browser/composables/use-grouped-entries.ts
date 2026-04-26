// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import type { GroupedEntries } from '../types';
import { groupFileBrowserEntries } from '../file-browser-entry-groups';
import { useFileBrowserContext } from './use-file-browser-context';

export function useGroupedEntries() {
  const ctx = useFileBrowserContext();

  const groupedEntries = computed<GroupedEntries>(() => {
    return groupFileBrowserEntries(ctx.entries.value);
  });

  return { groupedEntries };
}
