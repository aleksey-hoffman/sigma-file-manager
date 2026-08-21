// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { normalizePathForComparison } from '@/utils/file-operation-paths';
import { isRecord } from '@/stores/schemas/schema-utils';
import { isListSortColumn } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import type {
  ListSortColumn,
  ListSortDirection,
  NavigatorFolderLayoutName,
  NavigatorFolderSettings,
  NavigatorLayout,
  UserSettingsNavigator,
} from '@/types/user-settings';

export type NavigatorOptionsScope = 'global' | 'folder';

export type NavigatorOptionsTarget = 'global' | { folder: string };

export type NavigatorFolderSettingsPatch = Partial<NavigatorFolderSettings>;

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

export function hasNavigatorFolderSettings(
  navigator: UserSettingsNavigator,
  path: string,
): boolean {
  return lookupStoredNavigatorFolderSettings(navigator, path) !== null;
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
