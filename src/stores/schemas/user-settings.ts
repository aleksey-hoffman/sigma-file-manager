// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { UserSettings } from '@/types/user-settings';
import type { StorageAdapter } from './schema-utils';
import type { HomeBannerCustomMediaItem, HomeBannerPosition } from '@/types/user-settings';
import { collectNestedRecordPaths, migrateStorageSchema } from './schema-utils';
import { homeBannerMedia, DEFAULT_HOME_BANNER_FILE_NAME } from '@/data/home-banner-media';

export const USER_SETTINGS_SCHEMA_VERSION_KEY = '__schemaVersion';
export const USER_SETTINGS_SCHEMA_VERSION = 5;

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
    const customMediaValue = await storage.get<unknown>('homeBannerCustomMedia');
    let migratedCustom: HomeBannerCustomMediaItem[] = [];

    if (Array.isArray(customMediaValue)) {
      const isLegacyFormat = customMediaValue.length > 0 && typeof customMediaValue[0] === 'string';

      if (isLegacyFormat) {
        migratedCustom = (customMediaValue as string[]).map(path => ({
          path,
          id: generateShortId(),
        }));
        await storage.set('homeBannerCustomMedia', migratedCustom);
      }
      else {
        migratedCustom = customMediaValue as HomeBannerCustomMediaItem[];
      }
    }

    const positionsValue = await storage.get<Record<string, HomeBannerPosition>>('homeBannerPositions');
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

          if (builtinIndex >= 0 && builtinIndex < homeBannerMedia.length) {
            migratedPositions[homeBannerMedia[builtinIndex].fileName] = validPosition;
          }
        }
      }

      await storage.set('homeBannerPositions', migratedPositions);
    }
  }

  if (fromVersion === 3 && toVersion === 4) {
    const mediaIdValue = await storage.get<string>('homeBannerMediaId');
    const indexValue = await storage.get<number>('homeBannerIndex');

    if (!mediaIdValue || typeof mediaIdValue !== 'string' || mediaIdValue.trim() === '') {
      const customMediaValue = await storage.get<HomeBannerCustomMediaItem[] | string[]>('homeBannerCustomMedia');
      const customCount = Array.isArray(customMediaValue) ? customMediaValue.length : 0;
      const rawIndex = typeof indexValue === 'number' ? indexValue : 0;
      const totalCount = customCount + homeBannerMedia.length;

      let resolvedMediaId = DEFAULT_HOME_BANNER_FILE_NAME;

      if (totalCount > 0 && rawIndex >= 0 && rawIndex < totalCount) {
        if (rawIndex < customCount) {
          const entry = (customMediaValue as HomeBannerCustomMediaItem[])?.[rawIndex];

          if (entry && typeof entry === 'object' && entry.id) {
            resolvedMediaId = entry.id;
          }
        }
        else {
          const builtinIndex = rawIndex - customCount;
          const media = homeBannerMedia[builtinIndex];

          if (media) {
            resolvedMediaId = media.fileName;
          }
        }
      }

      await storage.set('homeBannerMediaId', resolvedMediaId);
    }
  }

  if (fromVersion === 4 && toVersion === 5) {
    const infusionPageKeys = ['global', 'home', 'navigator', 'dashboard', 'settings', 'extensions'];

    for (const pageKey of infusionPageKeys) {
      const storageKey = `infusion.pages.${pageKey}.background`;
      const background = await storage.get<{ type?: string;
        path?: string;
        index?: number;
        mediaId?: string; }>(storageKey);

      if (background && typeof background === 'object' && !background.mediaId && typeof background.index === 'number') {
        const builtinIndex = background.index;
        const media = homeBannerMedia[builtinIndex];

        if (media) {
          await storage.set(storageKey, {
            ...background,
            mediaId: media.fileName,
          });
        }
      }
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
