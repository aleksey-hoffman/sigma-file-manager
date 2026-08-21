// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useUserSettingsStore } from '@/stores/storage/user-settings';
import { normalizePathForComparison } from '@/utils/file-operation-paths';
import type { UserSettingsPath } from '@/types/user-settings';
import type {
  NavigatorFolderSettingsPatch,
  NavigatorOptionsTarget,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';
import {
  createNavigatorFolderSettingsWriteSnapshot,
  hasNavigatorFolderSettings,
  toNavigatorFolderLayoutType,
} from '@/modules/navigator/utils/resolve-navigator-folder-settings';

function getGlobalNavigatorOptionEntries(
  patch: NavigatorFolderSettingsPatch,
): Array<{
  key: UserSettingsPath;
  value: unknown;
}> {
  const entries: Array<{
    key: UserSettingsPath;
    value: unknown;
  }> = [];

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

  return entries;
}

async function persistNavigatorFolderSettingsPatch(
  path: string,
  patch: NavigatorFolderSettingsPatch,
) {
  const userSettingsStore = useUserSettingsStore();
  const comparisonPath = normalizePathForComparison(path);

  if (!comparisonPath) {
    return;
  }

  await userSettingsStore.updateFolderSettings(currentMap => ({
    ...currentMap,
    [comparisonPath]: createNavigatorFolderSettingsWriteSnapshot(
      userSettingsStore.userSettings.navigator,
      comparisonPath,
      patch,
    ),
  }));
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
  if (target === 'global') {
    await persistNavigatorOptionsGlobalPatch(patch);
    return;
  }

  if (!normalizePathForComparison(target.folder)) {
    return;
  }

  await persistNavigatorFolderSettingsPatch(target.folder, patch);
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
  const comparisonPath = normalizePathForComparison(path);

  if (!comparisonPath) {
    return;
  }

  const userSettingsStore = useUserSettingsStore();

  await userSettingsStore.updateFolderSettings((currentMap) => {
    const nextMap = { ...currentMap };
    let didChange = false;

    for (const storedPath of Object.keys(nextMap)) {
      if (normalizePathForComparison(storedPath) === comparisonPath) {
        delete nextMap[storedPath];
        didChange = true;
      }
    }

    return didChange ? nextMap : null;
  });
}
