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

export const USER_SETTINGS_SCHEMA_VERSION_KEY = '__schemaVersion';
export const USER_SETTINGS_SCHEMA_VERSION = 9;

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

export async function migrateUserSettingsStorage(storage: StorageAdapter) {
  await migrateStorageSchema({
    storage,
    schemaVersionKey: USER_SETTINGS_SCHEMA_VERSION_KEY,
    latestSchemaVersion: USER_SETTINGS_SCHEMA_VERSION,
    migrateStep: migrateUserSettingsStep,
  });
}
