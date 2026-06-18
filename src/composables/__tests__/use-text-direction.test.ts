// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { useTextDirection } from '@/composables/use-text-direction';

const { userSettingsStoreMock } = vi.hoisted(() => ({
  userSettingsStoreMock: {
    userSettings: {
      language: {
        locale: 'en',
        isRtl: false,
      },
    },
  },
}));

vi.mock('@/stores/storage/user-settings', () => ({
  useUserSettingsStore: () => userSettingsStoreMock,
}));

describe('useTextDirection', () => {
  it('resolves RTL from the canonical locale definition', () => {
    userSettingsStoreMock.userSettings.language.locale = 'he';
    userSettingsStoreMock.userSettings.language.isRtl = false;

    const direction = useTextDirection();

    expect(direction.isRtl.value).toBe(true);
    expect(direction.textDirection.value).toBe('rtl');
    expect(direction.inlineStartSide.value).toBe('right');
    expect(direction.inlineEndSide.value).toBe('left');
  });

  it('falls back to the stored direction flag for unknown locales', () => {
    userSettingsStoreMock.userSettings.language.locale = 'unknown';
    userSettingsStoreMock.userSettings.language.isRtl = true;

    const direction = useTextDirection();

    expect(direction.isRtl.value).toBe(true);
    expect(direction.textDirection.value).toBe('rtl');
  });
});
