// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watch, type WritableComputedRef } from 'vue';
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

export function useRestoredChoice<TChoice extends string>(
  stateKey: string,
  choices: readonly TChoice[],
  defaultChoice: TChoice,
): WritableComputedRef<TChoice, unknown> {
  const restoredValue = useRestoredActiveTab(stateKey, defaultChoice);

  function isChoice(value: unknown): value is TChoice {
    return typeof value === 'string' && (choices as readonly string[]).includes(value);
  }

  return computed<TChoice, unknown>({
    get: () => (isChoice(restoredValue.value) ? restoredValue.value : defaultChoice),
    set: (value) => {
      if (isChoice(value)) {
        restoredValue.value = value;
      }
    },
  });
}
