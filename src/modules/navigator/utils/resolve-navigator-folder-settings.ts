// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { normalizePathForComparison } from '@/utils/file-operation-paths';
import { isRecord } from '@/stores/schemas/schema-utils';
import { isListSortColumn } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import {
  isNavigatorGrouping,
  type ListSortColumn,
  type ListSortDirection,
  type NavigatorFolderLayoutName,
  type NavigatorFolderSettings,
  type NavigatorGrouping,
  type NavigatorLayout,
  type UserSettingsNavigator,
} from '@/types/user-settings';

export type NavigatorOptionsTarget = 'global' | { folder: string };

export type NavigatorFolderSettingsPatch = Partial<NavigatorFolderSettings>;

const NAVIGATOR_FOLDER_SETTING_FIELDS = {
  layout: true,
  listSortColumn: true,
  listSortDirection: true,
  gridSortColumn: true,
  gridSortDirection: true,
  showHiddenFiles: true,
  grouping: true,
} satisfies Record<keyof NavigatorFolderSettings, true>;

const NAVIGATOR_FOLDER_SETTING_KEYS = Object.keys(
  NAVIGATOR_FOLDER_SETTING_FIELDS,
) as Array<keyof NavigatorFolderSettings>;

export type StoredNavigatorFolderSettingsMap = Record<string, Record<string, unknown>>;

export function getNavigatorFolderLayoutName(
  layoutName: NavigatorLayout['type']['name'],
): NavigatorFolderLayoutName {
  return layoutName === 'grid' ? 'grid' : 'list';
}

export function toNavigatorFolderLayoutType(
  layoutName: NavigatorFolderLayoutName,
): NavigatorLayout['type'] {
  return {
    title: layoutName === 'grid' ? 'gridLayout' : 'listLayout',
    name: layoutName,
  };
}

function isListSortDirection(value: unknown): value is ListSortDirection {
  return value === 'asc' || value === 'desc';
}

function isNavigatorFolderLayoutName(value: unknown): value is NavigatorFolderLayoutName {
  return value === 'list' || value === 'grid';
}

function resolveFolderLayoutName(value: unknown, fallback: NavigatorFolderLayoutName): NavigatorFolderLayoutName {
  if (value === 'compact-list') {
    return 'list';
  }

  if (isNavigatorFolderLayoutName(value)) {
    return value;
  }

  return fallback;
}

function resolveSortColumn(
  value: unknown,
  fallback: ListSortColumn | null,
): ListSortColumn | null {
  if (value === undefined) {
    return fallback;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === 'string' && isListSortColumn(value)) {
    return value;
  }

  return fallback;
}

function resolveSortDirection(value: unknown, fallback: ListSortDirection): ListSortDirection {
  return isListSortDirection(value) ? value : fallback;
}

function resolveBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function resolveGrouping(value: unknown, fallback: NavigatorGrouping): NavigatorGrouping {
  return isNavigatorGrouping(value) ? value : fallback;
}

export function createNavigatorFolderSettingsSnapshot(
  navigator: UserSettingsNavigator,
): NavigatorFolderSettings {
  return {
    layout: getNavigatorFolderLayoutName(navigator.layout.type.name),
    listSortColumn: navigator.listSortColumn,
    listSortDirection: navigator.listSortDirection,
    gridSortColumn: navigator.gridSortColumn,
    gridSortDirection: navigator.gridSortDirection,
    showHiddenFiles: navigator.showHiddenFiles,
    grouping: navigator.grouping,
  };
}

function mergeFolderSettingsWithGlobal(
  folderSettings: Record<string, unknown>,
  navigator: UserSettingsNavigator,
): NavigatorFolderSettings {
  const globalSnapshot = createNavigatorFolderSettingsSnapshot(navigator);

  return {
    layout: resolveFolderLayoutName(folderSettings.layout, globalSnapshot.layout),
    listSortColumn: resolveSortColumn(folderSettings.listSortColumn, globalSnapshot.listSortColumn),
    listSortDirection: resolveSortDirection(folderSettings.listSortDirection, globalSnapshot.listSortDirection),
    gridSortColumn: resolveSortColumn(folderSettings.gridSortColumn, globalSnapshot.gridSortColumn),
    gridSortDirection: resolveSortDirection(folderSettings.gridSortDirection, globalSnapshot.gridSortDirection),
    showHiddenFiles: resolveBoolean(folderSettings.showHiddenFiles, globalSnapshot.showHiddenFiles),
    grouping: resolveGrouping(folderSettings.grouping, globalSnapshot.grouping),
  };
}

export function getStoredNavigatorFolderSettingsMap(
  navigator: UserSettingsNavigator,
): StoredNavigatorFolderSettingsMap {
  if (!isRecord(navigator.folderSettings)) {
    return {};
  }

  const storedMap: StoredNavigatorFolderSettingsMap = {};

  for (const [path, folderSettings] of Object.entries(navigator.folderSettings)) {
    if (!isRecord(folderSettings)) {
      continue;
    }

    const comparisonPath = normalizePathForComparison(path);

    if (!comparisonPath) {
      continue;
    }

    storedMap[comparisonPath] = folderSettings;
  }

  return storedMap;
}

function lookupStoredNavigatorFolderSettings(
  navigator: UserSettingsNavigator,
  path: string,
): Record<string, unknown> | null {
  const comparisonPath = normalizePathForComparison(path);

  if (!comparisonPath || !isRecord(navigator.folderSettings)) {
    return null;
  }

  const directMatch = navigator.folderSettings[comparisonPath];

  if (isRecord(directMatch)) {
    return directMatch;
  }

  for (const [storedPath, folderSettings] of Object.entries(navigator.folderSettings)) {
    if (!isRecord(folderSettings)) {
      continue;
    }

    if (normalizePathForComparison(storedPath) === comparisonPath) {
      return folderSettings;
    }
  }

  return null;
}

