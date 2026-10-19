// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 权限设置对话框的状态。
//
// 为什么要模块级而不是 FileBrowser 的 context：
// 触发点（右键菜单）在 FileBrowser 里，渲染点（对话框）在导航器页里，
// 两者隔着好几层组件。走 context 要把「打开/关闭 + 当前目标」一路穿上去；
// 而这个对话框**全局只需要一个实例**，放模块级最省事，方向也单一
// （只有右键菜单写，只有对话框读）。

import { ref, type Ref } from 'vue';

export interface RemotePermissionsTarget {
  /** `sfm://remote/<id>/<path>` 形式的完整路径。 */
  path: string;
  /** 显示用的名字。 */
  name: string;
  /** 目录才有「递归」这个选项。 */
  isDirectory: boolean;
}

const isOpen = ref(false);
const target = ref<RemotePermissionsTarget | null>(null);

/** 打开权限设置对话框。 */
export function openRemotePermissionsDialog(next: RemotePermissionsTarget): void {
  target.value = next;
  isOpen.value = true;
}

/** 关闭权限设置对话框。 */
export function closeRemotePermissionsDialog(): void {
  isOpen.value = false;
  target.value = null;
}

export interface RemotePermissionsDialogState {
  isOpen: Ref<boolean>;
  target: Ref<RemotePermissionsTarget | null>;
}

export function useRemotePermissionsDialogState(): RemotePermissionsDialogState {
  return {
    isOpen,
    target,
  };
}
