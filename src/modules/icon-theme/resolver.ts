// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { IconThemeMatchTarget, LoadedIconThemeDefinition } from '@/types/icon-theme';

type ParsedAssociationKey = {
  parentName: string | null;
  value: string;
};

function normalizeAssociationValue(value: string): string {
  return value.trim().toLowerCase();
}

function parseAssociationKey(rawKey: string): ParsedAssociationKey | null {
  const normalizedKey = rawKey.trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');

  if (!normalizedKey) {
    return null;
  }

  const separatorIndex = normalizedKey.indexOf('/');

  if (separatorIndex === -1) {
    return {
      parentName: null,
      value: normalizeAssociationValue(normalizedKey),
    };
  }

  const parentName = normalizedKey.slice(0, separatorIndex).trim();
  const value = normalizedKey.slice(separatorIndex + 1).trim();

  if (!parentName || !value || value.includes('/')) {
    return null;
  }

  return {
    parentName: normalizeAssociationValue(parentName),
    value: normalizeAssociationValue(value),
  };
}

function resolveAssociationRecord(
  associations: Record<string, string> | undefined,
  value: string,
  parentName: string | null,
): string | null {
  if (!associations) {
    return null;
  }

  let fallbackMatch: string | null = null;

  for (const [rawKey, definitionId] of Object.entries(associations)) {
    const parsedKey = parseAssociationKey(rawKey);

    if (!parsedKey || parsedKey.value !== value) {
      continue;
    }

    if (parsedKey.parentName) {
      if (parentName && parsedKey.parentName === parentName) {
        return definitionId;
      }

      continue;
    }

    fallbackMatch = definitionId;
  }

  return fallbackMatch;
}

function getDefinitionSrc(theme: LoadedIconThemeDefinition, definitionId: string | null | undefined): string | null {
  if (!definitionId) {
    return null;
  }

  return theme.iconDefinitions[definitionId]?.src ?? null;
}

export function getFileExtensionCandidates(fileName: string): string[] {
  const normalizedName = fileName.trim().toLowerCase();

  if (!normalizedName.includes('.')) {
    return [];
  }

  const segments = normalizedName.split('.');
  const candidates: string[] = [];

  for (let index = 1; index < segments.length; index += 1) {
    const candidate = segments.slice(index).join('.');

    if (candidate) {
      candidates.push(candidate);
    }
  }

  return candidates;
}

export function resolveLoadedIconThemeIcon(
  theme: LoadedIconThemeDefinition,
  target: IconThemeMatchTarget,
): string | null {
  const normalizedName = normalizeAssociationValue(target.name);
  const normalizedParentName = target.parentName ? normalizeAssociationValue(target.parentName) : null;

  if (target.isDirectory) {
    const folderNameMatch = resolveAssociationRecord(
      theme.folderNames,
      normalizedName,
      normalizedParentName,
    );

    return getDefinitionSrc(theme, folderNameMatch ?? theme.folder ?? theme.folderExpanded);
  }

  const fileNameMatch = resolveAssociationRecord(
    theme.fileNames,
    normalizedName,
    normalizedParentName,
  );

  if (fileNameMatch) {
    return getDefinitionSrc(theme, fileNameMatch);
  }

  const normalizedExtension = target.extension?.trim().toLowerCase() || null;
  const extensionCandidates = getFileExtensionCandidates(target.name);

  if (normalizedExtension && !extensionCandidates.includes(normalizedExtension)) {
    extensionCandidates.push(normalizedExtension);
  }

  for (const candidate of extensionCandidates) {
    const extensionMatch = resolveAssociationRecord(
      theme.fileExtensions,
      candidate,
      normalizedParentName,
    );

    if (extensionMatch) {
      return getDefinitionSrc(theme, extensionMatch);
    }
  }

  return getDefinitionSrc(theme, theme.file);
}
