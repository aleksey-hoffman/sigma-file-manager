<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch, type CSSProperties } from 'vue';
import { usePreparedInfusionImage } from './use-prepared-infusion-image';

interface Props {
  src: string;
  opacity?: number;
  opacityDark?: number;
  zIndex?: number;
  blur?: number;
  noiseIntensity?: number;
  noiseScale?: number;
  noiseOpacity?: number;
  mediaContrast?: number;
  mediaBrightness?: number;
  blendMode?: CSSProperties['mixBlendMode'];
  relative?: boolean;
  type?: 'image' | 'video';
  pausePlayback?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  src: '',
  opacity: 0.2,
  opacityDark: 0.3,
  zIndex: 100,
  blur: 64,
  noiseIntensity: 0.5,
  noiseScale: 1,
  noiseOpacity: 0.05,
  mediaContrast: 100,
  mediaBrightness: 100,
  blendMode: 'normal',
  relative: false,
  type: 'image',
  pausePlayback: false,
});

const videoElementRef = ref<HTMLVideoElement | null>(null);
const containerElementRef = ref<HTMLDivElement | null>(null);

const { preparedImageSrc } = usePreparedInfusionImage({
  containerElementRef,
  src: () => props.src,
  type: () => props.type,
  blur: () => props.blur,
  contrast: () => props.mediaContrast,
  brightness: () => props.mediaBrightness,
  noiseIntensity: () => props.noiseIntensity,
  noiseOpacity: () => props.noiseOpacity,
  noiseScale: () => props.noiseScale,
});

watch(
  [() => props.pausePlayback, videoElementRef, () => props.type, () => props.src],
  ([pausePlayback]) => {
    const videoElement = videoElementRef.value;

    if (!videoElement || props.type !== 'video') {
      return;
    }

    if (pausePlayback) {
      videoElement.pause();
    }
    else {
      void videoElement.play().catch(() => {});
    }
  },
  { immediate: true },
);

const hasMediaFilter = computed(() => {
  return props.blur > 0 || props.mediaContrast !== 100 || props.mediaBrightness !== 100;
});

const imageStyle = computed(() => ({
  '--infusion-opacity': props.opacity,
  '--infusion-opacity-dark': props.opacityDark,
  '--infusion-z-index': props.zIndex,
  '--infusion-blur': `${Math.max(0, props.blur)}px`,
  '--infusion-noise-intensity': props.noiseIntensity,
  '--infusion-noise-scale': props.noiseScale,
  '--infusion-noise-opacity': props.noiseOpacity,
  '--infusion-media-contrast': `${props.mediaContrast}%`,
  '--infusion-media-brightness': `${props.mediaBrightness}%`,
  'mixBlendMode': props.blendMode,
}));

const noiseDataUrl = computed(() => {
  if (props.noiseIntensity === 0) {
    return '';
  }

  if (typeof document === 'undefined') {
    return '';
  }

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');

  if (!context) {
    return '';
  }

  const imageData = context.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  for (let index = 0; index < data.length; index += 4) {
    const value = Math.random() * 255;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
    data[index + 3] = props.noiseIntensity * 255;
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
});

const containerClass = computed(() => [
  'infusion-container',
  {
    'infusion-container--relative': props.relative,
  },
]);
</script>

<template>
  <div
    ref="containerElementRef"
    :class="containerClass"
    :style="imageStyle"
  >
    <img
      v-if="props.type === 'image' && preparedImageSrc"
      class="infusion-image"
      :src="preparedImageSrc"
      alt=""
    >
    <video
      v-if="props.type === 'video'"
      ref="videoElementRef"
      class="infusion-video"
      :class="{ 'infusion-media--filtered': hasMediaFilter }"
      :src="props.src"
      autoplay
      loop
      muted
      playsinline
      alt=""
    />
    <div
      v-if="props.type === 'video' && noiseIntensity > 0"
      class="infusion-noise"
      :style="{ backgroundImage: `url(${noiseDataUrl})` }"
    />
  </div>
</template>

<style scoped>
.infusion-container {
  position: fixed;
  z-index: var(--infusion-z-index);
  top: 0;
  left: 0;
  overflow: hidden;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}

.infusion-container--relative {
  position: absolute;
  z-index: var(--infusion-z-index);
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.infusion-image,
.infusion-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: var(--infusion-opacity);
  transform: scale(1.1);
}

.dark .infusion-image {
  opacity: var(--infusion-opacity-dark);
}

.dark .infusion-video {
  opacity: var(--infusion-opacity-dark);
}

.infusion-noise {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-repeat: repeat;
  background-size: calc(256px * var(--infusion-noise-scale));
  mix-blend-mode: overlay;
  opacity: var(--infusion-noise-opacity);
}
</style>
