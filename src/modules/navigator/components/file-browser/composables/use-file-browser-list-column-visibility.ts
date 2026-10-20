// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20：列表列的**实际**可见性。
//
// 全局偏好（`navigator.listColumnVisibility`）与「这一页显示哪些列」不是一回事：
// 「位置」页列的是磁盘，磁盘没有修改时间也没有创建时间，
// 那两列整列都是 `-`（用户附图要求去掉「修改时间」）。
//
// 所以这里给出一个**按当前路径算出来的**可见性：
// 全局偏好在它之上再叠一层「这一页不显示的列」。
//
// 路径从 FileBrowser context 取。取不到就当普通路径处理（不隐藏任何列）——
// `inject` 带默认值而不是抛错，是为了让这个 composable
// 在没有 provider 的场合也能用（例如单测）。

import { computed, inject, type ComputedRef } from 'vue';
import type { ListColumnVisibility } from '@/types/user-settings';
import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { applyListColumnVisibilityForPath } from '../utils/file-browser-list-columns';
import { FILE_BROWSER_CONTEXT_KEY } from './use-file-browser-context';

export function useFileBrowserListColumnVisibility(): ComputedRef<ListColumnVisibility> {
  const userSettingsStore = useUserSettingsStore();
  const fileBrowserContext = inject(FILE_BROWSER_CONTEXT_KEY, undefined);

  const currentPath = computed(() => fileBrowserContext?.currentPath.value ?? '');

  return computed(() => {
    return applyListColumnVisibilityForPath(
      userSettingsStore.userSettings.navigator.listColumnVisibility,
      currentPath.value,
    );
  });
}
