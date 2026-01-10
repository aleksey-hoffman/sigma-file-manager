<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import type { Component } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { getFileIcon } from './utils';
import { useUserSettingsStore } from '@/stores/storage/user-settings';

const systemIconCache = new Map<string, string | null>();
const systemIconInFlight = new Map<string, Promise<string | null>>();

const props = defineProps<{
  entry: DirEntry;
  size: number;
}>();

const userSettingsStore = useUserSettingsStore();
const useSystemIconsForDirectories = computed(() => userSettingsStore.userSettings.navigator.useSystemIconsForDirectories);
const useSystemIconsForFiles = computed(() => userSettingsStore.userSettings.navigator.useSystemIconsForFiles);

const useSystemIcons = computed(() => (
  props.entry.is_dir ? useSystemIconsForDirectories.value : useSystemIconsForFiles.value
));

const systemIconSrc = ref<string | null>(null);

const cacheKey = computed(() => {
  if (props.entry.is_dir) {
    return `dir:${props.size}`;
  }

  const extensionKey = (props.entry.ext || '').toLowerCase();
  return `ext:${extensionKey}:${props.size}`;
});

async function getSystemIconDataUrl(): Promise<string | null> {
  const iconSize = Math.max(8, Math.min(256, Math.round(props.size)));
  const cached = systemIconCache.get(cacheKey.value);

  if (cached !== undefined) {
    return cached;
  }

  const existingRequest = systemIconInFlight.get(cacheKey.value);

  if (existingRequest) {
    return await existingRequest;
  }

  const requestPromise = invoke<string | null>('get_system_icon', {
    path: props.entry.path,
    isDir: props.entry.is_dir,
    extension: props.entry.ext,
    size: iconSize,
  })
    .then((result) => {
      systemIconCache.set(cacheKey.value, result);
      return result;
    })
    .catch(() => {
      systemIconCache.set(cacheKey.value, null);
      return null;
    })
    .finally(() => {
      systemIconInFlight.delete(cacheKey.value);
    });

  systemIconInFlight.set(cacheKey.value, requestPromise);
  return await requestPromise;
}

watchEffect(async () => {
  if (!useSystemIcons.value) {
    systemIconSrc.value = null;
    return;
  }

  systemIconSrc.value = await getSystemIconDataUrl();
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
