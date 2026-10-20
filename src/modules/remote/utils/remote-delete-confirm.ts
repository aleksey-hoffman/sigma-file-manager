// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：远程删除的确认框状态。
//
// 与 `use-permanent-delete-confirm.ts` 同款：**每个 FileBrowser 实例一份**。
// 不用模块级单例，是因为同一屏可能有左右两格（本地 + 远程双屏），
// 两格各自的「待确认条目」不能互相覆盖 —— 模块级单例会让后一格弹出的
// 确认框显示前一格的路径。

import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';

export function useRemoteDeleteConfirm() {
  const isOpen = ref(false);
  const pendingEntries = ref<DirEntry[]>([]);
  let pendingResolve: ((confirmed: boolean) => void) | null = null;

  function requestConfirm(entries: DirEntry[]): Promise<boolean> {
    pendingEntries.value = entries;
    return new Promise((resolve) => {
      pendingResolve = resolve;
      isOpen.value = true;
    });
  }

  function handleConfirm() {
    if (pendingResolve) {
      pendingResolve(true);
      pendingResolve = null;
    }

    isOpen.value = false;
  }

  function handleOpenChange(value: boolean) {
    if (!value) {
      if (pendingResolve) {
        pendingResolve(false);
        pendingResolve = null;
      }

      pendingEntries.value = [];
    }

    isOpen.value = value;
  }

  return {
    isOpen,
    pendingEntries,
    requestConfirm,
    handleConfirm,
    handleOpenChange,
  };
}
