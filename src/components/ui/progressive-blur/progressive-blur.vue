<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import type { ProgressiveBlurLayer } from './types';

type ProgressiveBlurLayerStyle = CSSProperties & Record<`--${string}`, string>;

const props = withDefaults(defineProps<{
  direction?: string;
  layers: ProgressiveBlurLayer[];
}>(), {
  direction: 'to bottom',
});

function getLayerStyle(layer: ProgressiveBlurLayer): ProgressiveBlurLayerStyle {
  return {
    '--progressive-blur-amount': layer.amount,
    '--progressive-blur-start': layer.start ?? '0%',
    '--progressive-blur-end': layer.end ?? '100%',
    '--progressive-blur-direction': layer.direction ?? props.direction,
  };
}
</script>

<template>
  <div
    class="progressive-blur"
    aria-hidden="true"
  >
    <div
      v-for="(layer, layerIndex) in layers"
      :key="`${layer.amount}-${layer.start ?? '0%'}-${layer.end ?? '100%'}-${layerIndex}`"
      class="progressive-blur__layer"
      :style="getLayerStyle(layer)"
    />
  </div>
</template>
