// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SCAN_DEPTH,
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
  // FORK-MODIFICATION: 2026-10-16 —— 搜索深度默认 7 → 9 的迁移。
  //
  // 这一组守的是「只改默认值对已装机用户无效」这个坑：user-settings.json 里
  // 已经有 scanDepth = 7，不递进 schema 版本就永远走不到这一步。
  it('raises the scan depth from the legacy default of 7 to 9', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 31,
      'globalSearch.scanDepth': 7,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.scanDepth')).toBe(DEFAULT_SCAN_DEPTH);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
  });

  it('sets the scan depth when the field is missing entirely', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 31,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.scanDepth')).toBe(DEFAULT_SCAN_DEPTH);
  });

  it('leaves a scan depth the user chose themselves alone', async () => {
    // 用户主动调到 12 之后升级版本，不该被这一步按回 9。
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 31,
      'globalSearch.scanDepth': 12,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.scanDepth')).toBe(12);
  });

  it('does not touch the scan depth when the schema is already current', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: USER_SETTINGS_SCHEMA_VERSION,
      'globalSearch.scanDepth': 7,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('globalSearch.scanDepth')).toBe(7);
  });

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

  it('defaults box selection when migrating from schema version 20', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 20,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.enableBoxSelection')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults increased file view gaps when migrating from schema version 21', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 21,
      'navigator.enableMarqueeBoxSelection': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.increaseFileViewGaps')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves increased gaps for enabled box selection when migrating from schema version 21', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 21,
      'navigator.enableMarqueeBoxSelection': true,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.increaseFileViewGaps')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults navigator folder settings when migrating from schema version 25', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 25,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.folderSettings')).toEqual({});
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves existing navigator folder settings when migrating from schema version 25', async () => {
    const folderSettings = {
      'C:/Users/aleks/Documents': {
        layout: 'grid',
        listSortColumn: 'modified',
        listSortDirection: 'desc',
        gridSortColumn: 'name',
        gridSortDirection: 'asc',
        showHiddenFiles: true,
        splitViewMode: 'linked',
        infoPanelDynamicSize: true,
      },
    };
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 25,
      'navigator.folderSettings': folderSettings,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.folderSettings')).toEqual(folderSettings);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
  });

  it('renames stored language.isCorrected to isHumanReviewed', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 24,
      language: {
        name: 'English',
        locale: 'en',
        isCorrected: true,
        isRtl: false,
      },
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('language')).toEqual({
      name: 'English',
      locale: 'en',
      isRtl: false,
      isHumanReviewed: true,
    });
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults folders-first sorting to enabled when migrating from schema version 26', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 26,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.foldersFirst')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves a disabled folders-first setting when migrating from schema version 26', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 26,
      'navigator.foldersFirst': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.foldersFirst')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('forces box selection on when migrating from schema version 27 even if the user had disabled it', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 27,
      'navigator.enableBoxSelection': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.enableBoxSelection')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('defaults list thumbnails to enabled when migrating from schema version 28', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 28,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.showListThumbnails')).toBe(true);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves a disabled list thumbnails setting when migrating from schema version 28', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 28,
      'navigator.showListThumbnails': false,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.showListThumbnails')).toBe(false);
  });

  it('defaults thumbnail size to medium when migrating from schema version 29', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 29,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.thumbnailSize')).toBe('medium');
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves an existing thumbnail size setting when migrating from schema version 29', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 29,
      'navigator.thumbnailSize': 'large',
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.thumbnailSize')).toBe('large');
  });

  // FORK-MODIFICATION: 验收反馈 2026-10-12 第二轮 — schema 30→31 加 xlarge 档。
  // 30→31 migration 只允许"缺失才写",已有值不动;allowed 列表里加了 xlarge,
  // 4 个值都不冲突。
  it('defaults thumbnail size to medium when migrating from schema version 30', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 30,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.thumbnailSize')).toBe('medium');
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
    expect(storage.save).toHaveBeenCalledOnce();
  });

  it('preserves an existing thumbnail size setting when migrating from schema version 30', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 30,
      'navigator.thumbnailSize': 'large',
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('navigator.thumbnailSize')).toBe('large');
  });

  // FORK-MODIFICATION 2026-10-21：移植上游 feature/background-blend-modes。
  // 上游把混合模式迁移挂在 26→27；我们 fork 的 26→27 已被 foldersFirst 占用，
  // 这步顺延到 32→33，所以这里从 v32 起步，正好只跑混合模式那一步。
  it('migrates saved infusion blend modes to the new allowlist', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 32,
      'infusion.pages.global.mixBlendMode': 'hue',
      'infusion.pages.home.mixBlendMode': 'saturation',
      'infusion.pages.navigator.mixBlendMode': 'multiply',
      'infusion.pages.dashboard.mixBlendMode': 'linear-burn',
      'infusion.pages.settings.mixBlendMode': 42,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('infusion.pages.global.mixBlendMode')).toBe('color');
    expect(storage.values.get('infusion.pages.home.mixBlendMode')).toBe('color');
    expect(storage.values.get('infusion.pages.navigator.mixBlendMode')).toBe('multiply');
    expect(storage.values.get('infusion.pages.dashboard.mixBlendMode')).toBe('normal');
    expect(storage.values.get('infusion.pages.settings.mixBlendMode')).toBe('normal');
    expect(storage.values.has('infusion.pages.extensions.mixBlendMode')).toBe(false);
    expect(storage.values.get(USER_SETTINGS_SCHEMA_VERSION_KEY)).toBe(USER_SETTINGS_SCHEMA_VERSION);
  });

  it('does not add blend target or fill color keys to older settings files', async () => {
    const storage = createStorageAdapter({
      [USER_SETTINGS_SCHEMA_VERSION_KEY]: 32,
      'infusion.pages.global.mixBlendMode': 'overlay',
      'infusion.pages.global.opacity': 20,
    });

    await migrateUserSettingsStorage(storage);

    expect(storage.values.get('infusion.pages.global.mixBlendMode')).toBe('overlay');
    expect(storage.values.get('infusion.pages.global.opacity')).toBe(20);
    expect([...storage.values.keys()].filter(key => /blendTarget|blendTint/.test(key))).toEqual([]);
  });
});
