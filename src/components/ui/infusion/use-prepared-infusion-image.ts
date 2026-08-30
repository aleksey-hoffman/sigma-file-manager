// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';

const INFUSION_RASTER_MAX_DIMENSION = 1200;
const INFUSION_PREPARE_DEBOUNCE_MS = 200;
const INFUSION_RASTER_JPEG_QUALITY = 0.9;

type InfusionRasterSize = {
  width: number;
  height: number;
};

type CoverDrawRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  close: () => void;
};

export type PrepareInfusionImageOptions = {
  src: string;
  containerWidth: number;
  containerHeight: number;
  blur: number;
  contrast: number;
  brightness: number;
  noiseIntensity: number;
  noiseOpacity: number;
  noiseScale: number;
};

type UsePreparedInfusionImageOptions = {
  containerElementRef: Ref<HTMLElement | null>;
  src: () => string;
  type: () => 'image' | 'video';
  blur: () => number;
  contrast: () => number;
  brightness: () => number;
  noiseIntensity: () => number;
  noiseOpacity: () => number;
  noiseScale: () => number;
};

export function getInfusionRasterSize(
  containerWidth: number,
  containerHeight: number,
): InfusionRasterSize | null {
  if (
    !Number.isFinite(containerWidth)
    || !Number.isFinite(containerHeight)
    || containerWidth <= 0
    || containerHeight <= 0
  ) {
    return null;
  }

  const scale = Math.min(
    1,
    INFUSION_RASTER_MAX_DIMENSION / Math.max(containerWidth, containerHeight),
  );

  return {
    width: Math.max(1, Math.round(containerWidth * scale)),
    height: Math.max(1, Math.round(containerHeight * scale)),
  };
}

export function getCoverDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): CoverDrawRect {
  const coverScale = Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * coverScale;
  const height = sourceHeight * coverScale;

  return {
    x: (targetWidth - width) / 2,
    y: (targetHeight - height) / 2,
    width,
    height,
  };
}

async function decodeImageBlob(blob: Blob): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);

    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      close: () => bitmap.close(),
    };
  }

  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();

    return {
      source: image,
      width: image.naturalWidth,
      height: image.naturalHeight,
      close: () => URL.revokeObjectURL(objectUrl),
    };
  }
  catch (error) {
    URL.revokeObjectURL(objectUrl);
    throw error;
  }
}

async function createInfusionRasterDataUrl(
  src: string,
  rasterSize: InfusionRasterSize,
): Promise<string> {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Failed to load infusion image: ${response.status}`);
  }

  const decodedImage = await decodeImageBlob(await response.blob());

  try {
    if (decodedImage.width <= 0 || decodedImage.height <= 0) {
      throw new Error('Infusion image dimensions are invalid');
    }

    const canvas = document.createElement('canvas');
    canvas.width = rasterSize.width;
    canvas.height = rasterSize.height;
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Infusion image canvas is unavailable');
    }

    const drawRect = getCoverDrawRect(
      decodedImage.width,
      decodedImage.height,
      canvas.width,
      canvas.height,
    );
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      decodedImage.source,
      drawRect.x,
      drawRect.y,
      drawRect.width,
      drawRect.height,
    );

    return canvas.toDataURL('image/jpeg', INFUSION_RASTER_JPEG_QUALITY);
  }
  finally {
    decodedImage.close();
  }
}

export async function prepareInfusionImage(
  options: PrepareInfusionImageOptions,
): Promise<string> {
  const rasterSize = getInfusionRasterSize(
    options.containerWidth,
    options.containerHeight,
  );

  if (!rasterSize) {
    throw new Error('Infusion image container dimensions are invalid');
  }

  const imageDataUrl = await createInfusionRasterDataUrl(options.src, rasterSize);
  const rasterScale = Math.min(
    rasterSize.width / options.containerWidth,
    rasterSize.height / options.containerHeight,
  );
  const processedImagePath = await invoke<string>('generate_infusion_image', {
    imageDataUrl,
    blur: Math.max(0, options.blur) * rasterScale,
    contrast: options.contrast,
    brightness: options.brightness,
    noiseStrength: Math.max(0, options.noiseIntensity) * Math.max(0, options.noiseOpacity),
    noiseScale: options.noiseScale,
  });

  return convertFileSrc(processedImagePath);
}

export function usePreparedInfusionImage(options: UsePreparedInfusionImageOptions) {
  const preparedImageSrc = ref('');
  const isPreparingImage = ref(false);
  let prepareTimer: ReturnType<typeof setTimeout> | null = null;
  let preparationGeneration = 0;
  let resizeObserver: ResizeObserver | null = null;

  function cancelPrepareTimer() {
    if (prepareTimer !== null) {
      clearTimeout(prepareTimer);
      prepareTimer = null;
    }
  }

  function schedulePreparation(clearCurrentImage = false) {
    preparationGeneration += 1;
    const generation = preparationGeneration;
    cancelPrepareTimer();

    if (clearCurrentImage) {
      preparedImageSrc.value = '';
    }

    if (options.type() !== 'image' || !options.src()) {
      preparedImageSrc.value = '';
      isPreparingImage.value = false;
      return;
    }

    prepareTimer = setTimeout(async () => {
      prepareTimer = null;
      const containerElement = options.containerElementRef.value;

      if (!containerElement) {
        return;
      }

      isPreparingImage.value = true;

      try {
        const nextImageSrc = await prepareInfusionImage({
          src: options.src(),
          containerWidth: containerElement.clientWidth,
          containerHeight: containerElement.clientHeight,
          blur: options.blur(),
          contrast: options.contrast(),
          brightness: options.brightness(),
          noiseIntensity: options.noiseIntensity(),
          noiseOpacity: options.noiseOpacity(),
          noiseScale: options.noiseScale(),
        });

        if (generation === preparationGeneration) {
          preparedImageSrc.value = nextImageSrc;
        }
      }
      catch {
        if (generation === preparationGeneration) {
          preparedImageSrc.value = '';
        }
      }
      finally {
        if (generation === preparationGeneration) {
          isPreparingImage.value = false;
        }
      }
    }, INFUSION_PREPARE_DEBOUNCE_MS);
  }

  watch(
    [options.src, options.type],
    () => schedulePreparation(true),
  );

  watch(
    [
      options.blur,
      options.contrast,
      options.brightness,
      options.noiseIntensity,
      options.noiseOpacity,
      options.noiseScale,
    ],
    () => schedulePreparation(),
  );

  onMounted(() => {
    const containerElement = options.containerElementRef.value;

    if (containerElement && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => schedulePreparation());
      resizeObserver.observe(containerElement);
    }

    schedulePreparation(true);
  });

  onBeforeUnmount(() => {
    preparationGeneration += 1;
    cancelPrepareTimer();
    resizeObserver?.disconnect();
  });

  return {
    preparedImageSrc,
  };
}
