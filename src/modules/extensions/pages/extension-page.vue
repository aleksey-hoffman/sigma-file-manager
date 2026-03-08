<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { convertFileSrc, invoke } from '@tauri-apps/api/core';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';
import { PageIframeLayout } from '@/layouts';
import ExtensionEmbed from '@/modules/extensions/components/extension-embed.vue';

defineOptions({ name: 'ExtensionPage' });

const route = useRoute();
const extensionsStore = useExtensionsStore();
const extensionsStorageStore = useExtensionsStorageStore();

const fullPageId = computed(() => route.params.fullPageId as string);

const pageRegistration = computed(() => {
  return extensionsStore.sidebarPages.find(
    registration => registration.page.id === fullPageId.value,
  );
});

const extensionIconPath = computed(() => {
  const registration = pageRegistration.value;
  if (!registration) return undefined;
  const installed = extensionsStorageStore.extensionsData.installedExtensions[registration.extensionId];
  return installed?.manifest?.icon;
});

const rawUrl = computed(() => pageRegistration.value?.page.url ?? '');
const iframeUrl = ref('');
const iframeSrcdoc = ref('');

const isExtensionEmbed = computed(
  () => {
    const reg = pageRegistration.value;
    if (!reg) return false;
    const url = rawUrl.value;
    return !!(url && (url.endsWith('.js') || url === 'embed'));
  },
);

async function resolveIframeContent() {
  const url = rawUrl.value;

  if (!url || url.endsWith('.js') || url === 'embed') {
    iframeUrl.value = '';
    iframeSrcdoc.value = '';
    return;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    iframeUrl.value = url;
    iframeSrcdoc.value = '';
    return;
  }

  const registration = pageRegistration.value;

  if (!registration) {
    iframeUrl.value = url;
    iframeSrcdoc.value = '';
    return;
  }

  try {
    const fileBytes = await invoke<number[]>('read_extension_file', {
      extensionId: registration.extensionId,
      filePath: url.replace(/^\//, ''),
    });
    const html = new TextDecoder().decode(new Uint8Array(fileBytes));
    iframeSrcdoc.value = html;
    iframeUrl.value = '';
  }
  catch {
    const extensionPath = await invoke<string>('get_extension_path', {
      extensionId: registration.extensionId,
    });
    const fullPath = `${extensionPath}/${url.replace(/^\//, '')}`;
    iframeUrl.value = convertFileSrc(fullPath);
    iframeSrcdoc.value = '';
  }
}

watch([rawUrl, fullPageId], resolveIframeContent, { immediate: true });
</script>

<template>
  <PageIframeLayout class="extension-page">
    <ExtensionEmbed
      v-if="isExtensionEmbed && pageRegistration"
      class="extension-page__embed"
      :extension-id="pageRegistration.extensionId"
      :embed-script-path="rawUrl"
      :icon-path="extensionIconPath"
    />
    <div
      v-else
      class="extension-page__iframe-wrapper"
    >
      <iframe
        v-if="iframeUrl || iframeSrcdoc"
        class="extension-page__iframe"
        :src="iframeUrl || undefined"
        :srcdoc="iframeSrcdoc || undefined"
        title=""
      />
    </div>
  </PageIframeLayout>
</template>

<style>
.extension-page {
  display: flex;
  height: 100%;
  flex-direction: column;
}

.extension-page .page-iframe-layout__container {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

.extension-page__embed {
  display: flex;
  overflow: hidden;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  border-radius: var(--radius-sm);
}

.extension-page__iframe-wrapper {
  overflow: hidden;
  min-height: 0;
  flex: 1;
  border-radius: var(--radius-sm);
}

.extension-page__iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: none;
}
</style>
