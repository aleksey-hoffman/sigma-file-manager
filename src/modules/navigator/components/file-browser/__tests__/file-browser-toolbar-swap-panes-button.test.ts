// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';
import FileBrowserToolbarSwapPanesButton from '../file-browser-toolbar-swap-panes-button.vue';

const EmptyStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

const messages = {
  en: { fileBrowser: { swapPanes: 'Swap panes' } },
  ch: { fileBrowser: { swapPanes: '左右互换' } },
};

function mountSwapButton() {
  return mount(FileBrowserToolbarSwapPanesButton, {
    attachTo: document.body,
    global: {
      stubs: {
        Tooltip: EmptyStub,
        TooltipTrigger: EmptyStub,
        TooltipContent: EmptyStub,
      },
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          messages,
        }),
      ],
    },
  });
}

describe('file browser toolbar swap panes button', () => {
  it('emits swap-panes when clicked', async () => {
    const wrapper = mountSwapButton();

    await wrapper.find('[data-e2e-root="toolbar-swap-panes"]').trigger('click');

    expect(wrapper.emitted('swap-panes')).toHaveLength(1);
    wrapper.unmount();
  });

  it('carries a human readable label for assistive tech', () => {
    const wrapper = mountSwapButton();
    const button = wrapper.find('[data-e2e-root="toolbar-swap-panes"]');

    expect(button.attributes('aria-label')).toBe('Swap panes');
    wrapper.unmount();
  });
});
