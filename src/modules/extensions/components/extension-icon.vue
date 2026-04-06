<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { BlocksIcon } from '@lucide/vue';
import { getExtensionAssetUrl } from '@/data/extensions';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

const props = withDefaults(defineProps<{
  extensionId: string;
  iconPath?: string;
  repository?: string;
  version?: string | null;
  isInstalled?: boolean;
  size?: number;
  cacheKey?: string | number;
}>(), {
  iconPath: undefined,
  repository: undefined,
  version: null,
  isInstalled: false,
  size: 24,
  cacheKey: undefined,
});

const displayIconUrl = ref<string | null>(null);
const hasError = ref(false);
const resolveGeneration = ref(0);

const styleObject = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

function withCacheKey(url: string): string {
  return props.cacheKey ? `${url}?t=${props.cacheKey}` : url;
}

function revokeBlobUrlIfNeeded(url: string | null) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function setDisplayIconUrl(next: string | null) {
  const previous = displayIconUrl.value;
  displayIconUrl.value = next;

  if (previous && previous !== next) {
    revokeBlobUrlIfNeeded(previous);
  }
}

async function loadImageIntoBlobObjectUrl(sourceUrl: string): Promise<string | null> {
  try {
    const response = await fetch(sourceUrl, {
      mode: 'cors',
      credentials: 'omit',
      cache: 'default',
    });

    if (!response.ok) {
      return null;
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob).catch(() => null);

    if (bitmap) {
      bitmap.close();
    }

    return URL.createObjectURL(blob);
  }
  catch {
    return new Promise((resolve) => {
      const image = new Image();

      if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
        image.crossOrigin = 'anonymous';
      }

      image.onload = () => {
        image
          .decode()
          .then(() => resolve(sourceUrl))
          .catch(() => resolve(sourceUrl));
      };

      image.onerror = () => resolve(null);
      image.src = sourceUrl;
    });
  }
}

async function resolveIcon() {
  const generation = ++resolveGeneration.value;
  setDisplayIconUrl(null);
  hasError.value = false;

  if (!props.iconPath) return;

  const trimmedPath = props.iconPath.trim();

  if (!trimmedPath) return;

  let candidateUrl: string | null = null;

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    candidateUrl = withCacheKey(trimmedPath);
  }
  else if (!props.isInstalled && props.repository) {
    const versionOrBranch = props.version ? `v${props.version}` : 'main';
    const assetUrl = getExtensionAssetUrl(props.repository, versionOrBranch, trimmedPath);
    candidateUrl = withCacheKey(assetUrl);
  }
  else {
    try {
      const extensionPath = await invokeAsExtension<string>(props.extensionId, 'get_extension_path', {
        extensionId: props.extensionId,
      });
      const fullPath = `${extensionPath}/${trimmedPath}`;
      const exists = await invoke<boolean>('path_exists', { path: fullPath });

      if (!exists) return;

      const assetUrl = convertFileSrc(fullPath);
      candidateUrl = withCacheKey(assetUrl);
    }
    catch {
      if (!props.repository) {
        return;
      }

      const versionOrBranch = props.version ? `v${props.version}` : 'main';
      const assetUrl = getExtensionAssetUrl(props.repository, versionOrBranch, trimmedPath);
      candidateUrl = withCacheKey(assetUrl);
    }
  }

  if (generation !== resolveGeneration.value || !candidateUrl) return;

  const objectUrl = await loadImageIntoBlobObjectUrl(candidateUrl);

  if (generation !== resolveGeneration.value) {
    revokeBlobUrlIfNeeded(objectUrl);
    return;
  }

  if (objectUrl) {
    setDisplayIconUrl(objectUrl);
  }
  else {
    hasError.value = true;
  }
}

function handleImageError() {
  hasError.value = true;
  setDisplayIconUrl(null);
}

watch(
  () => [props.extensionId, props.iconPath, props.repository, props.version, props.isInstalled, props.cacheKey],
  () => resolveIcon(),
  { immediate: true },
);

onBeforeUnmount(() => {
  setDisplayIconUrl(null);
});
</script>

<template>
  <div
    class="extension-icon"
    :style="styleObject"
  >
    <img
      v-if="displayIconUrl && !hasError"
      :src="displayIconUrl"
      alt=""
      class="extension-icon__image animate-fade-in-x2"
      draggable="false"
      @error="handleImageError"
    >
    <BlocksIcon
      v-else
      class="animate-fade-in"
      :size="size"
    />
  </div>
</template>

<style scoped>
.extension-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.extension-icon__image {
  width: 100%;
  height: 100%;
  border-radius: inherit;
  object-fit: cover;
}
</style>
