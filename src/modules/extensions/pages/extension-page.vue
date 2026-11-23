<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { PageIframeLayout } from '@/layouts';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';
import {
  EXTENSION_PAGE_CSP,
  EXTENSION_PAGE_SANDBOX,
  isAllowedRemotePageUrl,
  REMOTE_PAGE_SANDBOX,
  withContentSecurityPolicy,
} from '@/modules/extensions/runtime/extension-frame-policy';

type IframeContent = {
  url?: string;
  srcdoc?: string;
};

defineOptions({ name: 'ExtensionPage' });

const route = useRoute();
const router = useRouter();
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
const iframeKey = ref(0);

const isExtensionEmbed = computed(() => {
  const url = rawUrl.value;
  return !!(url && (url.endsWith('.js') || url === 'embed'));
});

const iframeSandbox = computed(() => iframeUrl.value ? REMOTE_PAGE_SANDBOX : EXTENSION_PAGE_SANDBOX);

function showIframeContent(content: IframeContent) {
  iframeUrl.value = content.url ?? '';
  iframeSrcdoc.value = content.srcdoc ?? '';
  iframeKey.value += 1;
}

async function resolveIframeContent() {
  const url = rawUrl.value;
  const registration = pageRegistration.value;

  if (!url || url.endsWith('.js') || url === 'embed' || !registration) {
    showIframeContent({});
    return;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    showIframeContent(isAllowedRemotePageUrl(url, window.location.origin) ? { url } : {});
    return;
  }

  try {
    const fileBytes = await invokeAsExtension<number[]>(registration.extensionId, 'read_extension_file', {
      extensionId: registration.extensionId,
      filePath: url.replace(/^\//, ''),
    });
    const html = new TextDecoder().decode(new Uint8Array(fileBytes));
    showIframeContent({ srcdoc: withContentSecurityPolicy(html, EXTENSION_PAGE_CSP) });
  }
  catch (error) {
    console.error(`Failed to load extension page ${url}:`, error);
    showIframeContent({});
  }
}

watch([rawUrl, fullPageId], resolveIframeContent, { immediate: true });

watch(
  () => extensionsStore.isInitialized && !pageRegistration.value,
  (pageIsMissing) => {
    if (pageIsMissing && route.name === 'extension-page') {
      void router.replace({ name: 'home' });
    }
  },
  { immediate: true },
);
</script>

<template>
  <PageIframeLayout
    v-if="!isExtensionEmbed"
    class="extension-page"
  >
    <div class="extension-page__iframe-wrapper">
      <iframe
        v-if="iframeUrl || iframeSrcdoc"
        :key="iframeKey"
        :sandbox="iframeSandbox"
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
