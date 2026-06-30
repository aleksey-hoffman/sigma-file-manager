// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  nextTick,
  onBeforeUnmount,
  watch,
  type Ref,
  type WatchSource,
} from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { useScrollRestorationStore } from '@/stores/runtime/scroll-restoration';

function waitForNextFrame(): Promise<void> {
  return new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });
}

export function useScrollRestoration(options: {
  stateKey: Readonly<Ref<string | undefined>>;
  scrollContainerRef: Ref<HTMLElement | null>;
  setScrollTop?: (scrollTop: number) => void;
  restoreTriggers?: WatchSource<unknown>[];
}) {
  const scrollStore = useScrollRestorationStore();
  let resizeObserver: ResizeObserver | null = null;
  let activeStateKey = options.stateKey.value;
  let restoreGeneration = 0;
  let pendingRestore: {
    generation: number;
    stateKey: string;
    scrollTop: number;
  } | null = null;
  const containerStateKeys = new WeakMap<HTMLElement, string | undefined>();

  function disconnectResizeObserver() {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function cancelPendingRestore() {
    restoreGeneration += 1;
    pendingRestore = null;
    disconnectResizeObserver();
  }

  function saveScrollForKey(stateKey: string | undefined, container = options.scrollContainerRef.value) {
    if (!stateKey || !container) {
      return;
    }

    scrollStore.setScrollTop(stateKey, container.scrollTop);
  }

  function saveCurrentScroll() {
    saveScrollForKey(activeStateKey ?? options.stateKey.value);
  }

  function isCurrentRestore(stateKey: string | undefined, generation: number): boolean {
    return generation === restoreGeneration && stateKey === options.stateKey.value;
  }

  function applyScrollTop(scrollTop: number): boolean {
    const container = options.scrollContainerRef.value;

    if (!container) {
      return false;
    }

    if (options.setScrollTop) {
      options.setScrollTop(scrollTop);
    }
    else {
      container.scrollTop = scrollTop;
    }

    return Math.abs(container.scrollTop - scrollTop) < 1;
  }

  function retryPendingRestore() {
    if (!pendingRestore) {
      return;
    }

    if (!isCurrentRestore(pendingRestore.stateKey, pendingRestore.generation)) {
      pendingRestore = null;
      disconnectResizeObserver();
      return;
    }

    if (applyScrollTop(pendingRestore.scrollTop)) {
      pendingRestore = null;
      disconnectResizeObserver();
    }
  }

  async function restoreScrollForKey(stateKey: string | undefined) {
    cancelPendingRestore();

    if (!stateKey) {
      return;
    }

    const generation = restoreGeneration;
    const scrollTop = scrollStore.getScrollTop(stateKey);

    await nextTick();
    await waitForNextFrame();

    if (!isCurrentRestore(stateKey, generation)) {
      return;
    }

    if (applyScrollTop(scrollTop) || scrollTop === 0) {
      return;
    }

    const container = options.scrollContainerRef.value;

    if (!container) {
      return;
    }

    pendingRestore = {
      generation,
      stateKey,
      scrollTop,
    };
    resizeObserver = new ResizeObserver(retryPendingRestore);

    resizeObserver.observe(container);

    for (const child of container.children) {
      if (child instanceof HTMLElement) {
        resizeObserver.observe(child);
      }
    }
  }

  function handleScroll() {
    saveCurrentScroll();
  }

  watch(
    options.scrollContainerRef,
    (container, previousContainer) => {
      if (previousContainer) {
        saveScrollForKey(containerStateKeys.get(previousContainer), previousContainer);
        previousContainer.removeEventListener('scroll', handleScroll);
      }

      activeStateKey = options.stateKey.value;

      if (container) {
        containerStateKeys.set(container, activeStateKey);
        container.addEventListener('scroll', handleScroll, { passive: true });
        void restoreScrollForKey(activeStateKey);
      }
      else {
        cancelPendingRestore();
      }
    },
    { flush: 'post' },
  );

  watch(
    options.stateKey,
    (stateKey, previousStateKey) => {
      saveScrollForKey(previousStateKey);
      activeStateKey = stateKey;
      const currentContainer = options.scrollContainerRef.value;

      void nextTick(() => {
        if (currentContainer && options.scrollContainerRef.value === currentContainer) {
          containerStateKeys.set(currentContainer, stateKey);
        }
      });

      void restoreScrollForKey(stateKey);
    },
    { flush: 'pre' },
  );

  if (options.restoreTriggers?.length) {
    watch(
      options.restoreTriggers,
      async () => {
        await nextTick();
        await waitForNextFrame();
        retryPendingRestore();
      },
      { flush: 'post' },
    );
  }

  onBeforeRouteLeave(() => {
    saveCurrentScroll();
  });

  onBeforeUnmount(() => {
    const container = options.scrollContainerRef.value;

    if (container) {
      container.removeEventListener('scroll', handleScroll);
    }

    saveCurrentScroll();
    cancelPendingRestore();
  });

  return {
    saveCurrentScroll,
    restoreScrollForKey,
  };
}
