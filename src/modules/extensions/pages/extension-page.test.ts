// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
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
  sidebarPagesMock,
} = vi.hoisted(() => ({
  invokeAsExtensionMock: vi.fn(),
  sidebarPagesMock: [] as SidebarPageRegistration[],
}));

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { fullPageId: 'test.page' } }),
}));

vi.mock('@/stores/runtime/extensions', () => ({
  useExtensionsStore: () => ({ sidebarPages: sidebarPagesMock }),
}));

vi.mock('@/modules/extensions/runtime/extension-invoke', () => ({
  invokeAsExtension: invokeAsExtensionMock,
}));

vi.mock('@/layouts', () => ({
  PageIframeLayout: { template: '<div><slot /></div>' },
}));

function registerPage(url: string) {
  sidebarPagesMock.splice(0, sidebarPagesMock.length, {
    extensionId: 'test.extension',
    page: {
      id: 'test.page',
      url,
    },
  });
}

async function mountPage() {
  const wrapper = mount(ExtensionPage);
  await flushPromises();
  return wrapper;
}

describe('extension page', () => {
  beforeEach(() => {
    invokeAsExtensionMock.mockReset();
    sidebarPagesMock.splice(0, sidebarPagesMock.length);
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
});
