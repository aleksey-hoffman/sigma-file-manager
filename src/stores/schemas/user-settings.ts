// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { UserSettings } from '@/types/user-settings';
import type { StorageAdapter } from './schema-utils';
import type { CustomBackgroundMediaItem, HomeBannerPosition } from '@/types/user-settings';
import { collectNestedRecordPaths, isRecord, migrateStorageSchema } from './schema-utils';
import { backgroundMedia, DEFAULT_BACKGROUND_FILE_NAME } from '@/data/background-media';
import { invoke } from '@tauri-apps/api/core';
import { appDataDir } from '@tauri-apps/api/path';
import {
  homeBannerStorageKeys,
  legacyBackgroundStorageKeys,
} from '@/modules/home/background-storage-keys';
import { BUILTIN_NAVIGATOR_ICON_THEME_IDS } from '@/types/icon-theme';

export const USER_SETTINGS_SCHEMA_VERSION_KEY = '__schemaVersion';
export const USER_SETTINGS_SCHEMA_VERSION = 32;

/**
 * 搜索深度默认值，同时也是 `global-search` 索引与目录内递归搜索共用的层数上限。
 *
 * FORK-MODIFICATION: 2026-10-16 —— 由 7 提到 9。放在这里而不是散在各个调用点的
 * 字面量里，是为了让「迁移时认得出旧默认值」成为一件可验证的事：
 * 迁移步骤靠 `LEGACY_DEFAULT_SCAN_DEPTH` 判断「这个 7 是旧默认还是用户自己设的」。
 */
export const DEFAULT_SCAN_DEPTH = 9;
export const LEGACY_DEFAULT_SCAN_DEPTH = 7;

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

  if (fromVersion === 24 && toVersion === 25) {
    const storedLanguage = await storage.get<unknown>('language');

    if (isRecord(storedLanguage) && typeof storedLanguage.isCorrected === 'boolean') {
      const { isCorrected, ...languageWithoutLegacyFlag } = storedLanguage;

      await storage.set('language', {
        ...languageWithoutLegacyFlag,
        isHumanReviewed: typeof storedLanguage.isHumanReviewed === 'boolean'
          ? storedLanguage.isHumanReviewed
          : isCorrected,
      });
    }
  }

  if (fromVersion === 25 && toVersion === 26) {
    const existingFolderSettings = await storage.get<unknown>('navigator.folderSettings');

    if (!isRecord(existingFolderSettings)) {
      await storage.set('navigator.folderSettings', {});
    }
  }

  // FORK-MODIFICATION: 可关闭的文件夹优先排序（上游 #529/#481/#482）
  // 默认 true，等同改动前的硬编码置顶；已有取值一律不覆盖。
  if (fromVersion === 26 && toVersion === 27) {
    await setDefaultBooleanIfMissing(storage, 'navigator.foldersFirst', true);
  }

  // FORK-MODIFICATION: 框选迁移强制开启（上游 #465）。
  // 框选功能早已实现且含单测，但默认关闭导致用户不进设置就用不了（#465）。
  // 这是**覆盖写**而非 setDefaultBooleanIfMissing —— 已确认要覆盖用户此前的关闭选择。
  // 补偿措施：设置项下方有说明文案，告知可在此再次关闭。
  if (fromVersion === 27 && toVersion === 28) {
    await storage.set('navigator.enableBoxSelection', true);
  }

  // FORK-MODIFICATION: 列表视图缩略图（上游 #231）。
  // 用「缺失才写」而非覆盖写：缩略图是全新功能，用户此前没有这个选项，
  // 不存在「此前的选择」被覆盖的问题。覆盖写会让用户日后主动关掉后，
  // 每升一次版又被强行打开。
  if (fromVersion === 28 && toVersion === 29) {
    await setDefaultBooleanIfMissing(storage, 'navigator.showListThumbnails', true);
  }

  // FORK-MODIFICATION: 缩略图大小三档（small / medium / large），默认 medium。
  // 用「缺失才写」而非覆盖写：与 29 步相同理由（用户主动选择不应被升级冲掉）。
  if (fromVersion === 29 && toVersion === 30) {
    await setDefaultEnumIfMissing(storage, 'navigator.thumbnailSize', 'medium', ['small', 'medium', 'large']);
  }

  // FORK-MODIFICATION: 缩略图四档（新增 xlarge = 80 像素 / 行高 96 逻辑像素）。
  // 档位参数（缩略图像素 32/48/64/80、行高 48/64/80/96）的唯一度量来源是
  // navigator/components/file-browser/utils/file-browser-thumbnail-sizes.ts，这里不重复记录。
  // 仍走 setDefaultEnumIfMissing —— 已有值不动;allowed 扩到 4 档让 schema 校验更松。
  if (fromVersion === 30 && toVersion === 31) {
    await setDefaultEnumIfMissing(storage, 'navigator.thumbnailSize', 'medium', ['small', 'medium', 'large', 'xlarge']);
  }

  // FORK-MODIFICATION: 2026-10-16 —— 搜索深度默认 7 → 9（用户反馈）。
  //
  // 这一步**必须走迁移**，不能只改 DEFAULT_USER_SETTINGS：已装机的用户
  // user-settings.json 里已经写着 globalSearch.scanDepth = 7，只改默认值
  // 对他们完全无效 —— 界面显示 7 层，磁盘上也只扫 7 层，而用户以为自己改了默认值。
  // 只有 schema 版本递进才会让已有数据也走到这一步。
  //
  // 判定写成「当前值恰好是旧默认 7」而不是无条件覆盖：用户自己把深度调到别的值
  // 之后升级，不该被这步迁移按回 9。
  if (fromVersion === 31 && toVersion === 32) {
    const existingDepth = await storage.get<unknown>('globalSearch.scanDepth');

    if (typeof existingDepth !== 'number' || existingDepth === LEGACY_DEFAULT_SCAN_DEPTH) {
      await storage.set('globalSearch.scanDepth', DEFAULT_SCAN_DEPTH);
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

async function setDefaultEnumIfMissing<T extends string>(
  storage: StorageAdapter,
  key: string,
  defaultValue: T,
  allowed: readonly T[],
) {
  const existingValue = await storage.get<unknown>(key);

  if (typeof existingValue !== 'string' || !allowed.includes(existingValue as T)) {
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
