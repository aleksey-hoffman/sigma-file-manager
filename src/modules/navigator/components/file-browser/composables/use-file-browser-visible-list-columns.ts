// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import type { ListReorderableColumnId } from '@/types/user-settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import {
  getListColumnDefinition,
  normalizeListColumnOrder,
  type FileBrowserListColumnDefinition,
} from '../utils/file-browser-list-columns';

export type FileBrowserVisibleOptionalListColumn = FileBrowserListColumnDefinition & {
  id: ListReorderableColumnId;
};

export function useFileBrowserVisibleListColumns() {
  const userSettingsStore = useUserSettingsStore();

  const visibleOptionalListColumns = computed<FileBrowserVisibleOptionalListColumn[]>(() => {
    const columnVisibility = userSettingsStore.userSettings.navigator.listColumnVisibility;

    return normalizeListColumnOrder(userSettingsStore.userSettings.navigator.listColumnOrder)
      .filter(columnId => columnVisibility[columnId])
      .map(columnId => getListColumnDefinition(columnId) as FileBrowserVisibleOptionalListColumn);
  });

  const visibleListColumns = computed<FileBrowserListColumnDefinition[]>(() => {
    return [
      getListColumnDefinition('name'),
      ...visibleOptionalListColumns.value,
    ];
  });

  const visibleListColumnOrderKey = computed(() => {
    return userSettingsStore.userSettings.navigator.listColumnOrder.join('|');
  });

  return {
    visibleListColumns,
    visibleOptionalListColumns,
    visibleListColumnOrderKey,
  };
}
