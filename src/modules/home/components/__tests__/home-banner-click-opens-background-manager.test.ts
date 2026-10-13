// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 验收反馈 2026-10-13 — 两条需求合一个测试文件:
//   1. "请设置在主页点击主题图,弹出背景管理界面"  → 点图打开 BackgroundManagerDialog
//   2. "当前主页及主题设置按钮,与主题图重叠了"    → actions 行移出图片,点击不误触发
//
// 这组测试锁住「点主题图 → 打开背景管理」这条入口路径,防止后续重构把
// @click 从 media-container 上摘掉(那个入口用户找不到,只能去 banner 角落
// 34px 的齿轮里找,极易漏);同时锁住「点按钮不会误开弹窗」这条不变量 ——
// 本轮把按钮从图内移到图下,是最容易破坏它的地方。

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createPinia, setActivePinia } from 'pinia';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock('@/localization', () => ({
  i18n: { global: { locale: { value: 'ch' }, t: (k: string) => k } },
  messages: {},
}));

vi.mock('@/stores/runtime/drop-overlay', () => ({
  useDropOverlayStore: () => ({ setBackgroundManagerOpen: vi.fn() }),
}));

// 背景管理数据层太重(store + Tauri IPC + resource 解析),整层 mock 掉,
// 只保留本测试关心的形状:currentItem / getMediaUrl / selectMedia 等。
vi.mock('@/modules/home/composables/use-background-media', () => ({
  useBackgroundMedia: () => ({
    currentItem: { value: { kind: 'builtin', data: { fileName: 'a.jpg', type: 'image' } } },
    getPositionKey: vi.fn(),
    getMediaUrl: () => 'asset://exile.jpg',
    getPreviewUrl: () => 'asset://exile.jpg',
    selectMedia: vi.fn(),
    ensureMediaCached: vi.fn(),
    resolveOffsetMediaSelection: vi.fn(),
  }),
}));

const backgroundManagerStub = {
  name: 'BackgroundManagerDialog',
  props: ['open'],
  emits: ['update:open'],
  template: '<div class="stub-background-manager" data-test="background-manager" />',
};

vi.mock('@/components/ui/background-manager/background-manager-dialog.vue', () => ({
  default: backgroundManagerStub,
}));

// UI 原子组件在测试里用 stub 替代,避免把 reka-ui 的 Portal 行为拉进来。
// 注意:不要设 inheritAttrs:false —— 组件上写的 class(如 home-banner__action-button)
// 必须透传到 stub 根元素上,否则按 class 选不到按钮。
const passThrough = (name: string) => ({
  name,
  template: '<div><slot /></div>',
});

async function mountBanner() {
  const { default: HomeBanner } = await import('../home-banner.vue');
  return mount(HomeBanner, {
    global: {
      plugins: [createPinia()],
      stubs: {
        Drawer: passThrough('Drawer'),
        Button: passThrough('Button'),
        Tooltip: passThrough('Tooltip'),
        TooltipTrigger: passThrough('TooltipTrigger'),
        TooltipContent: passThrough('TooltipContent'),
        DropdownMenu: passThrough('DropdownMenu'),
        DropdownMenuTrigger: passThrough('DropdownMenuTrigger'),
        DropdownMenuContent: passThrough('DropdownMenuContent'),
        DropdownMenuItem: passThrough('DropdownMenuItem'),
        Popover: passThrough('Popover'),
        PopoverTrigger: passThrough('PopoverTrigger'),
        PopoverContent: passThrough('PopoverContent'),
        Slider: passThrough('Slider'),
        ContextMenuShortcut: passThrough('ContextMenuShortcut'),
        // FORK-MODIFICATION: BackgroundManagerDialog 在 home-banner.vue 里是
        // defineAsyncComponent(动态 import)。对 async 组件,stub 的 key 必须是
        // 组件自身名字(不是 import 路径),否则 stub 不生效,Vue 会去加载真的
        // Drawer 并因 __isTeleport 未导出而抛错。
        BackgroundManagerDialog: backgroundManagerStub,
      },
    },
  });
}

describe('home-banner — click the theme image to open the background manager', () => {
  beforeEach(() => {
    // home-banner 内部还有 useAppStateStore / useUserSettingsStore / useAppWindowStore,
    // 它们都要一个 active pinia(测试进程里默认没有)。
    setActivePinia(createPinia());

    // 链条 userSettings -> useTheme.init() 会调 window.matchMedia,jsdom 没实现。
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('renders the clickable media container', async () => {
    const wrapper = await mountBanner();
    expect(wrapper.find('.home-banner__media-container--clickable').exists()).toBe(true);
    wrapper.unmount();
  });

  it('opens the background manager dialog on click (was not reachable before)', async () => {
    const wrapper = await mountBanner();

    // 未点击时弹窗不挂载(v-if 控制)。
    expect(wrapper.find('[data-test="background-manager"]').exists()).toBe(false);

    await wrapper.find('.home-banner__media-container--clickable').trigger('click');
    await nextTick();

    expect(wrapper.find('[data-test="background-manager"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it('keeps the action buttons from opening the background manager', async () => {
    const wrapper = await mountBanner();

    // 刷新 / 齿轮是两个 .home-banner__action-button。点它们不该触发新入口 ——
    // 这条不变量正是本轮「按钮从图内移到图下」最容易破坏的东西。
    const actionButtons = wrapper.findAll('.home-banner__action-button');
    expect(actionButtons.length).toBeGreaterThanOrEqual(2);

    for (const button of actionButtons) {
      await button.trigger('click');
    }
    await nextTick();

    expect(wrapper.find('[data-test="background-manager"]').exists()).toBe(false);
    wrapper.unmount();
  });
});
