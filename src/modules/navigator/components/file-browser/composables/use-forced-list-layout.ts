// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 反馈 3（2026-10-15）——「打开所属目录」分栏出来的那两格，
// 用户要求「都采用列表样式视图」。这个 composable 负责**什么时候解除**这个临时覆盖。
//
// 为什么单独成文件，而不是写在 file-browser.vue 里：
// 解除时要写 `tab.pendingForceListLayout = false`，而 tab 是通过 prop 传进来的。
// 在 .vue 里写会被 `vue/no-mutating-props` 拦下（而且那条规则拦得对 ——
// 组件不该改 prop）。这里改的其实是 workspaces store 里那个 tab 对象，
// 组件只是持有它的引用；`useFileBrowserNavigation` 早就在写同一个对象的
// `path` / `dirEntries` 了。放进 composable 一是让"改的是 store 状态而不是 prop"
// 这件事在类型上就说清楚，二是这段逻辑可以脱离组件直接单测。

import { computed, watch, type Ref } from 'vue';
import type { Tab } from '@/types/workspaces';

export function useForcedListLayout(options: {
  getTab: () => Tab | undefined;
  currentPath: Ref<string>;
}) {
  function release() {
    const tab = options.getTab();

    if (tab?.pendingForceListLayout) {
      tab.pendingForceListLayout = false;
    }
  }

  // 解锁时机之二：pane 导航去别的目录。
  // 挂在 currentPath 上而不是动作按钮上，是为了让「双击进目录」「地址栏跳转」
  // 「后退」这些不经过 setLayout 的路径一并覆盖到。
  //
  // `oldPath !== ''` 是必须的：`currentPath` 初始就是 ''，挂载后的**首次**导航
  // 会把它从 '' 变成真实路径，那不是"用户换了目录"，覆盖必须留着 ——
  // 分栏出来的左格紧接着就要导航到父目录，正是在这一步被创建并标记的。
  watch(options.currentPath, (newPath, oldPath) => {
    if (oldPath !== undefined && oldPath !== '' && newPath !== oldPath) {
      release();
    }
  });

  return {
    isForced: computed(() => Boolean(options.getTab()?.pendingForceListLayout)),
    release,
  };
}
