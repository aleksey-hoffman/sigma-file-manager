// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { UserSettings } from '@/types/user-settings';
import type { StorageAdapter } from './schema-utils';
import type { CustomBackgroundMediaItem, HomeBannerPosition } from '@/types/user-settings';
import { collectNestedRecordPaths, migrateStorageSchema } from './schema-utils';
import { backgroundMedia, DEFAULT_BACKGROUND_FILE_NAME } from '@/data/background-media';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import {
  homeBannerStorageKeys,
  legacyBackgroundStorageKeys,
} from '@/modules/home/background-storage-keys';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

export const USER_SETTINGS_SCHEMA_VERSION_KEY = '__schemaVersion';
export const USER_SETTINGS_SCHEMA_VERSION = 24;

export const DEFAULT_GLOBAL_SEARCH_IGNORED_PATHS = [
  '/node_modules',
  '/ProgramData/Microsoft',
  '/Windows/WinSxS',
];
const WINDOWS_WINSXS_IGNORED_PATH = '/Windows/WinSxS';

function generateShortId(): string {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
}

export function buildAllowedUserSettingsStorageKeys(schema: UserSettings): Set<string> {
  return collectNestedRecordPaths(schema);
}

async function migrateUserSettingsStep(storage: StorageAdapter, fromVersion: number, toVersion: number) {
  if (fromVersion === 0 && toVersion === 1) {
    return;
  }

  if (fromVersion === 1 && toVersion === 2) {
    const oldSystemIconsValue = await storage.get<unknown>('navigator.useSystemIcons');
    const oldSystemIcons = typeof oldSystemIconsValue === 'boolean' ? oldSystemIconsValue : undefined;

    const hasDirectoriesValue = await storage.get<unknown>('navigator.useSystemIconsForDirectories');
    const hasFilesValue = await storage.get<unknown>('navigator.useSystemIconsForFiles');

    const directoriesAlreadySet = typeof hasDirectoriesValue === 'boolean';
    const filesAlreadySet = typeof hasFilesValue === 'boolean';

    if (oldSystemIcons !== undefined && !directoriesAlreadySet) {
      await storage.set('navigator.useSystemIconsForDirectories', oldSystemIcons);
    }

    if (oldSystemIcons !== undefined && !filesAlreadySet) {
      await storage.set('navigator.useSystemIconsForFiles', oldSystemIcons);
    }

    return;
  }

  if (fromVersion === 2 && toVersion === 3) {
    const customMediaValue = await storage.get<unknown>(legacyBackgroundStorageKeys.customMedia);
    let migratedCustom: CustomBackgroundMediaItem[] = [];

    if (Array.isArray(customMediaValue)) {
      const isLegacyFormat = customMediaValue.length > 0 && typeof customMediaValue[0] === 'string';

      if (isLegacyFormat) {
        migratedCustom = (customMediaValue as string[]).map(path => ({
          path,
          id: generateShortId(),
        }));
        await storage.set(legacyBackgroundStorageKeys.customMedia, migratedCustom);
      }
      else {
        migratedCustom = customMediaValue as CustomBackgroundMediaItem[];
      }
    }

    const positionsValue = await storage.get<Record<string, HomeBannerPosition>>(homeBannerStorageKeys.positions);
    const hasNumericKeys = positionsValue && typeof positionsValue === 'object'
      && Object.keys(positionsValue).some(key => /^\d+$/.test(key));

    if (hasNumericKeys && positionsValue) {
      const migratedPositions: Record<string, HomeBannerPosition> = {};

      for (const [key, position] of Object.entries(positionsValue)) {
        if (!position || typeof position !== 'object') continue;

        const index = parseInt(key, 10);

        if (Number.isNaN(index)) {
          migratedPositions[key] = position;
          continue;
        }

        const validPosition: HomeBannerPosition = {
          positionX: typeof position.positionX === 'number' ? position.positionX : 50,
          positionY: typeof position.positionY === 'number' ? position.positionY : 50,
          zoom: typeof position.zoom === 'number' ? position.zoom : 100,
        };

        if (index < migratedCustom.length) {
          migratedPositions[migratedCustom[index].id] = validPosition;
        }
        else {
          const builtinIndex = index - migratedCustom.length;

          if (builtinIndex >= 0 && builtinIndex < backgroundMedia.length) {
            migratedPositions[backgroundMedia[builtinIndex].fileName] = validPosition;
          }
        }
      }

      await storage.set(homeBannerStorageKeys.positions, migratedPositions);
    }
  }

  if (fromVersion === 3 && toVersion === 4) {
    const mediaIdValue = await storage.get<string>(homeBannerStorageKeys.mediaId);
    const indexValue = await storage.get<number>(homeBannerStorageKeys.mediaIndex);

    if (!mediaIdValue || typeof mediaIdValue !== 'string' || mediaIdValue.trim() === '') {
      const customMediaValue = await storage.get<CustomBackgroundMediaItem[] | string[]>(legacyBackgroundStorageKeys.customMedia);
      const customCount = Array.isArray(customMediaValue) ? customMediaValue.length : 0;
      const rawIndex = typeof indexValue === 'number' ? indexValue : 0;
      const totalCount = customCount + backgroundMedia.length;

      let resolvedMediaId = DEFAULT_BACKGROUND_FILE_NAME;

      if (totalCount > 0 && rawIndex >= 0 && rawIndex < totalCount) {
        if (rawIndex < customCount) {
          const entry = (customMediaValue as CustomBackgroundMediaItem[])?.[rawIndex];

          if (entry && typeof entry === 'object' && entry.id) {
            resolvedMediaId = entry.id;
          }
        }
        else {
          const builtinIndex = rawIndex - customCount;
          const media = backgroundMedia[builtinIndex];

          if (media) {
            resolvedMediaId = media.fileName;
          }
        }
      }

      await storage.set(homeBannerStorageKeys.mediaId, resolvedMediaId);
    }
  }

  if (fromVersion === 4 && toVersion === 5) {
    const infusionPageKeys = ['global', 'home', 'navigator', 'dashboard', 'settings', 'extensions'];

    for (const pageKey of infusionPageKeys) {
      const storageKey = `infusion.pages.${pageKey}.background`;
      const background = await storage.get<{
        type?: string;
        path?: string;
        index?: number;
        mediaId?: string;
      }>(storageKey);

      if (background && typeof background === 'object' && !background.mediaId && typeof background.index === 'number') {
        const builtinIndex = background.index;
        const media = backgroundMedia[builtinIndex];

        if (media) {
          await storage.set(storageKey, {
            ...background,
            mediaId: media.fileName,
          });
        }
      }
    }
  }

  if (fromVersion === 5 && toVersion === 6) {
    const customMediaValue = await storage.get<unknown>(legacyBackgroundStorageKeys.customMedia);
    const customMedia = Array.isArray(customMediaValue) ? customMediaValue as CustomBackgroundMediaItem[] : [];
    const positionsValue = await storage.get<Record<string, HomeBannerPosition>>(homeBannerStorageKeys.positions);
    const positions = (positionsValue && typeof positionsValue === 'object') ? positionsValue : {};
    const mediaIdValue = await storage.get<string>(homeBannerStorageKeys.mediaId);

    if (customMedia.length > 0) {
      const appData = await appDataDir();
      const customBackgroundsDir = `${appData.replace(/\\/g, '/')}/user-data/media/custom-backgrounds`.replace(/\/+/g, '/');

      await invoke('ensure_directory', { directoryPath: customBackgroundsDir });

      const oldIdToNewId: Record<string, string> = {};

      for (const entry of customMedia) {
        const isUrlEntry = typeof entry.path === 'string'
          && (entry.path.startsWith('http://') || entry.path.startsWith('https://'));

        let destFileName: string;

        if (isUrlEntry) {
          let baseName = 'image';

          try {
            const pathname = new URL(entry.path).pathname;
            const segment = pathname.split('/').filter(Boolean).pop();

            if (segment) {
              baseName = segment;
            }
          }
          catch {
          }

          const ext = baseName.includes('.') ? baseName.split('.').pop() ?? 'jpg' : 'jpg';
          const stem = baseName.replace(/\.[^.]+$/, '') || 'image';
          destFileName = `${stem}-${entry.id}.${ext}`;
          const destPath = `${customBackgroundsDir}/${destFileName}`.replace(/\/+/g, '/');

          try {
            await invoke('download_url_to_path', {
              url: entry.path,
              destPath,
            });
          }
          catch {
            continue;
          }

          oldIdToNewId[entry.id] = destFileName;
        }
        else {
          const localPath = entry.path as string;
          const fileName = localPath.split(/[/\\]/).pop() ?? 'image.jpg';
          const normalizedLocalPath = localPath.replace(/\\/g, '/');
          const isAlreadyInDir = normalizedLocalPath.includes('/media/home-banner/')
            || normalizedLocalPath.includes('/media/custom-backgrounds/');

          if (!isAlreadyInDir) {
            try {
              await invoke('copy_items', {
                sourcePaths: [localPath],
                destinationPath: customBackgroundsDir,
                conflictResolution: null,
                perPathResolutions: null,
              });
            }
            catch {
              continue;
            }
          }

          const finalFileName = localPath.split(/[/\\]/).pop() ?? fileName;
          oldIdToNewId[entry.id] = finalFileName;
        }
      }

      const migratedPositions: Record<string, HomeBannerPosition> = {};

      for (const [key, position] of Object.entries(positions)) {
        if (!position || typeof position !== 'object') continue;

        const newKey = oldIdToNewId[key] ?? key;
        migratedPositions[newKey] = {
          positionX: typeof position.positionX === 'number' ? position.positionX : 50,
          positionY: typeof position.positionY === 'number' ? position.positionY : 50,
          zoom: typeof position.zoom === 'number' ? position.zoom : 100,
        };
      }

      await storage.set(homeBannerStorageKeys.positions, migratedPositions);

      let newMediaId = mediaIdValue ?? DEFAULT_BACKGROUND_FILE_NAME;

      if (mediaIdValue && oldIdToNewId[mediaIdValue]) {
        newMediaId = oldIdToNewId[mediaIdValue];
      }

      await storage.set(homeBannerStorageKeys.mediaId, newMediaId);
      await storage.set(legacyBackgroundStorageKeys.customMedia, []);
    }
  }

  if (fromVersion === 7 && toVersion === 8) {
    const existing = await storage.get<boolean>('dateTime.showRelativeModifiedInFileList');

    if (typeof existing !== 'boolean') {
      await storage.set('dateTime.showRelativeModifiedInFileList', true);
    }
  }

  if (fromVersion === 8 && toVersion === 9) {
    const next = await storage.get<boolean>('dateTime.showRelativeDates');

    if (typeof next !== 'boolean') {
      const previous = await storage.get<boolean>('dateTime.showRelativeModifiedInFileList');
      await storage.set(
        'dateTime.showRelativeDates',
        typeof previous === 'boolean' ? previous : true,
      );
    }
  }

  if (fromVersion === 9 && toVersion === 10) {
    const existingIconTheme = await storage.get<string>('navigator.iconTheme');
    const existingFolderIconTheme = await storage.get<string>('navigator.folderIconTheme');
    const existingFileIconTheme = await storage.get<string>('navigator.fileIconTheme');
    const useSystemIconsForDirectories = await storage.get<boolean>('navigator.useSystemIconsForDirectories');
    const useSystemIconsForFiles = await storage.get<boolean>('navigator.useSystemIconsForFiles');
    const folderIconTheme = useSystemIconsForDirectories
      ? BUILTIN_NAVIGATOR_ICON_THEME_IDS.system
      : BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;
    const fileIconTheme = useSystemIconsForFiles
      ? BUILTIN_NAVIGATOR_ICON_THEME_IDS.system
      : BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;

    if (typeof existingIconTheme !== 'string' || existingIconTheme.trim().length === 0) {
      const nextIconTheme = useSystemIconsForDirectories || useSystemIconsForFiles
        ? BUILTIN_NAVIGATOR_ICON_THEME_IDS.system
        : BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;

      await storage.set('navigator.iconTheme', nextIconTheme);
    }

    if (typeof existingFolderIconTheme !== 'string' || existingFolderIconTheme.trim().length === 0) {
      await storage.set('navigator.folderIconTheme', folderIconTheme);
    }

    if (typeof existingFileIconTheme !== 'string' || existingFileIconTheme.trim().length === 0) {
      await storage.set('navigator.fileIconTheme', fileIconTheme);
    }
  }

  if (fromVersion === 10 && toVersion === 11) {
    const existingIconTheme = await storage.get<string>('navigator.iconTheme');
    const existingFolderIconTheme = await storage.get<string>('navigator.folderIconTheme');
    const existingFileIconTheme = await storage.get<string>('navigator.fileIconTheme');

    const fallbackIconTheme = typeof existingIconTheme === 'string' && existingIconTheme.trim().length > 0
      ? existingIconTheme
      : BUILTIN_NAVIGATOR_ICON_THEME_IDS.default;

    if (typeof existingFolderIconTheme !== 'string' || existingFolderIconTheme.trim().length === 0) {
      await storage.set('navigator.folderIconTheme', fallbackIconTheme);
    }

    if (typeof existingFileIconTheme !== 'string' || existingFileIconTheme.trim().length === 0) {
      await storage.set('navigator.fileIconTheme', fallbackIconTheme);
    }
  }

  if (fromVersion === 11 && toVersion === 12) {
    await addDefaultGlobalSearchIgnoredPaths(storage);
  }

  if (fromVersion === 12 && toVersion === 13) {
    await addDefaultGlobalSearchIgnoredPaths(storage, [WINDOWS_WINSXS_IGNORED_PATH]);
  }

  if (fromVersion === 13 && toVersion === 14) {
    await setDefaultBooleanIfMissing(storage, 'navigator.listColumnVisibility.kind', true);
    await setDefaultBooleanIfMissing(storage, 'navigator.listColumnVisibility.links', false);
    await setDefaultBooleanIfMissing(storage, 'navigator.listColumnVisibility.linkTarget', false);
    await setDefaultBooleanIfMissing(storage, 'navigator.listColumnVisibility.linkStatus', false);
  }

  if (fromVersion === 14 && toVersion === 15) {
    const existingColumnWidths = await storage.get<unknown>('navigator.listColumnWidths');
    const isValidColumnWidths = existingColumnWidths
      && typeof existingColumnWidths === 'object'
      && !Array.isArray(existingColumnWidths);
    const hasSavedColumnWidths = isValidColumnWidths && Object.keys(existingColumnWidths).length > 0;

    if (!isValidColumnWidths) {
      await storage.set('navigator.listColumnWidths', {});
    }

    const existingColumnOrder = await storage.get<unknown>('navigator.listColumnOrder');

    if (!Array.isArray(existingColumnOrder)) {
      await storage.set('navigator.listColumnOrder', ['items', 'size', 'modified', 'created', 'tags', 'kind', 'links', 'linkStatus']);
    }

    await setDefaultBooleanIfMissing(storage, 'navigator.listColumnFillWidth', !hasSavedColumnWidths);

    const existingColumnFlexWeights = await storage.get<unknown>('navigator.listColumnFlexWeights');

    if (!existingColumnFlexWeights || typeof existingColumnFlexWeights !== 'object' || Array.isArray(existingColumnFlexWeights)) {
      await storage.set('navigator.listColumnFlexWeights', {});
    }
  }

  if (fromVersion === 15 && toVersion === 16) {
    await setDefaultBooleanIfMissing(storage, 'navigator.infoPanel.showFullSizeImagePreview', false);
  }

  if (fromVersion === 16 && toVersion === 17) {
    const existingGridSortColumn = await storage.get<unknown>('navigator.gridSortColumn');

    if (existingGridSortColumn === undefined || existingGridSortColumn === null) {
      await storage.set('navigator.gridSortColumn', 'name');
    }

    const existingGridSortDirection = await storage.get<unknown>('navigator.gridSortDirection');

    if (existingGridSortDirection !== 'asc' && existingGridSortDirection !== 'desc') {
      await storage.set('navigator.gridSortDirection', 'asc');
    }
  }

  if (fromVersion === 17 && toVersion === 18) {
    await setDefaultBooleanIfMissing(storage, 'navigator.infoPanel.muteVideoPreviewByDefault', false);
    await setDefaultBooleanIfMissing(storage, 'navigator.infoPanel.autoplayVideoPreview', false);
  }

  if (fromVersion === 18 && toVersion === 19) {
    await setDefaultBooleanIfMissing(storage, 'performance.prelaunchQuickViewWindow', true);
    await setDefaultBooleanIfMissing(storage, 'performance.prelaunchPrintViewWindow', false);
  }

  if (fromVersion === 19 && toVersion === 20) {
    await setDefaultBooleanIfMissing(storage, 'clipboard.showToolbarForExternalImages', true);
    await setDefaultBooleanIfMissing(storage, 'clipboard.showToolbarForExternalPaths', true);
  }

  if (fromVersion === 20 && toVersion === 21) {
    await setDefaultBooleanIfMissing(storage, 'navigator.enableMarqueeBoxSelection', false);
  }

  if (fromVersion === 21 && toVersion === 22) {
    const boxSelectionEnabled = await storage.get<boolean>('navigator.enableMarqueeBoxSelection');
    await setDefaultBooleanIfMissing(
      storage,
      'navigator.increaseMarqueeSelectionGaps',
      boxSelectionEnabled === true,
    );
  }

  if (fromVersion === 22 && toVersion === 23) {
    const increasedGaps = await storage.get<boolean>('navigator.increaseMarqueeSelectionGaps');
    await setDefaultBooleanIfMissing(
      storage,
      'navigator.increaseFileViewGaps',
      increasedGaps === true,
    );
  }

  if (fromVersion === 23 && toVersion === 24) {
    const legacyBoxSelectionEnabled = await storage.get<boolean>('navigator.enableMarqueeBoxSelection');
    const currentBoxSelectionEnabled = await storage.get<boolean>('navigator.enableBoxSelection');
    await setDefaultBooleanIfMissing(
      storage,
      'navigator.enableBoxSelection',
      currentBoxSelectionEnabled ?? legacyBoxSelectionEnabled === true,
    );
  }

  if (fromVersion === 6 && toVersion === 7) {
    const appData = await appDataDir();
    const mediaDir = `${appData.replace(/\\/g, '/')}/user-data/media`.replace(/\/+/g, '/');
    const oldCustomBackgroundsDir = `${mediaDir}/home-banner`.replace(/\/+/g, '/');
    const newCustomBackgroundsDir = `${mediaDir}/custom-backgrounds`.replace(/\/+/g, '/');

    try {
      const oldDirExists = await invoke<boolean>('path_exists', { path: oldCustomBackgroundsDir });
      const newDirExists = await invoke<boolean>('path_exists', { path: newCustomBackgroundsDir });

      if (oldDirExists && !newDirExists) {
        await invoke('rename_item', {
          sourcePath: oldCustomBackgroundsDir,
          newName: 'custom-backgrounds',
        });
      }
    }
    catch {
    }
  }

  void storage;
}

