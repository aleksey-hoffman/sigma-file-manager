// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { mount, type VueWrapper } from '@vue/test-utils';
import { defineComponent, nextTick, ref, type Ref } from 'vue';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  isFileBrowserFilterTypingKey,
  useFileBrowserFilter,
} from '../use-file-browser-filter';

function createDismissalLayerStore() {
  return {
    registerLayer: vi.fn(() => 'filter-layer'),
    unregisterLayer: vi.fn(),
    layers: new Map(),
    hasLayerOfType: vi.fn(() => false),
  };
}

function createFilterHarness(options: {
  initialFilterQuery?: string;
  currentPath?: Ref<string>;
} = {}) {
  const dismissalLayerStore = createDismissalLayerStore();
  const globalSearchStore = {
    isOpen: false,
  };
  let filter = {} as ReturnType<typeof useFileBrowserFilter>;

  const wrapper = mount(defineComponent({
    setup() {
      filter = useFileBrowserFilter({
        dismissalLayerStore,
        globalSearchStore,
        isDefaultPane: true,
        initialFilterQuery: options.initialFilterQuery,
        currentPath: options.currentPath,
      });

      return {};
    },
    template: '<div />',
  }));

  return {
    wrapper,
    filter,
    dismissalLayerStore,
  };
}

describe('isFileBrowserFilterTypingKey', () => {
  it('accepts letters and numbers from non-English keyboard layouts', () => {
    expect(isFileBrowserFilterTypingKey('ф')).toBe(true);
    expect(isFileBrowserFilterTypingKey('Ж')).toBe(true);
    expect(isFileBrowserFilterTypingKey('中')).toBe(true);
    expect(isFileBrowserFilterTypingKey('文')).toBe(true);
    expect(isFileBrowserFilterTypingKey('٥')).toBe(true);
  });

  it('rejects non-text keys and punctuation', () => {
    expect(isFileBrowserFilterTypingKey('ArrowDown')).toBe(false);
    expect(isFileBrowserFilterTypingKey('Backspace')).toBe(false);
    expect(isFileBrowserFilterTypingKey(' ')).toBe(false);
    expect(isFileBrowserFilterTypingKey('-')).toBe(false);
  });
});

describe('useFileBrowserFilter', () => {
  let mountedWrapper: VueWrapper | null = null;

  afterEach(() => {
    mountedWrapper?.unmount();
    mountedWrapper = null;
    document.body.replaceChildren();
  });

  it('opens quick search when typing a Russian letter outside text fields', async () => {
    const { wrapper, filter } = createFilterHarness();
    mountedWrapper = wrapper;

    window.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ф',
      bubbles: true,
      cancelable: true,
    }));
    await nextTick();

    expect(filter.isFilterOpen.value).toBe(true);
    expect(filter.filterQuery.value).toBe('ф');
  });

  // FORK-MODIFICATION: 反馈 3（2026-10-15）——「打开所属目录」拆出来的右格 pane
  // 靠 initialFilterQuery 继续显示同一批搜索结果。
  describe('initialFilterQuery hand-over (反馈 3)', () => {
    it('starts with the handed-over query and the filter box already open', () => {
      const { wrapper, filter } = createFilterHarness({ initialFilterQuery: 'report' });
      mountedWrapper = wrapper;

      // 过滤框必须一起开着：只给结果不给输入框，用户会以为结果被锁住了。
      expect(filter.filterQuery.value).toBe('report');
      expect(filter.isFilterOpen.value).toBe(true);
    });

    // 这条是整个交接能不能活下来的关键。
    // `currentPath` 初始是 ''，挂载后首次导航把它变成真实路径 —— useFileBrowserNavigation
    // 就是这么起的。原来那条 watch 不区分「首次导航」和「用户换目录」，
    // 会 closeFilter() 把刚接管的过滤词清掉，右格于是退回「搜索前的目录」，
    // 而且**不报任何错**：一切都"正常"，只是过滤词没了。
    it('survives the initial navigation that adopts the real path', async () => {
      const currentPath = ref('');
      const { wrapper, filter } = createFilterHarness({
        initialFilterQuery: 'report',
        currentPath,
      });
      mountedWrapper = wrapper;

      currentPath.value = 'C:/Users/aleks';
      await nextTick();

      expect(filter.filterQuery.value).toBe('report');
      expect(filter.isFilterOpen.value).toBe(true);
    });

    // 反过来：用户**真的**换了目录，过滤词必须被清掉，
    // 否则会出现「在新目录里还按旧关键词过滤」这种看不懂的界面。
    it('still clears the query when the user navigates to another directory', async () => {
      const currentPath = ref('C:/Users/aleks');
      const { wrapper, filter } = createFilterHarness({
        initialFilterQuery: 'report',
        currentPath,
      });
      mountedWrapper = wrapper;

      currentPath.value = 'C:/Users/aleks/Downloads';
      await nextTick();

      expect(filter.filterQuery.value).toBe('');
      expect(filter.isFilterOpen.value).toBe(false);
    });

    it('starts empty when nothing is handed over', () => {
      const { wrapper, filter } = createFilterHarness({ initialFilterQuery: '' });
      mountedWrapper = wrapper;

      expect(filter.filterQuery.value).toBe('');
      expect(filter.isFilterOpen.value).toBe(false);
    });
  });
});
