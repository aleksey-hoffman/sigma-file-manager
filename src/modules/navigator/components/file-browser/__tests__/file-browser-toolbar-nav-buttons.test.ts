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

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: {
        thumbnailSize: 'medium',
      },
    },
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
      // FORK-MODIFICATION 2026-10-20：默认「本地目录」语义。
      canCreateFile: true,
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

// FORK-MODIFICATION 2026-10-14：小房子按钮改为跳「此电脑」。
// 文案换成已存在的顶层 `locations` 键（不新增 i18n key，避免 17 语言包门禁），
// `fileBrowser.goHome` 从此只服务错误页按钮，不再出现在本组件里。
describe('file-browser-toolbar-nav-buttons · home button goes to locations', () => {
  it('labels the home button with the locations key instead of goHome', () => {
    const wrapper = mountNavButtons();
    expect(wrapper.text()).toContain('locations');
    expect(wrapper.text()).not.toContain('fileBrowser.goHome');
  });

  it('emits goHome once when the home button is clicked', async () => {
    const wrapper = mountNavButtons();
    await wrapper.find('[data-test="go-locations-button"]').trigger('click');
    expect(wrapper.emitted('goHome')).toHaveLength(1);
  });
});

// FORK-MODIFICATION 2026-10-17：缩略图大小按钮此前只加在宽屏那排图标上，
// 窄屏折叠进「⋯」菜单后就找不到了。这个 describe 锁住两态都有入口。
describe('file-browser-toolbar-nav-buttons · thumbnail size parity', () => {
  it('keeps the thumbnail size button on the expanded toolbar', () => {
    const wrapper = mountNavButtons();
    expect(wrapper.find('[data-test="thumbnail-size-button"]').exists()).toBe(true);
  });

  it('also exposes thumbnail size inside the collapsed ⋮ dropdown', async () => {
    const wrapper = mountNavButtons({ currentLayout: 'list' });

    await wrapper.findAll('button')
      .find(b => b.attributes('title') === 'settingsCategories.navigation')
      ?.trigger('click');

    expect(wrapper.find('[data-test="thumbnail-size-menu-item"]').exists()).toBe(true);
  });

  it('opens the same dialog from the expanded button', async () => {
    const wrapper = mountNavButtons();
    const dialog = wrapper.findComponent({ name: 'FileBrowserThumbnailSizeDialog' });

    expect(dialog.props('open')).toBe(false);
    await wrapper.find('[data-test="thumbnail-size-button"]').trigger('click');
    expect(dialog.props('open')).toBe(true);
  });

  it('opens the same dialog from the collapsed menu item', async () => {
    const wrapper = mountNavButtons({ currentLayout: 'list' });
    const dialog = wrapper.findComponent({ name: 'FileBrowserThumbnailSizeDialog' });

    expect(dialog.props('open')).toBe(false);

    await wrapper.findAll('button')
      .find(b => b.attributes('title') === 'settingsCategories.navigation')
      ?.trigger('click');
    await wrapper.find('[data-test="thumbnail-size-menu-item"]').trigger('click');

    expect(dialog.props('open')).toBe(true);
  });

  it('mounts the dialog outside the display:none expanded container', () => {
    const wrapper = mountNavButtons();
    const dialog = wrapper.findComponent({ name: 'FileBrowserThumbnailSizeDialog' });

    expect(dialog.exists()).toBe(true);
    // 窄屏时 --expanded 那个 div 是 display:none，弹窗挂在它里面虽然
    // （reka 会 teleport 到 body）多半还能显示，但那是运气不是设计。
    // 明确要求它挂在两个容器之外。
    const expandedContainer = wrapper.find('.file-browser-toolbar-nav-buttons--expanded');
    expect(expandedContainer.element.contains(dialog.element)).toBe(false);
  });
});

// FORK-MODIFICATION 2026-10-20：远程「新建空文件」是永久非目标（规格 §1）。
//
// 这个「⋯」下拉是渲染「新建文件」的**第三个**地方。另两个（工具栏「＋」下拉、
// 右键「新建」子菜单）都接了门禁 —— 真机验收时发现这个漏了，
// 远程格的下拉里还明晃晃摆着一项「新建文件」。
describe('file-browser-toolbar-nav-buttons · 「新建文件」入口', () => {
  it('canCreateFile=false 时不渲染「新建文件」', () => {
    const wrapper = mountNavButtons({ canCreateFile: false });

    expect(wrapper.find('[data-test="create-new-file-menu-item"]').exists()).toBe(false);
  });

  it('canCreateFile=false 时「新建目录」照旧在（阳性对照：没把正常功能一起挡掉）', () => {
    const wrapper = mountNavButtons({ canCreateFile: false });

    expect(wrapper.find('[data-test="create-new-directory-menu-item"]').exists()).toBe(true);
  });

  it('canCreateFile=true 时「新建文件」在，且点了会发事件（阳性对照：本地没被误伤）', async () => {
    const wrapper = mountNavButtons({ canCreateFile: true });

    const item = wrapper.find('[data-test="create-new-file-menu-item"]');
    expect(item.exists()).toBe(true);

    await item.trigger('click');
    expect(wrapper.emitted('createNewFile')).toHaveLength(1);
  });
});
