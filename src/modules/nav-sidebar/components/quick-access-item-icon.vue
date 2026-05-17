<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';

const props = defineProps<{
  path: string;
  isFile: boolean;
  size: number;
}>();

const extension = computed(() => {
  if (!props.isFile) return null;
  const lastDot = props.path.lastIndexOf('.');
  const lastSlash = Math.max(props.path.lastIndexOf('/'), props.path.lastIndexOf('\\'));
  if (lastDot <= 0 || lastDot < lastSlash) return null;
  return props.path.substring(lastDot + 1);
});

const { iconSrc, fallbackIconComponent } = useNavigatorItemIcon({
  path: () => props.path,
  isDir: () => !props.isFile,
  extension: () => extension.value,
  size: () => props.size,
});
</script>

<template>
  <img
    v-if="iconSrc"
    :src="iconSrc"
    :width="size"
    :height="size"
    draggable="false"
    class="quick-access-panel__item-icon"
  >
  <component
    :is="fallbackIconComponent"
    v-else
    :size="size"
    class="quick-access-panel__item-icon"
  />
</template>
