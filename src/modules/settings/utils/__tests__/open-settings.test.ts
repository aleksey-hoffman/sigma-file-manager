// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

const {
  routerPushMock,
  settingsStoreMock,
} = vi.hoisted(() => ({
  routerPushMock: vi.fn(),
  settingsStoreMock: {
    clearSearch: vi.fn(),
    setCurrentTab: vi.fn(),
  },
}));

vi.mock('@/router', () => ({
  default: {
    push: routerPushMock,
  },
}));

vi.mock('@/stores/runtime/settings', () => ({
  useSettingsStore: () => settingsStoreMock,
}));

import { openSettingsTab } from '@/modules/settings/utils/open-settings';

describe('openSettingsTab', () => {
  beforeEach(() => {
    routerPushMock.mockReset();
    settingsStoreMock.clearSearch.mockReset();
    settingsStoreMock.setCurrentTab.mockReset();
  });

  it('clears settings search, selects a tab, and routes to settings', async () => {
    await openSettingsTab('appearance');

    expect(settingsStoreMock.clearSearch).toHaveBeenCalledTimes(1);
    expect(settingsStoreMock.setCurrentTab).toHaveBeenCalledWith('appearance');
    expect(routerPushMock).toHaveBeenCalledWith({ name: 'settings' });
  });
});
