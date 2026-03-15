<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { createApp, onMounted, onUnmounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import ExtensionIcon from '@/modules/extensions/components/extension-icon.vue';
import ExtensionToolbarView from '@/modules/extensions/components/extension-toolbar-view.vue';
import { getExtensionAPI } from '@/modules/extensions/runtime/loader';
import { createExtensionApiMethodMap } from '@/modules/extensions/runtime/api-method-map';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';
import embedBridgeScript from '@/modules/extensions/runtime/embed-bridge.js?raw';

const props = withDefaults(defineProps<{
  extensionId: string;
  embedScriptPath: string;
  iconPath?: string;
  isActive?: boolean;
}>(), {
  iconPath: undefined,
  isActive: true,
});

const { t } = useI18n();
const toolbarRef = ref<HTMLDivElement | null>(null);
const iframeRef = ref<HTMLIFrameElement | null>(null);
const isReady = ref(false);
const bridgeToken = `embed-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
let toolbarApp: ReturnType<typeof createApp> | null = null;
let activeToolbarId: string | null = null;

function clearToolbar() {
  if (toolbarApp) {
    toolbarApp.unmount();
    toolbarApp = null;
  }

  toolbarRef.value?.replaceChildren();
  activeToolbarId = null;
}

function postMessageToEmbed(message: Record<string, unknown>) {
  iframeRef.value?.contentWindow?.postMessage({
    ...message,
    bridgeToken,
  }, '*');
}

function handleToolbarRender(toolbarId: string, elements: unknown[]) {
  const container = toolbarRef.value;

  if (!container) {
    return;
  }

  clearToolbar();
  activeToolbarId = toolbarId;
  toolbarApp = createApp(ExtensionToolbarView, {
    elements,
    onButtonClick: (buttonId: string) => {
      postMessageToEmbed({
        type: 'toolbar-click',
        toolbarId,
        buttonId,
      });
    },
  });
  toolbarApp.mount(container);
}

function createEmbedSrcdoc(scriptSource: string): string {
  const runtimeConstants = [
    `const bridgeToken = ${JSON.stringify(bridgeToken)};`,
    `const scriptSource = ${JSON.stringify(scriptSource)};`,
    `const extensionId = ${JSON.stringify(props.extensionId)};`,
  ].join('\n');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self' data: blob: filesystem: https: http:; style-src 'self' 'unsafe-inline' data: blob: https: http:; img-src 'self' data: blob: filesystem: https: http:; font-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: filesystem: https: http:; connect-src 'self' data: blob: filesystem: https: http:;"
    >
    <style>
      html, body, #app {
        width: 100%;
        height: 100%;
        margin: 0;
        padding: 0;
        overflow: hidden;
        background: transparent;
      }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module">
${runtimeConstants}
${embedBridgeScript}
    <\/script>
  </body>
</html>`;
}

function handleMessage(event: MessageEvent) {
  if (event.source !== iframeRef.value?.contentWindow) {
    return;
  }

  const message = event.data as {
    bridgeToken?: string;
    type?: string;
    id?: string;
    method?: string;
    args?: unknown[];
    toolbarId?: string;
    buttonId?: string;
    elements?: unknown[];
    stage?: string;
    detail?: string;
    message?: string;
  };

  if (!message || message.bridgeToken !== bridgeToken) {
    return;
  }

  if (message.type === 'embed-ready') {
    isReady.value = true;
    return;
  }

  if (message.type === 'render-toolbar' && message.toolbarId) {
    handleToolbarRender(message.toolbarId, message.elements ?? []);
    return;
  }

  if (message.type === 'unmount-toolbar') {
    if (!message.toolbarId || message.toolbarId === activeToolbarId) {
      clearToolbar();
    }

    return;
  }

  if (message.type === 'api-call' && message.id && message.method) {
    const api = getExtensionAPI(props.extensionId);
    const methodMap = api ? createExtensionApiMethodMap(api) : null;
    const handler = methodMap?.[message.method];

    if (!handler) {
      postMessageToEmbed({
        type: 'api-response',
        id: message.id,
        error: `Extension API method is not allowed: ${message.method}`,
      });
      return;
    }

    Promise.resolve(handler(...(message.args ?? []))).then((result) => {
      postMessageToEmbed({
        type: 'api-response',
        id: message.id,
        result,
      });
    }).catch((error) => {
      postMessageToEmbed({
        type: 'api-response',
        id: message.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }
}

async function mountEmbed() {
  clearToolbar();
  isReady.value = false;

  const scriptPath = props.embedScriptPath.replace(/^\//, '');
  const fileBytes = await invokeAsExtension<number[]>(props.extensionId, 'read_extension_file', {
    extensionId: props.extensionId,
    filePath: scriptPath,
  });
  const scriptSource = new TextDecoder().decode(new Uint8Array(fileBytes));

  if (iframeRef.value) {
    iframeRef.value.srcdoc = createEmbedSrcdoc(scriptSource);
  }
}

function unmountEmbed() {
  clearToolbar();
  isReady.value = false;
}

onMounted(() => {
  window.addEventListener('message', handleMessage);
  void mountEmbed();
});

onUnmounted(() => {
  window.removeEventListener('message', handleMessage);
  unmountEmbed();
});
</script>

<template>
  <div class="extension-embed">
    <Teleport to=".window-toolbar-extension-embed-teleport-target">
      <div
        v-show="isActive"
        ref="toolbarRef"
        class="extension-embed__toolbar"
      />
    </Teleport>
    <div class="extension-embed__content-wrapper">
      <div class="extension-embed__content-spacer" />
      <iframe
        ref="iframeRef"
        class="extension-embed__content"
        sandbox="allow-scripts"
        allow="clipboard-write; clipboard-read"
        title=""
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
  display: block;
  overflow: hidden;
  width: 100%;
  height: 100%;
  border: none;
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
