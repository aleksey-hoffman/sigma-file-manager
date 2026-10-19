// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 传输目标（对面那一格当前在哪儿）的登记处。
//
// 为什么是一个模块级登记表，而不是给 FileBrowser 加 prop：
// 导航器（navigator.vue）**同时**拥有两格，它知道每格当前在哪儿；
// 而 FileBrowser 只知道自己这一格。上传/下载要的是「对面那一格」，
// 沿用 `ClipboardToolbar` 的 `pane1-path` / `pane2-path` 同一个思路，
// 但走 props 要穿过 `file-browser.vue` → `file-browser-context-menu.vue`
// → `file-browser-actions-menu.vue` 三层，还得多改四处模板。
//
// 登记表只有一处写（导航器），多处读（菜单可见性判定 + 动作执行），
// 方向单一，不会有「谁覆盖了谁」的问题。

import { ref, type Ref } from 'vue';
import { isRemotePath } from '@/utils/remote-paths';

const localPanePath = ref<string | null>(null);
const remotePanePath = ref<string | null>(null);

/**
 * 登记当前两格的路径。**本地格与远程格各取一个**。
 *
 * 取「第一个」而不是「最后一个」：同一侧有多格时（理论上不该发生），
 * 靠前的那格是用户最先看到的那格。
 */
export function setRemoteTransferTargets(paths: readonly string[]): void {
  let local: string | null = null;
  let remote: string | null = null;

  for (const path of paths) {
    if (!path) {
      continue;
    }

    if (isRemotePath(path)) {
      if (!remote) {
        remote = path;
      }
    }
    else if (!local) {
      local = path;
    }
  }

  localPanePath.value = local;
  remotePanePath.value = remote;
}

/** 清空登记（切到没有远程格的单格视图时）。 */
export function clearRemoteTransferTargets(): void {
  localPanePath.value = null;
  remotePanePath.value = null;
}

export interface RemoteTransferTargets {
  /** 本地那一格当前所在的本地目录。 */
  localPanePath: Ref<string | null>;
  /** 远程那一格当前所在的远程目录（`sfm://remote/<id>/...`）。 */
  remotePanePath: Ref<string | null>;
}

export function useRemoteTransferTargets(): RemoteTransferTargets {
  return {
    localPanePath,
    remotePanePath,
  };
}