export function navigatorFolderSettingsDifferFromDefaults(
  effective: NavigatorFolderSettings,
  defaults: NavigatorFolderSettings,
): boolean {
  return NAVIGATOR_FOLDER_SETTING_KEYS.some(key => effective[key] !== defaults[key]);
}

export function createNavigatorFolderSettingsOverrideSnapshot(
  navigator: UserSettingsNavigator,
  path: string,
  patch: NavigatorFolderSettingsPatch,
): Record<string, unknown> | null {
  const effective = mergeFolderSettingsWithGlobal(
    createNavigatorFolderSettingsWriteSnapshot(navigator, path, patch),
    navigator,
  );
  const defaults = createNavigatorFolderSettingsSnapshot(navigator);
  const overrides: Record<string, unknown> = {};

  for (const key of NAVIGATOR_FOLDER_SETTING_KEYS) {
    if (effective[key] !== defaults[key]) {
      overrides[key] = effective[key];
    }
  }

  return Object.keys(overrides).length > 0 ? overrides : null;
}

export function hasNavigatorFolderSettings(
  navigator: UserSettingsNavigator,
  path: string,
): boolean {
  const storedSettings = lookupStoredNavigatorFolderSettings(navigator, path);

  if (!storedSettings) {
    return false;
  }

  return navigatorFolderSettingsDifferFromDefaults(
    mergeFolderSettingsWithGlobal(storedSettings, navigator),
    createNavigatorFolderSettingsSnapshot(navigator),
  );
}

export function resolveNavigatorFolderSettings(
  navigator: UserSettingsNavigator,
  path: string,
): NavigatorFolderSettings {
  const storedSettings = lookupStoredNavigatorFolderSettings(navigator, path);

  if (!storedSettings) {
    return createNavigatorFolderSettingsSnapshot(navigator);
  }

  return mergeFolderSettingsWithGlobal(storedSettings, navigator);
}

export function createNavigatorFolderSettingsWriteSnapshot(
  navigator: UserSettingsNavigator,
  path: string,
  patch: NavigatorFolderSettingsPatch,
): Record<string, unknown> {
  const storedSettings = lookupStoredNavigatorFolderSettings(navigator, path) ?? {};

  return {
    ...storedSettings,
    ...patch,
  };
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
  const comparablePath = normalizePathForComparison(path);
  const comparableOldPrefix = normalizePathForComparison(oldPrefix);
  const comparableNewPrefix = normalizePathForComparison(newPrefix);

  if (!comparablePath || !comparableOldPrefix || !comparableNewPrefix) {
    return null;
  }

  if (comparablePath === comparableOldPrefix) {
    return comparableNewPrefix;
  }

  if (comparablePath.startsWith(`${comparableOldPrefix}/`)) {
    return comparableNewPrefix + comparablePath.slice(comparableOldPrefix.length);
  }

  return null;
}

function folderSettingsKeyExists(
  folderSettings: StoredNavigatorFolderSettingsMap,
  path: string,
  excludedPath: string,
): boolean {
  const comparablePath = normalizePathForComparison(path);
  const comparableExcludedPath = normalizePathForComparison(excludedPath);

  return Object.keys(folderSettings).some((existingPath) => {
    const comparableExistingPath = normalizePathForComparison(existingPath);
    return comparableExistingPath === comparablePath
      && comparableExistingPath !== comparableExcludedPath;
  });
}

export function remapNavigatorFolderSettingsPaths(
  folderSettings: StoredNavigatorFolderSettingsMap,
  oldPath: string,
  newPath: string,
): StoredNavigatorFolderSettingsMap | null {
  const oldPrefix = normalizePathForComparison(oldPath);
  const newPrefix = normalizePathForComparison(newPath);

  if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
    return null;
  }

  let didChange = false;
  const nextMap: StoredNavigatorFolderSettingsMap = {};

  for (const [path, settings] of Object.entries(folderSettings)) {
    const remappedPath = replacePathPrefix(path, oldPrefix, newPrefix);

    if (remappedPath === null) {
      nextMap[path] = settings;
      continue;
    }

    didChange = true;

    if (folderSettingsKeyExists(folderSettings, remappedPath, path)) {
      continue;
    }

    nextMap[remappedPath] = settings;
  }

  return didChange ? nextMap : null;
}

export function removeNavigatorFolderSettingsPaths(
  folderSettings: StoredNavigatorFolderSettingsMap,
  deletedPaths: string[],
): StoredNavigatorFolderSettingsMap | null {
  const deletedPrefixes = deletedPaths
    .map(path => normalizePathForComparison(path))
    .filter(path => path.length > 0);

  if (deletedPrefixes.length === 0) {
    return null;
  }

  let didChange = false;
  const nextMap: StoredNavigatorFolderSettingsMap = {};

  for (const [path, settings] of Object.entries(folderSettings)) {
    const comparisonPath = normalizePathForComparison(path);
    const isDeleted = deletedPrefixes.some(deletedPath => (
      comparisonPath === deletedPath || comparisonPath.startsWith(`${deletedPath}/`)
    ));

    if (isDeleted) {
      didChange = true;
      continue;
    }

    nextMap[path] = settings;
  }

  return didChange ? nextMap : null;
}
