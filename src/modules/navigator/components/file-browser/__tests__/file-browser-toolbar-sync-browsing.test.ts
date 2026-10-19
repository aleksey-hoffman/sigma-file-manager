// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 同步浏览按钮（用户 2026-10-19 要求：放在「左右互换窗口」左边，仅分屏时出现）。
//
// 这一版换过位置。第一版放在 `navigator-toolbar-actions`，点了没反应 ——
// 那个组件的 `setSplitViewMode` 带 `settingsScope === 'folder'` 守卫，
// 而 `settingsScope` 会在打开过导航器选项菜单之后 latch 住，
// 于是工具栏按钮变成哑弹（落盘证据：`navigator.splitViewMode` 从未写进
// user-settings.json）。现在这颗直接读 store，不经过那道闸门。

import {
  describe, expect, it, vi, beforeEach,
} from 'vitest';
import { defineComponent, h, ref } from 'vue';
import { mount } from '@vue/test-utils';
import { createI18n } from 'vue-i18n';

const setSetting = vi.fn();
const splitViewMode = ref<'split' | 'linked'>('split');

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => ({
    userSettings: {
      navigator: { splitViewMode: splitViewMode.value },
    },
    set: setSetting,
  }),
}));

import FileBrowserToolbarSyncBrowsingButton from '../file-browser-toolbar-sync-browsing-button.vue';

const EmptyStub = defineComponent({
  setup(_, { slots }) {
    return () => h('div', slots.default?.());
  },
});

// 刻意**不**打桩 Button：按钮靠 data-e2e-root 定位，
// 打桩掉属性会丢，断言就退化成「找不到就是没渲染」的空判断。
const stubs = {
  Tooltip: EmptyStub,
  TooltipTrigger: EmptyStub,
  TooltipContent: EmptyStub,
};

const SYNC_SELECTOR = '[data-e2e-root="toolbar-sync-browsing"]';

function mountButton(isSplitView: boolean) {
  return mount(FileBrowserToolbarSyncBrowsingButton, {
    props: { isSplitView },
    global: {
      stubs,
      plugins: [
        createI18n({
          legacy: false,
          locale: 'en',
          missingWarn: false,
          fallbackWarn: false,
          messages: {
            en: {
              syncBrowsing: 'Synchronized browsing',
              syncBrowsingOn: 'Synchronized browsing: on',
              syncBrowsingHint: 'hint',
            },
          },
        }),
      ],
    },
  });
}

beforeEach(() => {
  setSetting.mockClear();
  splitViewMode.value = 'split';
});

describe('同步浏览按钮', () => {
  it('单格时不出现', () => {
    const wrapper = mountButton(false);

    expect(wrapper.find(SYNC_SELECTOR).exists()).toBe(false);
    wrapper.unmount();
  });

  it('分屏时出现', () => {
    const wrapper = mountButton(true);

    expect(wrapper.find(SYNC_SELECTOR).exists()).toBe(true);
    wrapper.unmount();
  });

  it('当前是「分割」时点它切到「联动」', async () => {
    const wrapper = mountButton(true);

    await wrapper.find(SYNC_SELECTOR).trigger('click');

    expect(setSetting).toHaveBeenCalledWith('navigator.splitViewMode', 'linked');
    wrapper.unmount();
  });

  it('当前是「联动」时点它切回「分割」', async () => {
    splitViewMode.value = 'linked';
    const wrapper = mountButton(true);

    await wrapper.find(SYNC_SELECTOR).trigger('click');

    expect(setSetting).toHaveBeenCalledWith('navigator.splitViewMode', 'split');
    wrapper.unmount();
  });

  it('联动中带激活态，分割中不带', () => {
    splitViewMode.value = 'linked';
    const linked = mountButton(true);
    expect(linked.find(SYNC_SELECTOR).classes()).toContain('file-browser-toolbar-sync-browsing-button--active');
    linked.unmount();

    splitViewMode.value = 'split';
    const split = mountButton(true);
    expect(split.find(SYNC_SELECTOR).classes()).not.toContain('file-browser-toolbar-sync-browsing-button--active');
    split.unmount();
  });
});
