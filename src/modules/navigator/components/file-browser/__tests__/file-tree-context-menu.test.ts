// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import FileTreeContextMenu from '../file-tree-context-menu.vue';
import type { TreeMenuTarget } from '../file-tree-context-menu.vue';

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: { locale: { value: 'en' }, t: (k: string) => k },
  },
  messages: {},
}));

// clipboard store 是受控 mock;调用 setClipboard 即记录。
const setClipboardMock = vi.fn();
const hasItemsMock = vi.fn();
const canPasteToMock = vi.fn();

vi.mock('@/stores/runtime/clipboard', () => ({
  useClipboardStore: () => ({
    get hasItems() { return hasItemsMock(); },
    canPasteTo: (path: string) => canPasteToMock(path),
    setClipboard: setClipboardMock,
  }),
}));

function createTarget(target: TreeMenuTarget): TreeMenuTarget {
  return target;
}

// FORK-MODIFICATION: stub 必须把 DOM click 转发成 `select` 事件,
// 否则 @select="handleCopy" 挂在 stub 上永远不会被触发 —— 探针打不中,
// 测试会平凡地失败(规则 J 深化:探针本身也可能是平凡的)。
const StubItem = {
  name: 'ContextMenuItem',
  template: '<div class="context-menu-item-stub" :data-test="$attrs[\'data-test\']" @click="$emit(\'select\')"><slot /></div>',
  inheritAttrs: false,
  emits: ['select'],
};
const StubSeparator = {
  name: 'ContextMenuSeparator',
  template: '<hr class="context-menu-separator-stub" />',
};
const StubContent = {
  name: 'ContextMenuContent',
  template: '<div class="context-menu-content-stub"><slot /></div>',
};

function mountContextMenu(target: TreeMenuTarget) {
  return mount(FileTreeContextMenu, {
    props: { target },
    global: {
      stubs: {
        ContextMenuContent: StubContent,
        ContextMenuItem: StubItem,
        ContextMenuSeparator: StubSeparator,
      },
    },
  });
}

describe('file-tree-context-menu', () => {
  it('renders 5 items for a file: copy / cut / rename / open-containing-directory / properties', () => {
    hasItemsMock.mockReturnValue(false);
    canPasteToMock.mockReturnValue(false);
    const wrapper = mountContextMenu(createTarget({ path: 'C:/file.txt', isDirectory: false }));
    const items = wrapper.findAllComponents(StubItem);
    expect(items.length).toBe(5);
  });

  it('renders 4 items for a directory without clipboard items (no paste)', () => {
    hasItemsMock.mockReturnValue(false);
    canPasteToMock.mockReturnValue(false);
    const wrapper = mountContextMenu(createTarget({ path: 'C:/dir', isDirectory: true }));
    const items = wrapper.findAllComponents(StubItem);
    expect(items.length).toBe(4);
  });

  it('renders 5 items for a directory when clipboard has items (copy / cut / paste / rename / properties)', () => {
    hasItemsMock.mockReturnValue(true);
    canPasteToMock.mockReturnValue(true);
    const wrapper = mountContextMenu(createTarget({ path: 'C:/dir', isDirectory: true }));
    const items = wrapper.findAllComponents(StubItem);
    expect(items.length).toBe(5);
  });

  // 验收反馈 2026-10-13:点击"复制"应调 clipboardStore.setClipboard('copy', ...)。
  it('copy: invokes setClipboard with copy type and emits action', async () => {
    hasItemsMock.mockReturnValue(false);
    canPasteToMock.mockReturnValue(false);
    setClipboardMock.mockClear();
    const wrapper = mountContextMenu(createTarget({ path: 'C:/a.txt', isDirectory: false }));
    await wrapper.find('[data-test="ctx-tree-copy"]').trigger('click');
    // 2026-10-13 修复:第三参是 options { syncToSystemClipboard?: boolean },不是来源标识字符串。
    // 两参断言在真的传了三参时会失败,因此这条同时守住"不多传参数"——
    // 即树菜单复制与文件浏览器 copyItems 行为一致(默认同步系统剪贴板)。
    expect(setClipboardMock).toHaveBeenCalledWith(
      'copy',
      [expect.objectContaining({
        path: 'C:/a.txt',
        name: 'a.txt',
        is_file: true,
        is_dir: false,
      })],
    );
    const emitted = wrapper.emitted('action');
    expect(emitted).toEqual([['copy']]);
  });

  it('cut: invokes setClipboard with move type', async () => {
    hasItemsMock.mockReturnValue(false);
    canPasteToMock.mockReturnValue(false);
    setClipboardMock.mockClear();
    const wrapper = mountContextMenu(createTarget({ path: 'C:/a.txt', isDirectory: false }));
    await wrapper.find('[data-test="ctx-tree-cut"]').trigger('click');
    expect(setClipboardMock).toHaveBeenCalledWith(
      'move',
      [expect.objectContaining({ path: 'C:/a.txt', is_file: true })],
    );
  });
});
