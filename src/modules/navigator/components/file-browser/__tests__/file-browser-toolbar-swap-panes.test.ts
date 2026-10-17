// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import FileBrowserToolbar from '../file-browser-toolbar.vue';

const EmptyStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

// 工具栏里与本测试无关的按钮和地址栏全部打桩掉。
// 刻意**不**打桩 Button：互换按钮就靠 data-e2e-root 这个属性定位，
// 打桩掉的话属性会丢，断言就成了「找不到就是没渲染」的空判断。
const stubs = {
  FileBrowserToolbarNavButtons: EmptyStub,
  FileBrowserToolbarCreateButton: EmptyStub,
  FileBrowserToolbarFilter: EmptyStub,
  FileBrowserToolbarAddressBar: EmptyStub,
  Tooltip: EmptyStub,
  TooltipTrigger: EmptyStub,
  TooltipContent: EmptyStub,
};

function mountToolbar(isSplitView: boolean) {
  return mount(FileBrowserToolbar, {
    props: {
      pathInput: 'C:/Folder',
      filterQuery: '',
      canGoBack: false,
      canGoForward: false,
      canGoUp: false,
      isLoading: false,
      isFilterOpen: false,
      focusFilterInput: false,
      isSplitView,
      currentLayout: 'list' as const,
    },
    global: {
      stubs,
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages: {
            en: { fileBrowser: { swapPanes: 'Swap panes' } },
          },
        }),
      ],
    },
  });
}

const SWAP_SELECTOR = '[data-e2e-root="toolbar-swap-panes"]';

describe('file browser toolbar · swap panes entry point', () => {
  it('hides the swap button when there is only one pane', () => {
    const wrapper = mountToolbar(false);

    expect(wrapper.find(SWAP_SELECTOR).exists()).toBe(false);
    wrapper.unmount();
  });

  it('shows the swap button in split view', () => {
    const wrapper = mountToolbar(true);

    expect(wrapper.find(SWAP_SELECTOR).exists()).toBe(true);
    wrapper.unmount();
  });

  it('forwards the button press as swap-panes', async () => {
    const wrapper = mountToolbar(true);

    await wrapper.find(SWAP_SELECTOR).trigger('click');

    expect(wrapper.emitted('swap-panes')).toHaveLength(1);
    wrapper.unmount();
  });
});
