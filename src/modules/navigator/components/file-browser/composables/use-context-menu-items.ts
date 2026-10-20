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
// FORK-MODIFICATION: 传输类动作（上传 / 下载 / 权限设置）与远程删除的可见性判定。
import {
  isRemoteDeleteActionVisible,
  isRemoteTransferActionVisible,
  resolveSelectionProtocol,
  type RemoteContextMenuAction,
  type RemoteTransferMenuAction,
} from '@/modules/remote/utils/remote-context-menu-visibility';
import { useRemoteTransferTargets } from '@/modules/remote/utils/remote-transfer-targets';
import { useRemoteConnectionsStore } from '@/stores/storage/remote-connections';

export function useContextMenuItems(
  selectedEntries: Ref<DirEntry[]>,
  options?: {
    disableDestructiveActions?: Ref<boolean>;
    /** FORK-MODIFICATION: 供 `SEARCH_RESULTS_ONLY_ACTIONS` 判定当前是否在搜索结果视图。 */
    isSearchResultsView?: Ref<boolean>;
  },
) {
  const platformStore = usePlatformStore();
  const remoteConnectionsStore = useRemoteConnectionsStore();
  const transferTargets = useRemoteTransferTargets();

  const selectionStats = computed(() => getContextMenuSelectionStats(selectedEntries.value));

  /**
   * 传输类动作需要的上下文。
   *
   * 「对面那一格在哪儿」来自模块级登记表（由导航器写入），
   * 「选中条目的连接支不支持改权限」来自连接表。
   */
  const remoteTransferContext = computed(() => {
    const entries = selectedEntries.value;

    return {
      hasRemoteCounterpart: Boolean(transferTargets.remotePanePath.value),
      hasLocalCounterpart: Boolean(transferTargets.localPanePath.value),
      selectionProtocol: resolveSelectionProtocol(
        entries,
        connectionId => remoteConnectionsStore.getConnection(connectionId)?.protocol,
      ),
    };
  });

  function isRemoteTransferAction(action: ContextMenuAction): action is RemoteTransferMenuAction {
    return action === 'upload-to-remote'
      || action === 'download-to-local'
      || action === 'remote-permissions';
  }

  function isRemoteContextMenuAction(action: ContextMenuAction): action is RemoteContextMenuAction {
    return isRemoteTransferAction(action) || action === 'remote-delete';
  }

  function isActionVisible(action: ContextMenuAction): boolean {
    if (isRemoteContextMenuAction(action)) {
      // FORK-MODIFICATION：远程删除的判定只看「选中的全是远程条目」，
      // 不需要「对面那一格」的上下文，所以单独走一支。
      if (action === 'remote-delete') {
        return isRemoteDeleteActionVisible(selectedEntries.value);
      }

      return isRemoteTransferActionVisible(action, selectedEntries.value, remoteTransferContext.value);
    }

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