async function addDefaultGlobalSearchIgnoredPaths(
  storage: StorageAdapter,
  defaultPaths = DEFAULT_GLOBAL_SEARCH_IGNORED_PATHS,
) {
  const ignoredPathsValue = await storage.get<unknown>('globalSearch.ignoredPaths');
  const ignoredPaths = Array.isArray(ignoredPathsValue)
    ? ignoredPathsValue.filter((path): path is string => typeof path === 'string')
    : [];
  const normalizedPaths = new Set(ignoredPaths.map(path => path.toLowerCase()));
  const nextIgnoredPaths = [...ignoredPaths];

  for (const defaultPath of defaultPaths) {
    if (!normalizedPaths.has(defaultPath.toLowerCase())) {
      nextIgnoredPaths.push(defaultPath);
    }
  }

  await storage.set('globalSearch.ignoredPaths', nextIgnoredPaths);
}

async function setDefaultBooleanIfMissing(
  storage: StorageAdapter,
  key: string,
  defaultValue: boolean,
) {
  const existingValue = await storage.get<unknown>(key);

  if (typeof existingValue !== 'boolean') {
    await storage.set(key, defaultValue);
  }
}

export async function migrateUserSettingsStorage(storage: StorageAdapter) {
  await migrateStorageSchema({
    storage,
    schemaVersionKey: USER_SETTINGS_SCHEMA_VERSION_KEY,
    latestSchemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    migrateStep: migrateUserSettingsStep,
  });
}
