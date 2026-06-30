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

  it('migrates legacy system icon preferences to separate icon theme settings', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 9,
      'navigator.useSystemIconsForDirectories': false,
      'navigator.useSystemIconsForFiles': true,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.folderIconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.default);
    expect(storage.values.get('navigator.fileIconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.system);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults legacy navigator icon themes when system icons were disabled', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 9,
      'navigator.useSystemIconsForDirectories': false,
      'navigator.useSystemIconsForFiles': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.folderIconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.default);
    expect(storage.values.get('navigator.fileIconTheme')).toBe(BUILTIN_NAVIGATOR_ICON_THEME_IDS.default);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('migrates the previous shared icon theme to both folder and file settings', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 10,
      'navigator.iconTheme': 'extension:acme.example-icons:frappe',
      'navigator.useSystemIconsForDirectories': true,
      'navigator.useSystemIconsForFiles': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.folderIconTheme')).toBe('extension:acme.example-icons:frappe');
    expect(storage.values.get('navigator.fileIconTheme')).toBe('extension:acme.example-icons:frappe');
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('adds editable global search ignored path defaults when migrating', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 11,
      'globalSearch.ignoredPaths': ['/node_modules'],
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.ignoredPaths')).toEqual([
      '/node_modules',
      '/ProgramData/Microsoft',
      '/Windows/WinSxS',
    ]);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('adds the WinSxS ignored path default when migrating existing v12 settings', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 12,
      'globalSearch.ignoredPaths': ['/ProgramData/Microsoft'],
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.ignoredPaths')).toEqual([
      '/ProgramData/Microsoft',
      '/Windows/WinSxS',
    ]);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults info panel full-size image preview to disabled when migrating', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 15,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.infoPanel.showFullSizeImagePreview')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults grid sort settings when migrating from schema version 16', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 16,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.gridSortColumn')).toBe('name');
    expect(storage.values.get('navigator.gridSortDirection')).toBe('asc');
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults info panel video preview settings when migrating from schema version 17', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 17,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.infoPanel.muteVideoPreviewByDefault')).toBe(false);
    expect(storage.values.get('navigator.infoPanel.autoplayVideoPreview')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults clipboard toolbar settings when migrating from schema version 19', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 19,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('clipboard.showToolbarForExternalImages')).toBe(true);
    expect(storage.values.get('clipboard.showToolbarForExternalPaths')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });
});
