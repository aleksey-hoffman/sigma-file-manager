// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FileBrowserToolbarNavButtons from '../file-browser-toolbar-nav-buttons.vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      locale: { value: 'en' },
      t: (key: string) => key,
    },
  },
  messages: {},
}));

vi.mock('@/stores/runtime/shortcuts', () => ({
  useShortcutsStore: () => ({
    getShortcutLabel: () => '',
  }),
}));

vi.mock('@/composables/use-text-direction', () => ({
  useTextDirection: () => ({
    isRtl: { value: false },
  }),
}));

const TooltipStub = {
  name: 'Tooltip',
  template: '<div><slot /></div>',
};
const TooltipTriggerStub = {
  name: 'TooltipTrigger',
  template: '<div><slot /></div>',
};
const TooltipContentStub = {
  name: 'TooltipContent',
  template: '<div><slot /></div>',
};
const ContextMenuShortcutStub = {
  name: 'ContextMenuShortcut',
  template: '<span><slot /></span>',
};
const DropdownMenuStub = {
  name: 'DropdownMenu',
  template: '<div><slot /></div>',
};
const DropdownMenuTriggerStub = {
  name: 'DropdownMenuTrigger',
  template: '<div><slot /></div>',
};
const DropdownMenuContentStub = {
  name: 'DropdownMenuContent',
  template: '<div><slot /></div>',
};
const DropdownMenuItemStub = {
  name: 'DropdownMenuItem',
  template: '<div><slot /></div>',
};
const DropdownMenuSeparatorStub = {
  name: 'DropdownMenuSeparator',
  template: '<hr />',
};

function mountNavButtons(props: Record<string, unknown> = {}) {
  return mount(FileBrowserToolbarNavButtons, {
    props: {
      canGoBack: false,
      canGoForward: false,
      canGoUp: false,
      isLoading: false,
      currentLayout: 'list' as const,
      ...props,
    },
    global: {
      stubs: {
        Tooltip: TooltipStub,
        TooltipTrigger: TooltipTriggerStub,
        TooltipContent: TooltipContentStub,
        ContextMenuShortcut: ContextMenuShortcutStub,
        DropdownMenu: DropdownMenuStub,
        DropdownMenuTrigger: DropdownMenuTriggerStub,
        DropdownMenuContent: DropdownMenuContentStub,
        DropdownMenuItem: DropdownMenuItemStub,
        DropdownMenuSeparator: DropdownMenuSeparatorStub,
      },
    },
  });
}

describe('file-browser-toolbar-nav-buttons · layout toggle', () => {
  it('renders the layout toggle button after refresh', () => {
    const wrapper = mountNavButtons();
    expect(wrapper.find('[data-test="toggle-layout-button"]').exists()).toBe(true);
  });

  it('aria-label shows the toggle TARGET (grid when current layout is list)', () => {
    const wrapper = mountNavButtons({ currentLayout: 'list' });
    expect(wrapper.find('[data-test="toggle-layout-button"]').attributes('aria-label')).toBe('grid');
  });

  it('aria-label shows the toggle TARGET (list when current layout is grid)', () => {
    const wrapper = mountNavButtons({ currentLayout: 'grid' });
    expect(wrapper.find('[data-test="toggle-layout-button"]').attributes('aria-label')).toBe('list');
  });

  it('emits toggle-layout once when the button is clicked', async () => {
    const wrapper = mountNavButtons();
    await wrapper.find('[data-test="toggle-layout-button"]').trigger('click');
    expect(wrapper.emitted('toggle-layout')).toBeTruthy();
    expect(wrapper.emitted('toggle-layout')).toHaveLength(1);
  });

  it('collapsed dropdown menu also exposes layout toggle item (narrow-screen parity)', async () => {
    const wrapper = mountNavButtons({ currentLayout: 'list' });
    // 模拟点击 ⋮ dropdown 触发器
    await wrapper.findAll('button').find(b => b.attributes('title') === 'settingsCategories.navigation')?.trigger('click');
    const menuItem = wrapper.find('[data-test="toggle-layout-menu-item"]');
    expect(menuItem.exists()).toBe(true);
    await menuItem.trigger('click');
    expect(wrapper.emitted('toggle-layout')).toBeTruthy();
  });
});