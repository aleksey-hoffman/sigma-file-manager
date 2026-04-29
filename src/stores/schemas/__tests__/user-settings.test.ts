// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  USER_SETTINGS_SCHEMA_VERSION,
  USER_SETTINGS_SCHEMA_VERSION_KEY,
  migrateUserSettingsStorage,
} from '@/stores/schemas/user-settings';
import type { StorageAdapter } from '@/stores/schemas/schema-utils';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

function createStorageAdapter(initialEntries: Record<string, unknown>): StorageAdapter & {
  values: Map<string, unknown>;
  save: ReturnType<typeof vi.fn>;
} {
  const values = new Map<string, unknown>(Object.entries(initialEntries));
  const save = vi.fn(async () => {});

  return {
    values,
    async get<T>(key: string) {
      return values.get(key) as T | undefined;
    },
    async set(key: string, value: unknown) {
      values.set(key, value);
    },
    save,
  };
}

describe('migrateUserSettingsStorage', () => {
  it('defaults relative dates to enabled for older settings files', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 7,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('dateTime.showRelativeDates')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves the previous relative modified-date preference when migrating', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 7,
      'dateTime.showRelativeModifiedInFileList': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('dateTime.showRelativeDates')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('migrates legacy system icon preferences to the system icon theme', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 9,
      'navigator.useSystemIconsForDirectories': false,
      'navigator.useSystemIconsForFiles': true,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.iconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.system);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults legacy navigator icons to the default icon theme when system icons were disabled', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 9,
      'navigator.useSystemIconsForDirectories': false,
      'navigator.useSystemIconsForFiles': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.iconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.default);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });
});
