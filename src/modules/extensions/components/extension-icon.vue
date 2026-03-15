<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { BlocksIcon } from 'lucide-vue-next';
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

const resolvedIconUrl = ref<string | null>(null);
const hasError = ref(false);

const styleObject = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
}));

async function resolveIcon() {
  resolvedIconUrl.value = null;
  hasError.value = false;

  if (!props.iconPath) return;

  const trimmedPath = props.iconPath.trim();

  if (!trimmedPath) return;

  if (trimmedPath.startsWith('http://') || trimmedPath.startsWith('https://')) {
    resolvedIconUrl.value = props.cacheKey ? `${trimmedPath}?t=${props.cacheKey}` : trimmedPath;
    return;
  }

  if (!props.isInstalled && props.repository) {
    const versionOrBranch = props.version ? `v${props.version}` : 'main';
    const assetUrl = getExtensionAssetUrl(props.repository, versionOrBranch, trimmedPath);
    resolvedIconUrl.value = props.cacheKey ? `${assetUrl}?t=${props.cacheKey}` : assetUrl;
    return;
  }

  try {
    const extensionPath = await invokeAsExtension<string>(props.extensionId, 'get_extension_path', {
      extensionId: props.extensionId,
    });
    const fullPath = `${extensionPath}/${trimmedPath}`;
    const exists = await invoke<boolean>('path_exists', { path: fullPath });

    if (!exists) return;

    const assetUrl = convertFileSrc(fullPath);
    resolvedIconUrl.value = props.cacheKey ? `${assetUrl}?t=${props.cacheKey}` : assetUrl;
  }
  catch {
    if (!props.repository) {
      resolvedIconUrl.value = null;
      return;
    }

    const versionOrBranch = props.version ? `v${props.version}` : 'main';
    const assetUrl = getExtensionAssetUrl(props.repository, versionOrBranch, trimmedPath);
    resolvedIconUrl.value = props.cacheKey ? `${assetUrl}?t=${props.cacheKey}` : assetUrl;
  }
}

function handleImageError() {
  hasError.value = true;
}

function handleImageLoad() {
  hasError.value = false;
}

watch(
  () => [props.extensionId, props.iconPath, props.repository, props.version, props.isInstalled, props.cacheKey],
  () => resolveIcon(),
  { immediate: true },
);
</script>

<template>
  <div
    class="extension-icon"
    :style="styleObject"
  >
    <img
      v-if="resolvedIconUrl && !hasError"
      :src="resolvedIconUrl"
      alt=""
      class="extension-icon__image"
      draggable="false"
      @error="handleImageError"
      @load="handleImageLoad"
    >
    <BlocksIcon
      v-else
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
