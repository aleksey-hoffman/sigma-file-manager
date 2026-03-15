<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { convertFileSrc } from '@tauri-apps/api/core';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { PageIframeLayout } from '@/layouts';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

defineOptions({ name: 'ExtensionPage' });

const route = useRoute();
const extensionsStore = useExtensionsStore();

const fullPageId = computed(() => route.params.fullPageId as string);

const pageRegistration = computed(() => {
  return extensionsStore.sidebarPages.find(
    registration => registration.page.id === fullPageId.value,
  );
});

const rawUrl = computed(() => pageRegistration.value?.page.url ?? '');
const iframeUrl = ref('');
const iframeSrcdoc = ref('');

const isExtensionEmbed = computed(() => {
  const url = rawUrl.value;
  return !!(url && (url.endsWith('.js') || url === 'embed'));
});

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
    const fileBytes = await invokeAsExtension<number[]>(registration.extensionId, 'read_extension_file', {
      extensionId: registration.extensionId,
      filePath: url.replace(/^\//, ''),
    });
    const html = new TextDecoder().decode(new Uint8Array(fileBytes));
    iframeSrcdoc.value = html;
    iframeUrl.value = '';
  }
  catch {
    const extensionPath = await invokeAsExtension<string>(registration.extensionId, 'get_extension_path', {
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
  <PageIframeLayout
    v-if="!isExtensionEmbed"
    class="extension-page"
  >
    <div class="extension-page__iframe-wrapper">
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
