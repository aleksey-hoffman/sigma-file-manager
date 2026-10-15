// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { ref, watch } from 'vue';
import { useScrollRestorationStore } from '@/stores/runtime/scroll-restoration';

export function useRestoredActiveTab(stateKey: string, defaultActiveTab: string) {
  const scrollStore = useScrollRestorationStore();
  const activeTab = ref(scrollStore.getActiveTab(stateKey) ?? defaultActiveTab);

  watch(
    activeTab,
    (tab) => {
      scrollStore.setActiveTab(stateKey, tab);
    },
    { immediate: true },
  );

  // FORK-MODIFICATION: store → ref 的反向同步。
  //
  // 原来只有 ref → store 一个方向，store 里的值在 setup 之后被外部改写时
  // 本 ref 不会更新。侧边栏「常用」「历史」点进来要切仪表盘页签
  // （决策 D4），而用户点它时仪表盘页往往已经挂载 —— 没有这条 watch
  // 就会出现「点了没反应」。仪表盘页未挂载时这条 watch 也不会误触发：
  // 那时还没有对应的 setup 消费它，值由下次 setup 时的一次性读取接管。
  watch(
    () => scrollStore.getActiveTab(stateKey),
    (tab) => {
      if (tab !== undefined && tab !== activeTab.value) {
        activeTab.value = tab;
      }
    },
  );

  return activeTab;
}
