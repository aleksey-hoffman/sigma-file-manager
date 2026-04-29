// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, onUnmounted, ref, type Ref } from 'vue';
import { useEventListener, useResizeObserver } from '@vueuse/core';

interface HorizontalScrollFadeOptions {
  animationDurationMs?: number;
  edgeThreshold?: number;
  fadeWidth?: number;
  scrollContentRef?: Ref<HTMLElement | null>;
}

const DEFAULT_ANIMATION_DURATION_MS = 150;
const DEFAULT_EDGE_THRESHOLD = 1;
const DEFAULT_FADE_WIDTH = 24;
const HORIZONTAL_SCROLL_FADE_CLASS = 'horizontal-scroll-fade';

export function useHorizontalScrollFade(
  scrollContainerRef: Ref<HTMLElement | null>,
  options: HorizontalScrollFadeOptions = {},
) {
  const canScrollLeft = ref(false);
  const canScrollRight = ref(false);
  const leftFadeWidth = ref(0);
  const rightFadeWidth = ref(0);
  const animationDurationMs = options.animationDurationMs ?? DEFAULT_ANIMATION_DURATION_MS;
  const edgeThreshold = options.edgeThreshold ?? DEFAULT_EDGE_THRESHOLD;
  const fadeWidth = options.fadeWidth ?? DEFAULT_FADE_WIDTH;
  let animationFrameId: number | null = null;
  let animationStartTime: number | null = null;
  let startLeftFadeWidth = 0;
  let startRightFadeWidth = 0;
  let targetLeftFadeWidth = 0;
  let targetRightFadeWidth = 0;

  const scrollFadeStyle = computed(() => ({
    '--horizontal-scroll-left-fade-width': `${leftFadeWidth.value}px`,
    '--horizontal-scroll-right-fade-width': `${rightFadeWidth.value}px`,
  }));

  function cancelFadeAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    animationStartTime = null;
  }

  function setFadeWidths(leftWidth: number, rightWidth: number) {
    leftFadeWidth.value = leftWidth;
    rightFadeWidth.value = rightWidth;
  }

  function easeOutCubic(progress: number) {
    return 1 - (1 - progress) ** 3;
  }

  function animateFadeWidths(leftWidth: number, rightWidth: number) {
    if (leftWidth === targetLeftFadeWidth && rightWidth === targetRightFadeWidth) {
      return;
    }

    cancelFadeAnimation();

    startLeftFadeWidth = leftFadeWidth.value;
    startRightFadeWidth = rightFadeWidth.value;
    targetLeftFadeWidth = leftWidth;
    targetRightFadeWidth = rightWidth;

    if (
      animationDurationMs <= 0
      || (startLeftFadeWidth === targetLeftFadeWidth && startRightFadeWidth === targetRightFadeWidth)
    ) {
      setFadeWidths(targetLeftFadeWidth, targetRightFadeWidth);
      return;
    }

    function animateFrame(timestamp: number) {
      if (animationStartTime === null) {
        animationStartTime = timestamp;
      }

      const progress = Math.min((timestamp - animationStartTime) / animationDurationMs, 1);
      const easedProgress = easeOutCubic(progress);
      const nextLeftFadeWidth = startLeftFadeWidth + (targetLeftFadeWidth - startLeftFadeWidth) * easedProgress;
      const nextRightFadeWidth = startRightFadeWidth + (targetRightFadeWidth - startRightFadeWidth) * easedProgress;

      setFadeWidths(nextLeftFadeWidth, nextRightFadeWidth);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(animateFrame);
        return;
      }

      animationFrameId = null;
      animationStartTime = null;
    }

    animationFrameId = requestAnimationFrame(animateFrame);
  }

  function updateScrollFade() {
    const container = scrollContainerRef.value;

    if (!container) {
      canScrollLeft.value = false;
      canScrollRight.value = false;
      animateFadeWidths(0, 0);
      return;
    }

    const maxScrollLeft = Math.max(0, container.scrollWidth - container.clientWidth);
    canScrollLeft.value = container.scrollLeft > edgeThreshold;
    canScrollRight.value = container.scrollLeft < maxScrollLeft - edgeThreshold;

    animateFadeWidths(
      canScrollLeft.value ? fadeWidth : 0,
      canScrollRight.value ? fadeWidth : 0,
    );
  }

  useResizeObserver(scrollContainerRef, updateScrollFade);

  if (options.scrollContentRef) {
    useResizeObserver(options.scrollContentRef, updateScrollFade);
  }

  useEventListener(window, 'resize', updateScrollFade);
  onUnmounted(cancelFadeAnimation);

  return {
    canScrollLeft,
    canScrollRight,
    scrollFadeClass: HORIZONTAL_SCROLL_FADE_CLASS,
    scrollFadeStyle,
    updateScrollFade,
  };
}
