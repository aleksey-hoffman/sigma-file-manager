<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {
  ref, onMounted, onUnmounted, onActivated, onDeactivated,
} from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from 'vue-i18n';
import { getExtensionAPI } from '@/modules/extensions/runtime/loader';
import ExtensionIcon from '@/modules/extensions/components/extension-icon.vue';

const props = defineProps<{
  extensionId: string;
  embedScriptPath: string;
  iconPath?: string;
}>();

const { t } = useI18n();
const containerRef = ref<HTMLDivElement | null>(null);
const toolbarRef = ref<HTMLDivElement | null>(null);
const isReady = ref(false);
let unmountFn: (() => void) | null = null;

async function mountEmbed() {
  const target = document.querySelector('.window-toolbar-extension-embed-teleport-target');
  const toolbarContainer = toolbarRef.value;

  if (target) {
    target.replaceChildren();

    if (toolbarContainer) target.appendChild(toolbarContainer);
  }

  const container = containerRef.value;
  if (!container) return;

  const fileBytes = await invoke<number[]>('read_extension_file', {
    extensionId: props.extensionId,
    filePath: props.embedScriptPath,
  });
  const scriptText = new TextDecoder().decode(new Uint8Array(fileBytes));
  const blob = new Blob([scriptText], { type: 'application/javascript' });
  const scriptUrl = URL.createObjectURL(blob);

  try {
    const mod = await import(/* @vite-ignore */ scriptUrl);
    if (typeof mod.mount !== 'function') throw new Error('Extension embed script must export mount(container, context)');
    const sigma = getExtensionAPI(props.extensionId);
    unmountFn = await mod.mount(container, {
      extensionId: props.extensionId,
      sigma,
      toolbarContainer: toolbarRef.value ?? undefined,
    });

    isReady.value = true;
  }
  finally {
    URL.revokeObjectURL(scriptUrl);
  }
}

function unmountEmbed() {
  unmountFn?.();
  unmountFn = null;
  isReady.value = false;
}

onMounted(() => {
  mountEmbed();
});

const ACTIVATION_LOADER_MS = 400;
let activationTimer: ReturnType<typeof setTimeout> | null = null;

onActivated(() => {
  isReady.value = false;
  activationTimer = setTimeout(() => {
    activationTimer = null;
    isReady.value = true;
  }, ACTIVATION_LOADER_MS);
});

onDeactivated(() => {
  if (activationTimer) {
    clearTimeout(activationTimer);
    activationTimer = null;
  }

  isReady.value = false;

  const target = document.querySelector('.window-toolbar-extension-embed-teleport-target');

  if (target) target.replaceChildren();
});

onUnmounted(() => {
  unmountEmbed();
});
</script>

<template>
  <div class="extension-embed">
    <Teleport to=".window-toolbar-extension-embed-teleport-target">
      <div
        ref="toolbarRef"
        class="extension-embed__toolbar"
      />
    </Teleport>
    <div class="extension-embed__content-wrapper">
      <div class="extension-embed__content-spacer" />
      <div
        ref="containerRef"
        class="extension-embed__content"
      />
      <Transition name="extension-embed-loader">
        <div
          v-if="!isReady"
          class="extension-embed__loader"
        >
          <div class="extension-embed__loader-icon-wrap">
            <ExtensionIcon
              :extension-id="extensionId"
              :icon-path="iconPath"
              :size="48"
            />
          </div>
          <p class="extension-embed__loader-text">
            {{ t('extensions.loadingExtension') }}
          </p>
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
.extension-embed {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.extension-embed__toolbar {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 12px;
}

.extension-embed__content-wrapper {
  position: relative;
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border-radius: var(--radius-sm);
}

.extension-embed__content-spacer {
  min-height: 0;
  flex: 1;
}

.extension-embed__content {
  position: absolute;
  z-index: 0;
  overflow: hidden;
  inset: 0;
}

.extension-embed__loader {
  position: absolute;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background: var(--color-background);
  gap: 16px;
  inset: 0;
}

.extension-embed__loader-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
}

.extension-embed__loader-text {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: 0.875rem;
}

.extension-embed-loader-enter-active {
  transition: none;
}

.extension-embed-loader-leave-active {
  transition: opacity 0.2s ease;
}

.extension-embed-loader-leave-to {
  opacity: 0;
}
</style>
