// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import {
  getScrollRestorationKey,
  useScrollRestorationStore,
} from '@/stores/runtime/scroll-restoration';

describe('scroll restoration store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('builds stable encoded keys from parts', () => {
    expect(getScrollRestorationKey('extensions', 'publisher:extension', 'overview')).toBe(
      'extensions:publisher%3Aextension:overview',
    );
  });

  it('returns zero for unknown keys', () => {
    const scrollStore = useScrollRestorationStore();

    expect(scrollStore.getScrollTop(getScrollRestorationKey('dashboard', 'favorites'))).toBe(0);
  });

  it('stores scroll positions by key', () => {
    const scrollStore = useScrollRestorationStore();
    const dashboardKey = getScrollRestorationKey('dashboard', 'favorites');
    const navigatorKey = getScrollRestorationKey('navigator', 'tab-1', 1);

    scrollStore.setScrollTop(dashboardKey, 120);
    scrollStore.setScrollTop(navigatorKey, 240);

    expect(scrollStore.getScrollTop(dashboardKey)).toBe(120);
    expect(scrollStore.getScrollTop(navigatorKey)).toBe(240);
  });

  it('stores active tabs by key', () => {
    const scrollStore = useScrollRestorationStore();

    scrollStore.setActiveTab('dashboard', 'history');
    scrollStore.setActiveTab('extensions', 'installed');

    expect(scrollStore.getActiveTab('dashboard')).toBe('history');
    expect(scrollStore.getActiveTab('extensions')).toBe('installed');
  });

  it('resets scroll positions for a namespace', () => {
    const scrollStore = useScrollRestorationStore();
    const settingsPageKey = getScrollRestorationKey('settings', 0, 'general');
    const settingsPanelKey = getScrollRestorationKey('settings', 0, 'general', 'panel');
    const navigatorKey = getScrollRestorationKey('navigator', 'tab-1', 0);

    scrollStore.setScrollTop(settingsPageKey, 120);
    scrollStore.setScrollTop(settingsPanelKey, 240);
    scrollStore.setScrollTop(navigatorKey, 360);
    scrollStore.resetScrollNamespace('settings');

    expect(scrollStore.getScrollTop(settingsPageKey)).toBe(0);
    expect(scrollStore.getScrollTop(settingsPanelKey)).toBe(0);
    expect(scrollStore.getScrollTop(navigatorKey)).toBe(360);
    expect(scrollStore.getResetVersion('settings')).toBe(1);
  });
});
