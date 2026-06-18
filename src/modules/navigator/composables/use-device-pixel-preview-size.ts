// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  nextTick,
  onBeforeUnmount,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
  type Ref,
} from 'vue';

export type DevicePixelPreviewSize = {
  width: number;
  height: number;
};

export function getDevicePixelRatio(): number {
  if (typeof window === 'undefined') {
    return 1;
  }

  return Math.max(1, window.devicePixelRatio || 1);
}

export function measureDevicePixelPreviewSize(element: HTMLElement): DevicePixelPreviewSize | null {
  const pixelRatio = getDevicePixelRatio();
  const measuredWidth = Math.round(element.clientWidth * pixelRatio);
  const measuredHeight = Math.round(element.clientHeight * pixelRatio);

  if (measuredWidth <= 0 || measuredHeight <= 0) {
    return null;
  }

  return {
    width: measuredWidth,
    height: measuredHeight,
  };
}

export function useDevicePixelPreviewSize(options: {
  previewRef: Ref<HTMLElement | null>;
  defaultSize: DevicePixelPreviewSize;
  enabled: MaybeRefOrGetter<boolean>;
}) {
  const previewSize = ref<DevicePixelPreviewSize>({ ...options.defaultSize });
  let resizeObserver: ResizeObserver | null = null;

  function updatePreviewSize(): void {
    const previewElement = options.previewRef.value;

    if (!previewElement) {
      return;
    }

    const measuredSize = measureDevicePixelPreviewSize(previewElement);

    if (!measuredSize) {
      return;
    }

    if (
      previewSize.value.width === measuredSize.width
      && previewSize.value.height === measuredSize.height
    ) {
      return;
    }

    previewSize.value = measuredSize;
  }

  function disconnectPreviewResizeObserver(): void {
    resizeObserver?.disconnect();
    resizeObserver = null;
  }

  function connectPreviewResizeObserver(): void {
    if (resizeObserver || typeof ResizeObserver === 'undefined' || !options.previewRef.value) {
      return;
    }

    resizeObserver = new ResizeObserver(updatePreviewSize);
    resizeObserver.observe(options.previewRef.value);
  }

  watch(
    () => toValue(options.enabled),
    async (enabled) => {
      disconnectPreviewResizeObserver();

      if (!enabled) {
        return;
      }

      await nextTick();

      if (!toValue(options.enabled)) {
        return;
      }

      updatePreviewSize();
      connectPreviewResizeObserver();
    },
    { immediate: true },
  );

  onBeforeUnmount(() => {
    disconnectPreviewResizeObserver();
  });

  return {
    previewSize,
    updatePreviewSize,
    disconnectPreviewResizeObserver,
    connectPreviewResizeObserver,
  };
}
