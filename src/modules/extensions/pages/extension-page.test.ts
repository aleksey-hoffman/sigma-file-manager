// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { nextTick, reactive } from 'vue';
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils';
import ExtensionPage from '@/modules/extensions/pages/extension-page.vue';
import { EXTENSION_PAGE_CSP } from '@/modules/extensions/runtime/extension-frame-policy';

type SidebarPageRegistration = {
  extensionId: string;
  page: {
    id: string;
    url?: string;
  };
};

const {
  invokeAsExtensionMock,
  routerReplaceMock,
} = vi.hoisted(() => ({
  invokeAsExtensionMock: vi.fn(),
  routerReplaceMock: vi.fn(),
}));

const extensionsStoreMock = reactive({
  isInitialized: false,
  sidebarPages: [] as SidebarPageRegistration[],
});

vi.mock('vue-router', () => ({
  useRoute: () => ({
    name: 'extension-page',
    params: { fullPageId: 'test.page' },
  }),
  useRouter: () => ({ replace: routerReplaceMock }),
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => extensionsStoreMock,
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@/layouts', () => ({
  PageIframeLayout: { template: '<div><slot /></div>' },
}));

function registerPage(url: string) {
  extensionsStoreMock.sidebarPages = [{
    extensionId: 'test.extension',
    page: {
      id: 'test.page',
      url,
    },
  }];
}

async function mountPage() {
  const wrapper = mount(ExtensionPage);
  await flushPromises();
  return wrapper;
}

describe('extension page', () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    invokeAsExtensionMock.mockReset();
    routerReplaceMock.mockReset().mockResolvedValue(undefined);
    extensionsStoreMock.isInitialized = false;
    extensionsStoreMock.sidebarPages = [];
  });

  it('renders extension HTML in an opaque-origin sandbox with the page policy', async () => {
    registerPage('page.html');
    invokeAsExtensionMock.mockResolvedValue(Array.from(new TextEncoder().encode('<!DOCTYPE html><p>Hello</p>')));

    const iframe = (await mountPage()).find('iframe');

    expect(iframe.attributes('sandbox')).toBe('allow-scripts');
    expect(iframe.attributes('src')).toBeUndefined();
    expect(iframe.attributes('srcdoc')).toContain(EXTENSION_PAGE_CSP);
    expect(iframe.attributes('srcdoc')).toContain('<p>Hello</p>');
  });

  it('shows nothing when the page file cannot be read instead of loading it from the asset protocol', async () => {
    registerPage('page.html');
    invokeAsExtensionMock.mockRejectedValue(new Error('Path is not a file'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const wrapper = await mountPage();

    expect(wrapper.find('iframe').exists()).toBe(false);
    expect(invokeAsExtensionMock).toHaveBeenCalledTimes(1);
  });

  it('sandboxes a remote page without giving it the app origin', async () => {
    registerPage('https://example.com/tool');

    const iframe = (await mountPage()).find('iframe');

    expect(iframe.attributes('src')).toBe('https://example.com/tool');
    expect(iframe.attributes('sandbox')).toBe('allow-scripts allow-same-origin allow-forms');
  });

  it('refuses a page on a Tauri protocol host', async () => {
    registerPage('http://asset.localhost/C:/Users/someone/page.html');

    const wrapper = await mountPage();

    expect(wrapper.find('iframe').exists()).toBe(false);
  });

  it('waits for extensions to load before deciding the page is missing', async () => {
    await mountPage();

    expect(routerReplaceMock).not.toHaveBeenCalled();

    registerPage('https://example.com/tool');
    extensionsStoreMock.isInitialized = true;
    await nextTick();

    expect(routerReplaceMock).not.toHaveBeenCalled();
  });

  it('opens the home page when a restored extension page no longer exists', async () => {
    await mountPage();

    extensionsStoreMock.isInitialized = true;
    await nextTick();

    expect(routerReplaceMock).toHaveBeenCalledWith({ name: 'home' });
  });
});
