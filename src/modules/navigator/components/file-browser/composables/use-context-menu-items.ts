// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, type Ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import type { ContextMenuAction } from '@/modules/navigator/components/file-browser/types';
import { usePlatformStore } from '@/stores/runtime/platform';
import {
  getContextMenuSelectionStats,
  isContextMenuActionVisible,
} from '@/modules/navigator/components/file-browser/utils/context-menu-action-visibility';

export function useContextMenuItems(
  selectedEntries: Ref<DirEntry[]>,
  options?: {
    disableDestructiveActions?: Ref<boolean>;
    /** FORK-MODIFICATION: 供 `SEARCH_RESULTS_ONLY_ACTIONS` 判定当前是否在搜索结果视图。 */
    isSearchResultsView?: Ref<boolean>;
  },
) {
  const platformStore = usePlatformStore();

  const selectionStats = computed(() => getContextMenuSelectionStats(selectedEntries.value));

  function isActionVisible(action: ContextMenuAction): boolean {
    return isContextMenuActionVisible(action, selectedEntries.value, {
      platform: platformStore.currentPlatform,
      disableDestructiveActions: options?.disableDestructiveActions?.value,
      isSearchResultsView: options?.isSearchResultsView?.value,
    });
  }

  return {
    selectionStats,
    isActionVisible,
  };
}
