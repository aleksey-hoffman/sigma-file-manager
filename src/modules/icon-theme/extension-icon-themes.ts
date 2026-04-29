// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import type { ExtensionIconThemeContribution } from '@sigma-file-manager/api';
import type { InstalledExtension } from '@/types/extension';
import {
  BUILTIN_NAVIGATOR_ICON_THEME_IDS,
  createExtensionNavigatorIconThemeId,
  parseNavigatorIconThemeId,
  type LoadedIconThemeDefinition,
  type NavigatorIconThemeOption,
} from '@/types/icon-theme';
import { invokeAsExtension } from '@/modules/extensions/runtime/extension-invoke';

const iconThemeCache = new Map<string, Promise<LoadedIconThemeDefinition | null>>();

function normalizeRelativePath(path: string, options?: { allowParentSegments?: boolean }): string {
  const trimmedPath = path.trim();

  if (!trimmedPath || /^[A-Za-z]:[\\/]/.test(trimmedPath) || trimmedPath.startsWith('/') || trimmedPath.startsWith('\\')) {
    throw new Error('Icon theme paths must be relative');
  }

  const rawSegments = trimmedPath
    .replace(/\\/g, '/')
    .split('/')
    .filter(segment => segment.length > 0);

  if (rawSegments.length === 0) {
    throw new Error('Icon theme path is invalid');
  }

  const segments: string[] = [];

  for (const segment of rawSegments) {
    if (segment === '.') {
      continue;
    }

    if (segment === '..') {
      if (!options?.allowParentSegments || segments.length === 0) {
        throw new Error('Icon theme path is invalid');
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  if (segments.length === 0) {
    throw new Error('Icon theme path is invalid');
  }

  return segments.join('/');
}

export function resolveThemeRelativePath(themeFilePath: string, assetPath: string): string {
  const normalizedThemeFilePath = normalizeRelativePath(themeFilePath);
  const themeDirectorySegments = normalizedThemeFilePath.split('/').slice(0, -1);
  const combinedPath = [...themeDirectorySegments, assetPath.trim()].join('/');
  return normalizeRelativePath(combinedPath, { allowParentSegments: true });
}

function getThemeCacheKey(extension: InstalledExtension, contribution: ExtensionIconThemeContribution): string {
  return `${extension.id}:${extension.version}:${extension.installedAt}:${contribution.id}:${contribution.path}`;
}

function getExtensionDisplayThemeLabel(contribution: ExtensionIconThemeContribution): string {
  return contribution.label;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function loadContributedIconTheme(
  extension: InstalledExtension,
  contribution: ExtensionIconThemeContribution,
): Promise<LoadedIconThemeDefinition | null> {
  const themeFilePath = normalizeRelativePath(contribution.path);
  const bytes = await invokeAsExtension<number[]>(
    extension.id,
    'read_extension_file',
    {
      extensionId: extension.id,
      filePath: themeFilePath,
    },
  );
  const jsonText = new TextDecoder().decode(new Uint8Array(bytes));
  const rawTheme = JSON.parse(jsonText) as unknown;

  if (!isObjectRecord(rawTheme)) {
    throw new Error(`Icon theme ${contribution.id} is invalid`);
  }

  const rawDefinitions = isObjectRecord(rawTheme.iconDefinitions)
    ? rawTheme.iconDefinitions
    : {};
  const iconDefinitions: LoadedIconThemeDefinition['iconDefinitions'] = {};
  const extensionPath = await invokeAsExtension<string>(
    extension.id,
    'get_extension_path',
    { extensionId: extension.id },
  );

  for (const [definitionId, definitionValue] of Object.entries(rawDefinitions)) {
    if (!isObjectRecord(definitionValue) || typeof definitionValue.iconPath !== 'string') {
      continue;
    }

    try {
      const relativeAssetPath = resolveThemeRelativePath(themeFilePath, definitionValue.iconPath);
      const assetPath = await join(extensionPath, relativeAssetPath);
      iconDefinitions[definitionId] = {
        src: convertFileSrc(assetPath),
      };
    }
    catch {
    }
  }

  function normalizeAssociationRecord(value: unknown): Record<string, string> | undefined {
    if (!isObjectRecord(value)) {
      return undefined;
    }

    const record: Record<string, string> = {};

    for (const [key, associationValue] of Object.entries(value)) {
      if (typeof associationValue === 'string' && key.trim()) {
        record[key] = associationValue;
      }
    }

    return Object.keys(record).length > 0 ? record : undefined;
  }

  return {
    iconDefinitions,
    file: typeof rawTheme.file === 'string' ? rawTheme.file : undefined,
    folder: typeof rawTheme.folder === 'string' ? rawTheme.folder : undefined,
    folderExpanded: typeof rawTheme.folderExpanded === 'string' ? rawTheme.folderExpanded : undefined,
    fileExtensions: normalizeAssociationRecord(rawTheme.fileExtensions),
    fileNames: normalizeAssociationRecord(rawTheme.fileNames),
    folderNames: normalizeAssociationRecord(rawTheme.folderNames),
    folderNamesExpanded: normalizeAssociationRecord(rawTheme.folderNamesExpanded),
  };
}

export function getBuiltinNavigatorIconThemeOptions(
  translate: (key: string) => string,
): NavigatorIconThemeOption[] {
  return [
    {
      id: BUILTIN_NAVIGATOR_ICON_THEME_IDS.default,
      label: translate('terminal.defaultLabel'),
      source: 'builtin',
    },
    {
      id: BUILTIN_NAVIGATOR_ICON_THEME_IDS.system,
      label: translate('system'),
      source: 'builtin',
    },
  ];
}

export function getExtensionNavigatorIconThemeOptions(
  extensions: InstalledExtension[],
): NavigatorIconThemeOption[] {
  const options: NavigatorIconThemeOption[] = [];

  for (const extension of extensions) {
    const iconThemes = extension.manifest.contributes?.iconThemes ?? [];

    for (const contribution of iconThemes) {
      options.push({
        id: createExtensionNavigatorIconThemeId(extension.id, contribution.id),
        label: getExtensionDisplayThemeLabel(contribution),
        source: 'extension',
        extensionId: extension.id,
        themeId: contribution.id,
      });
    }
  }

  return options.sort((left, right) => left.label.localeCompare(right.label));
}

export function findInstalledIconThemeContribution(
  extensions: InstalledExtension[],
  iconThemeId: string | null | undefined,
): {
  extension: InstalledExtension;
  contribution: ExtensionIconThemeContribution;
} | null {
  const parsed = parseNavigatorIconThemeId(iconThemeId);

  if (!parsed || parsed.kind !== 'extension') {
    return null;
  }

  const extension = extensions.find(candidate => candidate.id === parsed.extensionId);

  if (!extension) {
    return null;
  }

  const contribution = extension.manifest.contributes?.iconThemes?.find(
    candidate => candidate.id === parsed.themeId,
  );

  if (!contribution) {
    return null;
  }

  return {
    extension,
    contribution,
  };
}

export async function loadInstalledIconTheme(
  extensions: InstalledExtension[],
  iconThemeId: string | null | undefined,
): Promise<LoadedIconThemeDefinition | null> {
  const match = findInstalledIconThemeContribution(extensions, iconThemeId);

  if (!match) {
    return null;
  }

  const cacheKey = getThemeCacheKey(match.extension, match.contribution);
  const cached = iconThemeCache.get(cacheKey);

  if (cached) {
    return await cached;
  }

  const loadPromise = loadContributedIconTheme(match.extension, match.contribution)
    .then((result) => {
      if (result === null) {
        iconThemeCache.delete(cacheKey);
      }

      return result;
    })
    .catch((error) => {
      iconThemeCache.delete(cacheKey);
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Failed to load icon theme ${match.extension.id}.${match.contribution.id}: ${message}`);
      return null;
    });

  iconThemeCache.set(cacheKey, loadPromise);
  return await loadPromise;
}
