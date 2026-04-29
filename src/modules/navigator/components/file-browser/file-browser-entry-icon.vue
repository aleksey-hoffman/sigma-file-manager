<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useNavigatorItemIcon } from '@/composables/use-navigator-item-icon';

const props = defineProps<{
  entry: DirEntry;
  size: number;
}>();

const { iconSrc, fallbackIconComponent } = useNavigatorItemIcon({
  path: () => props.entry.path,
  name: () => props.entry.name,
  isDir: () => props.entry.is_dir,
  extension: () => props.entry.ext,
  size: () => props.size,
});

const rootComponent = computed<Component | 'img'>(() => {
  if (!iconSrc.value) {
    return fallbackIconComponent.value;
  }

  return 'img';
});

const rootProps = computed<Record<string, unknown>>(() => {
  if (rootComponent.value === 'img') {
    return {
      src: iconSrc.value,
      width: props.size,
      height: props.size,
      draggable: false,
    };
  }

  return {
    size: props.size,
  };
});
</script>

<template>
  <component
    :is="rootComponent"
    v-bind="rootProps"
  />
</template>
