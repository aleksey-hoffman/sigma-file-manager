// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 反馈 3（2026-10-15）——「打开所属目录」分栏后的临时列表样式覆盖，
// 什么时候必须解除。解除逻辑错位的后果都是「静默的」：界面不报错，只是某个标签
// 莫名其妙长期锁在列表视图、或者该覆盖时没覆盖，所以值得单独钉住。

import { mount } from '@vue/test-utils';
import { defineComponent, nextTick, ref } from 'vue';
import {
  describe,
  expect,
  it,
} from 'vitest';
import { useForcedListLayout } from '../use-forced-list-layout';
import type { Tab } from '@/types/workspaces';

function createTab(overrides: Partial<Tab> = {}): Tab {
  return {
    id: 'tab-1',
    name: 'tab',
    path: 'C:/Users/aleks',
    type: 'directory',
    paneWidth: 100,
    filterQuery: '',
    dirEntries: [],
    selectedDirEntries: [],
    ...overrides,
  };
}

function createHarness(options: {
  tab?: Tab;
  initialPath?: string;
} = {}) {
  const tabRef = ref<Tab | undefined>(options.tab);
  const currentPath = ref(options.initialPath ?? '');
  let api = {} as ReturnType<typeof useForcedListLayout>;

  mount(defineComponent({
    setup() {
      api = useForcedListLayout({
        getTab: () => tabRef.value,
        currentPath,
      });

      return {};
    },
    template: '<div />',
  }));

  return {
    api,
    tabRef,
    currentPath,
  };
}

describe('useForcedListLayout', () => {
  it('reports whether the override is currently active', () => {
    const { api } = createHarness({ tab: createTab({ pendingForceListLayout: true }) });
    expect(api.isForced.value).toBe(true);

    const off = createHarness({ tab: createTab() });
    expect(off.api.isForced.value).toBe(false);
  });

  it('tolerates a pane with no tab at all', () => {
    const { api } = createHarness();

    expect(api.isForced.value).toBe(false);
    expect(() => api.release()).not.toThrow();
  });

  // 这条是整个覆盖能不能活下来的关键。分栏出来的**左格**紧接着就要从
  // '' 导航到父目录 —— 如果把首次导航当成「用户换目录」，覆盖当场失效，
  // 左格会按它自己目录记住的布局（多半是网格）渲染，而界面上看不出任何异常。
  it('keeps the override through the initial navigation from an empty path', async () => {
    const tab = createTab({ pendingForceListLayout: true });
    const { tabRef, currentPath } = createHarness({ tab });

    currentPath.value = 'C:/Users/aleks/Downloads';
    await nextTick();

    expect(tabRef.value?.pendingForceListLayout).toBe(true);
  });

  // 反过来：用户真的换了目录就必须解除，否则那个标签会长期锁在列表视图。
  it('releases the override when the user navigates to another directory', async () => {
    const tab = createTab({ pendingForceListLayout: true });
    const { tabRef, currentPath } = createHarness({
      tab,
      initialPath: 'C:/Users/aleks',
    });

    currentPath.value = 'C:/Users/aleks/Downloads';
    await nextTick();

    expect(tabRef.value?.pendingForceListLayout).toBe(false);
  });

  // 用户点布局按钮时由 setLayout 调 release()。少这一下的话，
  // 他点了网格、设置也写进去了，界面却纹丝不动 —— 会以为按钮坏了。
  it('releases the override when release() is called (layout toggle path)', () => {
    const tab = createTab({ pendingForceListLayout: true });
    const { api, tabRef } = createHarness({ tab });

    api.release();

    expect(tabRef.value?.pendingForceListLayout).toBe(false);
  });

  it('is a no-op when there is nothing to release', () => {
    const tab = createTab();
    const { api } = createHarness({ tab });

    expect(() => api.release()).not.toThrow();
    expect(api.isForced.value).toBe(false);
  });
});
