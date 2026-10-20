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
// FORK-MODIFICATION 2026-10-20：按当前路径算「实际可见性」
// （「位置」页不显示日期列）。
import { useFileBrowserListColumnVisibility } from './use-file-browser-list-column-visibility';

export type FileBrowserVisibleOptionalListColumn = FileBrowserListColumnDefinition & {
  id: ListReorderableColumnId;
};

export function useFileBrowserVisibleListColumns() {
  const userSettingsStore = useUserSettingsStore();
  const columnVisibility = useFileBrowserListColumnVisibility();

  const visibleOptionalListColumns = computed<FileBrowserVisibleOptionalListColumn[]>(() => {
    const visibility = columnVisibility.value;

    return normalizeListColumnOrder(userSettingsStore.userSettings.navigator.listColumnOrder)
      .filter(columnId => visibility[columnId])
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
