// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-20（用户指出）：「大小」这一格的标题渲染了**两遍**，
// 看上去是「大小 ⓘ大小」。根因是 `v-if` / `v-else` 配错了对：
// 末尾那个 `<button v-else>` 配的是 `<span v-if="availableSpace">`，
// 而不是包着提示图标的 `<Tooltip v-if="size">`。

import { mount } from '@vue/test-utils';
import { defineComponent, provide, ref } from 'vue';
import { createPinia } from 'pinia';
import { TooltipProvider } from 'reka-ui';
import {
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import FileBrowserListSortableColumn from '../file-browser-list-sortable-column.vue';
import { FILE_BROWSER_CONTEXT_KEY, type FileBrowserContext } from '../composables/use-file-browser-context';
import {
  FILE_BROWSER_LIST_COLUMNS_KEY,
  type FileBrowserListColumnsContext,
} from '../composables/use-file-browser-list-columns';

/**
 * 只给这个组件用到的几个键，**不引入整包语言包**。
 *
 * 断言只数**元素**个数，不看文字，所以译文是什么无所谓。
 */
function createI18nStubPlugin() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createI18n } = require('vue-i18n');

  return createI18n({
    legacy: false,
    locale: 'en',
    fallbackWarn: false,
    missingWarn: false,
    messages: {
      en: {
        fileBrowser: {
          name: 'Name',
          items: 'Items',
          size: 'Size',
          modified: 'Modified',
          created: 'Created',
          tags: 'Tags',
          kind: 'Kind',
          links: 'Links',
          linkStatus: 'Link status',
          linkTarget: 'Link target',
          availableSpace: 'Available space',
          sizeTooltip: {
            title: 'How size is shown',
            exact: 'exact',
            loading: 'loading',
            notCalculated: 'not calculated',
            note: 'note',
          },
        },
      },
    },
  });
}

beforeAll(() => {
  // 链条 userSettings -> useTheme.init() 会调 window.matchMedia，jsdom 没实现。
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => false),
    })),
  });
});

function mountColumn(columnId: 'size' | 'availableSpace' | 'items') {
  const wrapper = mount(defineComponent({
    components: {
      FileBrowserListSortableColumn,
      TooltipProvider,
    },
    // 必须**声明**这个 prop：不声明的话 mount 的 props 只会变成 attrs，
    // 模板里的 `columnId` 会是 undefined —— 组件拿到 undefined 的列 id，
    // 标签自然是空的。
    props: {
      columnId: {
        type: String,
        required: true,
      },
    },
    setup() {
      provide(FILE_BROWSER_CONTEXT_KEY, {
        isLinkMetadataLoading: ref(false),
      } as unknown as FileBrowserContext);

      provide(FILE_BROWSER_LIST_COLUMNS_KEY, {
        activeResizeColumnId: ref(null),
        listColumnsTemplate: ref(''),
        resizePreviewWidths: ref({}),
        setMeasuredColumnWidths: () => {},
        setHeaderGridElement: () => {},
        setScrollViewportElement: () => {},
        beginColumnResize: () => {},
        updateColumnResize: () => {},
        finishColumnResize: async () => {},
        cancelColumnResize: () => {},
      } as unknown as FileBrowserListColumnsContext);

      return {};
    },
    template: '<TooltipProvider><FileBrowserListSortableColumn :column-id="columnId" :list-sort-column="null" :list-sort-direction="\'asc\'" /></TooltipProvider>',
  }), {
    props: { columnId },
    global: {
      plugins: [createPinia(), createI18nStubPlugin()],
    },
  });

  return wrapper;
}

describe('FileBrowserListSortableColumn', () => {
  it('「大小」这一格只渲染一个标题元素', () => {
    // 标题渲染两遍就是「大小 ⓘ大小」那个样子。
    // 数**元素**而不是数文字：文字会随语言变，元素不会。
    const wrapper = mountColumn('size');

    expect(wrapper.findAll('.file-browser-list-view__header-item')).toHaveLength(1);
  });

  it('「大小」这一格仍然带那个提示图标', () => {
    // 只删掉重复的标题，别把提示图标一起删了 —— 它解释的是「大小」怎么算的。
    const wrapper = mountColumn('size');

    expect(wrapper.find('.file-browser-list-view__header-info-icon').exists()).toBe(true);
    expect(wrapper.find('.file-browser-list-view__header-size--with-info').exists()).toBe(true);
  });

  it('「大小」这一格仍然可点（能排序）', () => {
    const wrapper = mountColumn('size');

    expect(wrapper.find('button.file-browser-list-view__header-size').exists()).toBe(true);
  });

  it('「可用空间」这一格不是按钮（它没有排序实现）', () => {
    const wrapper = mountColumn('availableSpace');

    expect(wrapper.find('button').exists()).toBe(false);
    expect(wrapper.find('.file-browser-list-view__header-availableSpace').exists()).toBe(true);
    expect(wrapper.findAll('.file-browser-list-view__header-item')).toHaveLength(1);
  });

  it('其它列各渲染一个标题元素', () => {
    const wrapper = mountColumn('items');

    expect(wrapper.findAll('.file-browser-list-view__header-item')).toHaveLength(1);
    expect(wrapper.find('button').exists()).toBe(true);
  });
});
