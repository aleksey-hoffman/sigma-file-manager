// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';

const DEFAULT_OVERSCAN_ITEMS = 6;

export function computeHorizontalVirtualTotalWidth(
  itemCount: number,
  itemWidthPx: number,
  itemGapPx: number,
): number {
  if (itemCount <= 0) {
    return 0;
  }

  const itemSpanPx = itemWidthPx + itemGapPx;

  return (itemCount - 1) * itemSpanPx + itemWidthPx;
}

export function computeHorizontalFixedVirtualRange(options: {
  scrollLeft: number;
  viewportWidth: number;
  itemCount: number;
  itemWidthPx: number;
  itemGapPx: number;
  overscanItems: number;
}): {
  start: number;
  end: number;
} {
  const {
    scrollLeft: viewScrollLeft,
    viewportWidth,
    itemCount,
    itemWidthPx,
    itemGapPx,
    overscanItems,
  } = options;

  if (itemCount <= 0) {
    return {
      start: 0,
      end: 0,
    };
  }

  const itemSpanPx = itemWidthPx + itemGapPx;
  const totalWidthPx = computeHorizontalVirtualTotalWidth(itemCount, itemWidthPx, itemGapPx);
  const effectiveViewportWidth = Math.max(1, viewportWidth);
  const maxScrollLeft = Math.max(0, totalWidthPx - effectiveViewportWidth);
  const effectiveScrollLeft = Math.min(Math.max(0, viewScrollLeft), maxScrollLeft);
  const start = Math.max(
    0,
    Math.floor((effectiveScrollLeft + itemGapPx) / itemSpanPx) - overscanItems,
  );
  const end = Math.min(
    itemCount,
    Math.ceil((effectiveScrollLeft + effectiveViewportWidth) / itemSpanPx) + overscanItems,
  );

  return {
    start,
    end: Math.max(start, end),
  };
}

export function useHorizontalFixedVirtualList(options: {
  itemCount: ComputedRef<number>;
  itemWidthPx: number;
  itemGapPx: number;
  overscanItems?: number;
  viewportRef: Ref<HTMLElement | null>;
}) {
  const itemSpanPx = options.itemWidthPx + options.itemGapPx;
  const overscanItems = options.overscanItems ?? DEFAULT_OVERSCAN_ITEMS;
  const scrollLeft = ref(0);
  const viewportClientWidth = ref(0);
  let scrollListenerAttached: HTMLElement | null = null;
  let resizeObserver: ResizeObserver | null = null;

  const totalWidthPx = computed(() =>
    computeHorizontalVirtualTotalWidth(
      options.itemCount.value,
      options.itemWidthPx,
      options.itemGapPx,
    ),
  );

  const visibleRange = computed(() =>
    computeHorizontalFixedVirtualRange({
      scrollLeft: scrollLeft.value,
      viewportWidth: viewportClientWidth.value,
      itemCount: options.itemCount.value,
      itemWidthPx: options.itemWidthPx,
      itemGapPx: options.itemGapPx,
      overscanItems,
    }),
  );

  const rowAbsoluteLeftPx = computed(() => visibleRange.value.start * itemSpanPx);

  function handleViewportScroll(event: Event) {
    const target = event.target as HTMLElement;
    scrollLeft.value = target.scrollLeft;
  }

  function syncViewportMetrics(viewport: HTMLElement) {
    viewportClientWidth.value = viewport.clientWidth;
    scrollLeft.value = viewport.scrollLeft;
  }

  function detachViewport() {
    if (scrollListenerAttached) {
      scrollListenerAttached.removeEventListener('scroll', handleViewportScroll);
      scrollListenerAttached = null;
    }

    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  function attachViewport(viewport: HTMLElement | null) {
    detachViewport();

    if (!viewport) {
      scrollLeft.value = 0;
      viewportClientWidth.value = 0;
      return;
    }

    scrollListenerAttached = viewport;
    viewport.addEventListener('scroll', handleViewportScroll, { passive: true });
    syncViewportMetrics(viewport);
    resizeObserver = new ResizeObserver(() => {
      syncViewportMetrics(viewport);
    });
    resizeObserver.observe(viewport);
  }

  watch(
    () => options.viewportRef.value,
    nextViewport => attachViewport(nextViewport),
    { immediate: true },
  );

  onBeforeUnmount(() => {
    detachViewport();
  });

  function scrollItemIntoViewCentered(index: number, behavior: ScrollBehavior = 'auto') {
    const viewport = options.viewportRef.value;
    const count = options.itemCount.value;

    if (!viewport || index < 0 || index >= count) {
      return;
    }

    const viewW = viewport.clientWidth;
    const total = totalWidthPx.value;
    const itemLeft = index * itemSpanPx;
    const itemWidth = options.itemWidthPx;
    const maxScroll = Math.max(0, total - viewW);
    const itemCenter = itemLeft + itemWidth / 2;
    const nextLeft = Math.min(maxScroll, Math.max(0, itemCenter - viewW / 2));

    viewport.scrollTo({
      left: nextLeft,
      behavior,
    });
  }

  return {
    totalWidthPx,
    visibleRange,
    rowAbsoluteLeftPx,
    scrollItemIntoViewCentered,
  };
}
