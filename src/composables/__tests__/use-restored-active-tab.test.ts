// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick } from 'vue';
import { useRestoredActiveTab } from '@/composables/use-restored-active-tab';
import { useScrollRestorationStore } from '@/stores/runtime/scroll-restoration';

// FORK-MODIFICATION: 需求 N3⑤（决策 D4）——侧边栏「常用」「历史」点进来要切
// 仪表盘对应页签。用户点它的时候仪表盘页通常已经挂载，所以 store → ref 的
// 反向同步是必需的；缺了它就是「点了没反应」。
describe('useRestoredActiveTab', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('starts from the stored tab when one exists', () => {
    const scrollStore = useScrollRestorationStore();
    scrollStore.setActiveTab('dashboard', 'history');

    expect(useRestoredActiveTab('dashboard', 'favorites').value).toBe('history');
  });

  it('falls back to the default tab when nothing is stored', () => {
    expect(useRestoredActiveTab('dashboard', 'favorites').value).toBe('favorites');
  });

  it('writes local changes back to the store', async () => {
    const scrollStore = useScrollRestorationStore();
    const activeTab = useRestoredActiveTab('dashboard', 'favorites');

    activeTab.value = 'frequent';
    await nextTick();

    expect(scrollStore.getActiveTab('dashboard')).toBe('frequent');
  });

  // ---- 决策 D4 的关键行为 ----

  it('picks up an external store change after setup', async () => {
    // 这正是侧边栏点击的场景：页面已挂载，外部把 activeTab 改成 history。
    const scrollStore = useScrollRestorationStore();
    const activeTab = useRestoredActiveTab('dashboard', 'favorites');

    expect(activeTab.value).toBe('favorites');

    scrollStore.setActiveTab('dashboard', 'history');
    await nextTick();

    expect(activeTab.value).toBe('history');
  });

  it('picks up an external switch back to a non-default tab', async () => {
    // 默认值与外部值都做过一次，覆盖「先离开再回来」而不是单向一次。
    const scrollStore = useScrollRestorationStore();
    const activeTab = useRestoredActiveTab('dashboard', 'favorites');

    scrollStore.setActiveTab('dashboard', 'history');
    await nextTick();
    scrollStore.setActiveTab('dashboard', 'frequent');
    await nextTick();

    expect(activeTab.value).toBe('frequent');
  });

  it('ignores an undefined store value instead of blanking the tab', async () => {
    // store 里被清成 undefined 时保持本地值，否则页签会被打成空字符串。
    const scrollStore = useScrollRestorationStore();
    scrollStore.setActiveTab('dashboard', 'history');

    const activeTab = useRestoredActiveTab('dashboard', 'favorites');
    expect(activeTab.value).toBe('history');

    scrollStore.activeTabs = {};
    await nextTick();

    expect(activeTab.value).toBe('history');
  });

  it('does not let the two watchers fight each other', async () => {
    // ref → store 与 store → ref 同时存在，必须确认不会互相触发成死循环。
    const scrollStore = useScrollRestorationStore();
    const activeTab = useRestoredActiveTab('dashboard', 'favorites');

    activeTab.value = 'tagged';
    await nextTick();
    activeTab.value = 'frequent';
    await nextTick();

    expect(activeTab.value).toBe('frequent');
    expect(scrollStore.getActiveTab('dashboard')).toBe('frequent');
  });
});
