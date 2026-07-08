// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

const { userSettingsStoreMock } = vi.hoisted(() => ({
  userSettingsStoreMock: {
    userSettings: {
      navigator: {
        folderIconTheme: 'extension:acme.icons:folders',
        fileIconTheme: 'extension:other.icons:files',
      },
    },
    set: vi.fn(async () => {}),
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

describe('resetNavigatorIconThemesForExtension', () => {
  beforeEach(() => {
    userSettingsStoreMock.userSettings.navigator.folderIconTheme = 'extension:acme.icons:folders';
    userSettingsStoreMock.userSettings.navigator.fileIconTheme = 'extension:other.icons:files';
    userSettingsStoreMock.set.mockClear();
  });

  it('resets only icon themes that reference the removed extension', async () => {
    const { resetNavigatorIconThemesForExtension } = await import('@/modules/icon-theme/navigator-icon-theme-settings');

    await resetNavigatorIconThemesForExtension('acme.icons');

    expect(userSettingsStoreMock.set).toHaveBeenCalledExactlyOnceWith(
      'navigator.folderIconTheme',
      BUILTIN_NAVIGATOR_ICON_THEME_IDS.system,
    );
    expect(userSettingsStoreMock.userSettings.navigator.fileIconTheme).toBe('extension:other.icons:files');
  });
});
