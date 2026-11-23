// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { nextTick, reactive } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import ExtensionPage from '@/modules/extensions/pages/extension-page.vue';

const {
  routeMock,
  routerReplaceMock,
  extensionsStoreMock,
} = vi.hoisted(() => ({
  routeMock: {
    name: 'extension-page',
    params: { fullPageId: 'publisher.extension.page' },
  },
  routerReplaceMock: vi.fn(),
  extensionsStoreMock: {
    isInitialized: false,
    sidebarPages: [] as Array<{
      extensionId: string;
      page: {
        id: string;
        url?: string;
      };
    }>,
  },
}));

vi.mock('vue-router', () => ({
  useRoute: () => routeMock,
  useRouter: () => ({ replace: routerReplaceMock }),
}));

const reactiveExtensionsStore = reactive(extensionsStoreMock);

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => reactiveExtensionsStore,
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: vi.fn().mockResolvedValue([]),
}));

vi.mock('@/layouts', () => ({
  PageIframeLayout: {
    template: '<div><slot /></div>',
  },
}));

describe('extension page', () => {
  beforeEach(() => {
    routerReplaceMock.mockReset().mockResolvedValue(undefined);
    reactiveExtensionsStore.isInitialized = false;
    reactiveExtensionsStore.sidebarPages = [];
  });

  it('waits for extensions to load before deciding the page is missing', async () => {
    mount(ExtensionPage);
    await flushPromises();

    expect(routerReplaceMock).not.toHaveBeenCalled();

    reactiveExtensionsStore.sidebarPages = [{
      extensionId: 'publisher.extension',
      page: {
        id: 'publisher.extension.page',
        url: 'https://example.com',
      },
    }];
    reactiveExtensionsStore.isInitialized = true;
    await nextTick();

    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('opens the home page when a restored extension page no longer exists', async () => {
    mount(ExtensionPage);
    await flushPromises();

    reactiveExtensionsStore.isInitialized = true;
    await nextTick();

    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'home' });
  });
});
