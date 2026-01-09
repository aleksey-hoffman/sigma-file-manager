<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, type CSSProperties } from 'vue';

interface Props {
  src: string;
  opacity?: number;
  opacityDark?: number;
  zIndex?: number;
  blur?: number;
  noiseIntensity?: number;
  noiseScale?: number;
  noiseOpacity?: number;
  blendMode?: CSSProperties['mixBlendMode'];
  relative?: boolean;
  type?: 'image' | 'video';
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
  blendMode: 'normal',
  relative: false,
  type: 'image',
});

const imageStyle = computed(() => ({
  '--infusion-opacity': props.opacity,
  '--infusion-opacity-dark': props.opacityDark,
  '--infusion-z-index': props.zIndex,
  '--infusion-blur': `${props.blur}px`,
  '--infusion-noise-intensity': props.noiseIntensity,
  '--infusion-noise-scale': props.noiseScale,
  '--infusion-noise-opacity': props.noiseOpacity,
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
    :class="containerClass"
    :style="imageStyle"
  >
    <img
      v-if="props.type === 'image'"
      class="infusion-image"
      :src="props.src"
      alt=""
    >
    <video
      v-if="props.type === 'video'"
      class="infusion-video"
      :src="props.src"
      autoplay
      loop
      muted
      playsinline
      alt=""
    />
    <div
      v-if="noiseIntensity > 0"
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

.infusion-image {
  width: 100%;
  height: 100%;
  filter: blur(var(--infusion-blur));
  object-fit: cover;
  opacity: var(--infusion-opacity);
  transform: scale(1.1)
}

.dark .infusion-image {
  opacity: var(--infusion-opacity-dark);
}

.infusion-video {
  width: 100%;
  height: 100%;
  filter: blur(var(--infusion-blur));
  object-fit: cover;
  opacity: var(--infusion-opacity);
  transform: scale(1.1)
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
