// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：这一格在收到「传输完成」通知时的反应。
//
// 单独拆出来是为了能测：整块逻辑只有「路径是不是我当前所在的」和
// 「是的话读一次目录」两步，却要挂起整个 FileBrowser 才测得到。
// 拆开后直接调 `handleTransferCompleted` 就能断言，
// 而挂载那一层只剩「订阅 / 退订」两行胶水。

import { isRemoteTransferTargetPane } from '@/modules/remote/utils/remote-transfer-refresh';

export interface UseRemoteTransferRefreshOptions {
  /** 这一格当前所在的目录。取不到（还没导航过去）时传 null。 */
  currentPath: () => string | null;
  /** 重新读一次目录。 */
  refresh: () => void | Promise<void>;
}

export function useRemoteTransferRefresh(options: UseRemoteTransferRefreshOptions) {
  /**
   * 收到通知：目标目录就是我这儿的话，重新读一次。
   *
   * 路径不是我这儿的（用户在传输期间把这一格导航到别处去了）就**不刷** ——
   * 刷了会读到跟当前目录不搭的内容，那比不刷更糟。
   */
  function handleTransferCompleted(targetPath: string) {
    if (!isRemoteTransferTargetPane(targetPath, options.currentPath())) {
      return;
    }

    void options.refresh();
  }

  return {
    handleTransferCompleted,
  };
}
