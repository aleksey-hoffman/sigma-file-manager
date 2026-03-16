<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import type { Component } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { getFileIcon } from './utils';
import { useSystemIcon } from '@/composables/use-system-icon';

const props = defineProps<{
  entry: DirEntry;
  size: number;
}>();

const { systemIconSrc, useSystemIcons } = useSystemIcon({
  path: () => props.entry.path,
  isDir: () => props.entry.is_dir,
  extension: () => props.entry.ext,
  size: () => props.size,
});

const fallbackIconComponent = computed<Component>(() => getFileIcon(props.entry));

const rootComponent = computed<Component | 'img'>(() => {
  if (!useSystemIcons.value || !systemIconSrc.value) {
    return fallbackIconComponent.value;
  }

  return 'img';
});

const rootProps = computed<Record<string, unknown>>(() => {
  if (rootComponent.value === 'img') {
    return {
      src: systemIconSrc.value,
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
