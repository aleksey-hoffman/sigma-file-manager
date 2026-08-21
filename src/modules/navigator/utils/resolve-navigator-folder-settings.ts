// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { canonicalizePath } from '@/utils/normalize-path';
import { isRecord } from '@/stores/schemas/schema-utils';
import { isListSortColumn } from '@/modules/navigator/components/file-browser/utils/file-browser-sort-columns';
import type {
  ListSortColumn,
  ListSortDirection,
  NavigatorFolderLayoutName,
  NavigatorFolderSettings,
  NavigatorLayout,
  SplitViewMode,
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

function isSplitViewMode(value: unknown): value is SplitViewMode {
  return value === 'split' || value === 'linked';
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

function resolveSplitViewMode(value: unknown, fallback: SplitViewMode): SplitViewMode {
  return isSplitViewMode(value) ? value : fallback;
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
    splitViewMode: navigator.splitViewMode,
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
    splitViewMode: resolveSplitViewMode(folderSettings.splitViewMode, globalSnapshot.splitViewMode),
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

    const canonicalPath = canonicalizePath(path);

    if (!canonicalPath) {
      continue;
    }

    storedMap[canonicalPath] = folderSettings;
  }

  return storedMap;
}

function lookupStoredNavigatorFolderSettings(
  navigator: UserSettingsNavigator,
  path: string,
): Record<string, unknown> | null {
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath || !isRecord(navigator.folderSettings)) {
    return null;
  }

  const directMatch = navigator.folderSettings[canonicalPath];

  if (isRecord(directMatch)) {
    return directMatch;
  }

  for (const [storedPath, folderSettings] of Object.entries(navigator.folderSettings)) {
    if (!isRecord(folderSettings)) {
      continue;
    }

    if (canonicalizePath(storedPath) === canonicalPath) {
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
): NavigatorFolderSettings {
  const storedSettings = lookupStoredNavigatorFolderSettings(navigator, path);
  const baseSettings = storedSettings
    ? mergeFolderSettingsWithGlobal(storedSettings, navigator)
    : createNavigatorFolderSettingsSnapshot(navigator);

  return {
    ...baseSettings,
    ...patch,
  };
}

function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
  if (path === oldPrefix) {
    return newPrefix;
  }

  if (path.startsWith(`${oldPrefix}/`)) {
    return newPrefix + path.slice(oldPrefix.length);
  }

  return null;
}

export function remapNavigatorFolderSettingsPaths(
  folderSettings: StoredNavigatorFolderSettingsMap,
  oldPath: string,
  newPath: string,
): StoredNavigatorFolderSettingsMap | null {
  const oldPrefix = canonicalizePath(oldPath);
  const newPrefix = canonicalizePath(newPath);

  if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) {
    return null;
  }

  let didChange = false;
  const nextMap: StoredNavigatorFolderSettingsMap = {};

  for (const [path, settings] of Object.entries(folderSettings)) {
    const remappedPath = replacePathPrefix(canonicalizePath(path), oldPrefix, newPrefix);

    if (remappedPath === null) {
      nextMap[path] = settings;
      continue;
    }

    nextMap[remappedPath] = settings;
    didChange = true;
  }

  return didChange ? nextMap : null;
}

export function removeNavigatorFolderSettingsPaths(
  folderSettings: StoredNavigatorFolderSettingsMap,
  deletedPaths: string[],
): StoredNavigatorFolderSettingsMap | null {
  const deletedPrefixes = deletedPaths
    .map(path => canonicalizePath(path))
    .filter(path => path.length > 0);

  if (deletedPrefixes.length === 0) {
    return null;
  }

  let didChange = false;
  const nextMap: StoredNavigatorFolderSettingsMap = {};

  for (const [path, settings] of Object.entries(folderSettings)) {
    const canonicalPath = canonicalizePath(path);
    const isDeleted = deletedPrefixes.some(deletedPath => (
      canonicalPath === deletedPath || canonicalPath.startsWith(`${deletedPath}/`)
    ));

    if (isDeleted) {
      didChange = true;
      continue;
    }

    nextMap[path] = settings;
  }

  return didChange ? nextMap : null;
}

