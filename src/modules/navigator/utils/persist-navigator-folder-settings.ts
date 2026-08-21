// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { canonicalizePath } from '@/utils/normalize-path';
import type { NavigatorFolderSettingsMap, UserSettingsPath } from '@/types/user-settings';
import type {
  NavigatorFolderSettingsPatch,
  NavigatorOptionsTarget,
  StoredNavigatorFolderSettingsMap,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import {
  createNavigatorFolderSettingsWriteSnapshot,
  getStoredNavigatorFolderSettingsMap,
  hasNavigatorFolderSettings,
  toNavigatorFolderLayoutType,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';

function getGlobalNavigatorOptionEntries(
  patch: NavigatorFolderSettingsPatch,
): Array<{ key: UserSettingsPath; value: unknown }> {
  const entries: Array<{ key: UserSettingsPath; value: unknown }> = [];

  if (patch.layout !== undefined) {
    entries.push({
      key: 'navigator.layout.type',
      value: toNavigatorFolderLayoutType(patch.layout),
    });
  }

  if (patch.listSortColumn !== undefined) {
    entries.push({
      key: 'navigator.listSortColumn',
      value: patch.listSortColumn,
    });
  }

  if (patch.listSortDirection !== undefined) {
    entries.push({
      key: 'navigator.listSortDirection',
      value: patch.listSortDirection,
    });
  }

  if (patch.gridSortColumn !== undefined) {
    entries.push({
      key: 'navigator.gridSortColumn',
      value: patch.gridSortColumn,
    });
  }

  if (patch.gridSortDirection !== undefined) {
    entries.push({
      key: 'navigator.gridSortDirection',
      value: patch.gridSortDirection,
    });
  }

  if (patch.showHiddenFiles !== undefined) {
    entries.push({
      key: 'navigator.showHiddenFiles',
      value: patch.showHiddenFiles,
    });
  }

  if (patch.splitViewMode !== undefined) {
    entries.push({
      key: 'navigator.splitViewMode',
      value: patch.splitViewMode,
    });
  }

  return entries;
}

async function persistFolderSettingsMap(nextMap: StoredNavigatorFolderSettingsMap) {
  const userSettingsStore = useUserSettingsStore();
  await userSettingsStore.set('navigator.folderSettings', nextMap as NavigatorFolderSettingsMap);
}

async function persistNavigatorFolderSettingsPatch(
  path: string,
  patch: NavigatorFolderSettingsPatch,
) {
  const userSettingsStore = useUserSettingsStore();
  const navigator = userSettingsStore.userSettings.navigator;
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath) {
    return;
  }

  const currentMap = getStoredNavigatorFolderSettingsMap(navigator);

  await persistFolderSettingsMap({
    ...currentMap,
    [canonicalPath]: createNavigatorFolderSettingsWriteSnapshot(navigator, canonicalPath, patch),
  });
}

async function persistNavigatorOptionsGlobalPatch(patch: NavigatorFolderSettingsPatch) {
  const entries = getGlobalNavigatorOptionEntries(patch);

  if (entries.length === 0) {
    return;
  }

  const userSettingsStore = useUserSettingsStore();
  await userSettingsStore.setMany(entries);
}

export async function persistNavigatorOptions(
  target: NavigatorOptionsTarget,
  patch: NavigatorFolderSettingsPatch,
) {
  if (target !== 'global' && canonicalizePath(target.folder)) {
    await persistNavigatorFolderSettingsPatch(target.folder, patch);
    return;
  }

  await persistNavigatorOptionsGlobalPatch(patch);
}

export async function persistAppliedNavigatorOptions(
  path: string,
  patch: NavigatorFolderSettingsPatch,
) {
  const userSettingsStore = useUserSettingsStore();
  const target = hasNavigatorFolderSettings(userSettingsStore.userSettings.navigator, path)
    ? { folder: path }
    : 'global';

  await persistNavigatorOptions(target, patch);
}

export async function clearNavigatorFolderSettings(path: string) {
  const userSettingsStore = useUserSettingsStore();
  const navigator = userSettingsStore.userSettings.navigator;
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath) {
    return;
  }

  const currentMap = getStoredNavigatorFolderSettingsMap(navigator);
  const nextMap: StoredNavigatorFolderSettingsMap = {};

  for (const [storedPath, settings] of Object.entries(currentMap)) {
    if (canonicalizePath(storedPath) === canonicalPath) {
      continue;
    }

    nextMap[storedPath] = settings;
  }

  await persistFolderSettingsMap(nextMap);
}
