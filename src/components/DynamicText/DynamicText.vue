<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {computed} from 'vue';

interface Props {
  height: number;
  fontSize?: number;
  minFontSize?: number;
  maxFontSize?: number;
}

const props = withDefaults(defineProps<Props>(), {
  minFontSize: 12,
  maxFontSize: 16
});

const fontSizeRatio = 0.35;
const minFontSize = computed(() => props.minFontSize || 12);
const maxFontSize = computed(() => props.maxFontSize || 16);
const autoCalculatedSize = computed(() => Math.min(Math.max(Math.round(props.height * fontSizeRatio), minFontSize.value), maxFontSize.value));
const fontSize = computed(() => props.fontSize || autoCalculatedSize.value);
</script>

<template>
  <div :style="`font-size: ${fontSize}px`">
    <slot />
  </div>
</template>