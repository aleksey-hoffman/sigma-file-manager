// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useExtensionsStore } from '@/stores/runtime/extensions';
import { useExtensionsStorageStore } from '@/stores/storage/extensions';

function isEmbedUrl(url: string): boolean {
  return url.endsWith('.js') || url === 'embed';
}

export function useEmbedPages() {
  const route = useRoute();
  const extensionsStore = useExtensionsStore();
  const extensionsStorageStore = useExtensionsStorageStore();

  const visitedEmbedPageIds = ref(new Set<string>());

  const activeEmbedPageId = computed<string | null>(() => {
    if (route.name !== 'extension-page') return null;
    const fullPageId = route.params.fullPageId as string;
    const registration = extensionsStore.sidebarPages.find(
      reg => reg.page.id === fullPageId,
    );
    if (!registration) return null;
    const url = registration.page.url ?? '';
    return isEmbedUrl(url) ? fullPageId : null;
  });

  watch(activeEmbedPageId, (pageId) => {
    if (pageId) {
      visitedEmbedPageIds.value.add(pageId);
    }
  });

  const visitedEmbedPages = computed(() => {
    return Array.from(visitedEmbedPageIds.value)
      .map((pageId) => {
        const registration = extensionsStore.sidebarPages.find(
          reg => reg.page.id === pageId,
        );
        if (!registration) return null;
        const installed = extensionsStorageStore.extensionsData.installedExtensions[registration.extensionId];
        return {
          pageId,
          extensionId: registration.extensionId,
          url: registration.page.url ?? '',
          iconPath: installed?.manifest?.icon,
        };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
  });

  return {
    activeEmbedPageId,
    visitedEmbedPages,
  };
}
