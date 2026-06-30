// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  type ComponentPublicInstance,
  type Ref,
} from 'vue';
import { getScrollRestorationKey } from '@/stores/runtime/scroll-restoration';
import { useScrollRestoration } from '@/composables/use-scroll-restoration';

type PageDefaultLayoutInstance = ComponentPublicInstance & {
  getScrollViewport: () => HTMLElement | null;
};

export function usePageLayoutScrollRestoration(options: {
  pageKey: string;
  activeTab: Readonly<Ref<string>>;
}) {
  const pageLayoutRef = ref<PageDefaultLayoutInstance | null>(null);
  const scrollViewportRef = ref<HTMLElement | null>(null);
  const stateKey = computed(() => getScrollRestorationKey(options.pageKey, options.activeTab.value));

  useScrollRestoration({
    stateKey,
    scrollContainerRef: scrollViewportRef,
  });

  onMounted(async () => {
    await nextTick();
    scrollViewportRef.value = pageLayoutRef.value?.getScrollViewport() ?? null;
  });

  onBeforeUnmount(() => {
    scrollViewportRef.value = null;
  });

  return {
    pageLayoutRef,
    scrollViewportRef,
  };
}
