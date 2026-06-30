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

  return activeTab;
}
