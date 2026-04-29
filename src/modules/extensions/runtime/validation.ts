// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { ExtensionManifest, ExtensionPermission, ExtensionRegistry, ExtensionRegistryEntry } from '@/types/extension';
import { compareVersions } from '@/data/extensions';

type RegistryVersionMetadata = {
  integrity?: string;
  manifest?: string;
};

const EXTENSION_ID_PATTERN = /^[a-z0-9-]+\.[a-z0-9-]+$/;

const VALID_PERMISSIONS: string[] = [
  'contextMenu',
  'sidebar',
  'toolbar',
  'commands',
  'fs.read',
  'fs.write',
  'notifications',
  'dialogs',
  'shell',
  'clipboard',
  'openUrl',
];

const VALID_PLATFORMS = ['windows', 'macos', 'linux'] as const;
const VALID_ARCHES = ['x64', 'arm64'] as const;
const EXTENSION_THEME_ID_PATTERN = /^[a-z0-9-]+$/;

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidExtensionType(value: unknown): value is ExtensionManifest['extensionType'] {
  return value === 'api' || value === 'iframe' || value === 'webview';
}

function isVersionString(value: string): boolean {
  return /^\d+\.\d+\.\d+(?:-[\w.]+)?$/.test(value);
}

function isPermissionsList(value: unknown): value is ExtensionPermission[] {
  return Array.isArray(value) && value.every(permission => VALID_PERMISSIONS.includes(permission as ExtensionPermission));
}

function isValidPlatform(value: unknown): value is (typeof VALID_PLATFORMS)[number] {
  return typeof value === 'string' && VALID_PLATFORMS.includes(value as (typeof VALID_PLATFORMS)[number]);
}

function isValidPlatformList(value: unknown): value is NonNullable<ExtensionManifest['platforms']> {
  return Array.isArray(value)
    && value.length > 0
    && value.every(isValidPlatform)
    && new Set(value).size === value.length;
}

function isValidArchList(value: unknown): boolean {
  return Array.isArray(value)
    && value.length > 0
    && value.every(arch => typeof arch === 'string' && VALID_ARCHES.includes(arch as (typeof VALID_ARCHES)[number]))
    && new Set(value).size === value.length;
}

function isSafeRelativePath(value: string): boolean {
  if (!value.trim() || /^[a-zA-Z]:/.test(value) || value.startsWith('/') || value.startsWith('\\')) {
    return false;
  }

  const pathSegments = value.split(/[\\/]+/).filter(segment => segment.length > 0);
  return pathSegments.length > 0 && pathSegments.every(segment => segment !== '.' && segment !== '..');
}

function isValidIntegrity(value: unknown): value is string {
  return typeof value === 'string' && /^sha256:[a-f0-9]{64}$/i.test(value.trim());
}

function isValidThemeVariables(value: unknown): value is Record<`--${string}`, string> {
  if (!isObjectRecord(value)) {
    return false;
  }

  const entries = Object.entries(value);

  if (entries.length === 0) {
    return false;
  }

  return entries.every(([key, cssValue]) => {
    return /^--[a-zA-Z0-9-]+$/.test(key)
      && isNonEmptyString(cssValue);
  });
}

function isValidThemeContribution(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.id) || !EXTENSION_THEME_ID_PATTERN.test(value.id)) {
    return false;
  }

  if (!isNonEmptyString(value.title)) {
    return false;
  }

  if (value.description !== undefined && !isNonEmptyString(value.description)) {
    return false;
  }

  if (value.baseTheme !== 'light' && value.baseTheme !== 'dark') {
    return false;
  }

  if (!isValidThemeVariables(value.variables)) {
    return false;
  }

  return true;
}

function isValidManifestContributions(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (value.themes !== undefined) {
    if (!Array.isArray(value.themes) || value.themes.some(theme => !isValidThemeContribution(theme))) {
      return false;
    }

    const seenThemeIds = new Set<string>();

    for (const theme of value.themes) {
      if (!isObjectRecord(theme) || !isNonEmptyString(theme.id) || seenThemeIds.has(theme.id)) {
        return false;
      }

      seenThemeIds.add(theme.id);
    }
  }

  return true;
}

function hasThemeContributions(value: unknown): boolean {
  return isObjectRecord(value)
    && Array.isArray(value.themes)
    && value.themes.length > 0;
}

function canOmitManifestMain(value: Record<string, unknown>): boolean {
  if (value.extensionType !== 'api' || !hasThemeContributions(value.contributes)) {
    return false;
  }

  return isObjectRecord(value.contributes)
    && Object.keys(value.contributes).every(contributionKey => contributionKey === 'themes');
}

function isValidManifestBinaryAsset(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isValidPlatform(value.platform)) {
    return false;
  }

  if (!isNonEmptyString(value.downloadUrl)) {
    return false;
  }

  if (!isValidIntegrity(value.integrity)) {
    return false;
  }

  if (value.arch !== undefined && !isValidArchList(value.arch)) {
    return false;
  }

  if (value.archive !== undefined && typeof value.archive !== 'boolean') {
    return false;
  }

  if (value.executable !== undefined && (!isNonEmptyString(value.executable) || !isSafeRelativePath(value.executable))) {
    return false;
  }

  return true;
}

function isValidManifestBinaryDefinition(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    return false;
  }

  if (!isNonEmptyString(value.version)) {
    return false;
  }

  if (value.repository !== undefined && !isNonEmptyString(value.repository)) {
    return false;
  }

  if (value.executable !== undefined && (!isNonEmptyString(value.executable) || !isSafeRelativePath(value.executable))) {
    return false;
  }

  if (value.platforms !== undefined && !isValidPlatformList(value.platforms)) {
    return false;
  }

  if (!Array.isArray(value.assets) || value.assets.length === 0 || value.assets.some(asset => !isValidManifestBinaryAsset(asset))) {
    return false;
  }

  const seenTargets = new Set<string>();

  for (const asset of value.assets) {
    const targetPlatforms = value.platforms as string[] | undefined;

    if (targetPlatforms && !targetPlatforms.includes(asset.platform as string)) {
      return false;
    }

    const archKey = Array.isArray(asset.arch) ? [...asset.arch].sort().join(',') : '*';
    const targetKey = `${asset.platform}:${archKey}`;

    if (seenTargets.has(targetKey)) {
      return false;
    }

    seenTargets.add(targetKey);
  }

  return true;
}

function parseVersionComparator(value: string): {
  operator: string;
  version: string;
} | null {
  const match = value.trim().match(/^(<=|>=|<|>|=)?\s*(\d+\.\d+\.\d+(?:-[\w.]+)?)$/);

  if (!match) {
    return null;
  }

  return {
    operator: match[1] || '=',
    version: match[2],
  };
}

function isMatchingPrereleaseForReleaseRequirement(appVersion: string, requiredVersion: string): boolean {
  const appVersionParts = appVersion.split('-');
  const requiredVersionParts = requiredVersion.split('-');
  return appVersionParts.length > 1
    && requiredVersionParts.length === 1
    && appVersionParts[0] === requiredVersion;
}

export function isVersionCompatibleWithRange(appVersion: string, range: string): boolean {
  const comparators = range
    .split(/[\s,]+/)
    .map(part => part.trim())
    .filter(part => part.length > 0);

  if (comparators.length === 0) {
    return false;
  }

  for (const comparatorText of comparators) {
    const comparator = parseVersionComparator(comparatorText);

    if (!comparator) {
      return false;
    }

    const comparisonResult = compareVersions(appVersion, comparator.version);

    if (comparator.operator === '>' && comparisonResult <= 0) {
      return false;
    }

    if (
      comparator.operator === '>='
      && comparisonResult < 0
      && !isMatchingPrereleaseForReleaseRequirement(appVersion, comparator.version)
    ) {
      return false;
    }

    if (comparator.operator === '<' && comparisonResult >= 0) {
      return false;
    }

    if (comparator.operator === '<=' && comparisonResult > 0) {
      return false;
    }

    if (comparator.operator === '=' && comparisonResult !== 0) {
      return false;
    }
  }

  return true;
}

function isValidRegistryVersionMetadata(value: unknown): value is RegistryVersionMetadata {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (value.integrity !== undefined && !isNonEmptyString(value.integrity)) {
    return false;
  }

  if (value.manifest !== undefined && !isNonEmptyString(value.manifest)) {
    return false;
  }

  return true;
}

function isValidRegistryPublisher(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false;
  }

  if (!isNonEmptyString(value.name)) {
    return false;
  }

  if (value.url !== undefined && !isNonEmptyString(value.url)) {
    return false;
  }

  return Object.keys(value).every(key => key === 'name' || key === 'url');
}

function isValidRegistryEntry(entryValue: unknown): entryValue is ExtensionRegistryEntry {
  if (!isObjectRecord(entryValue)) {
    return false;
  }

  if (!isNonEmptyString(entryValue.id) || !EXTENSION_ID_PATTERN.test(entryValue.id)) {
    return false;
  }

  if (!isNonEmptyString(entryValue.name)) {
    return false;
  }

  if (!isNonEmptyString(entryValue.description)) {
    return false;
  }

  if (!isValidRegistryPublisher(entryValue.publisher)) {
    return false;
  }

  if (!isNonEmptyString(entryValue.repository)) {
    return false;
  }

  if (typeof entryValue.featured !== 'boolean') {
    return false;
  }

  if (!Array.isArray(entryValue.categories) || entryValue.categories.length === 0 || entryValue.categories.some(category => !isNonEmptyString(category))) {
    return false;
  }

  if (entryValue.tags !== undefined && (!Array.isArray(entryValue.tags) || entryValue.tags.some(tag => !isNonEmptyString(tag)))) {
    return false;
  }

  if (entryValue.integrity !== undefined && !isNonEmptyString(entryValue.integrity)) {
    return false;
  }

  if (entryValue.releaseMetadata !== undefined) {
    if (!isObjectRecord(entryValue.releaseMetadata)) {
      return false;
    }

    for (const [versionKey, versionMetadata] of Object.entries(entryValue.releaseMetadata)) {
      if (!isVersionString(versionKey) || !isValidRegistryVersionMetadata(versionMetadata)) {
        return false;
      }
    }
  }

  return true;
}

export function assertValidRegistryData(data: unknown): asserts data is ExtensionRegistry {
  if (!isObjectRecord(data)) {
    throw new Error('Invalid registry: expected object');
  }

  if (!isNonEmptyString(data.schemaVersion) || !isVersionString(data.schemaVersion)) {
    throw new Error('Invalid registry: schemaVersion is missing or invalid');
  }

  if (!Array.isArray(data.extensions)) {
    throw new Error('Invalid registry: extensions must be an array');
  }

  for (const extensionEntry of data.extensions) {
    if (!isValidRegistryEntry(extensionEntry)) {
      throw new Error('Invalid registry: extension entry failed validation');
    }
  }
}

export function assertValidManifestData(data: unknown): asserts data is ExtensionManifest {
  if (!isObjectRecord(data)) {
    throw new Error('Invalid manifest: expected object');
  }

  if (!isNonEmptyString(data.id) || !EXTENSION_ID_PATTERN.test(data.id)) {
    throw new Error('Invalid manifest: id is missing or invalid');
  }

  if (!isNonEmptyString(data.name)) {
    throw new Error('Invalid manifest: name is missing');
  }

  if (!isNonEmptyString(data.version) || !isVersionString(data.version)) {
    throw new Error('Invalid manifest: version is missing or invalid');
  }

  if (!isNonEmptyString(data.repository)) {
    throw new Error('Invalid manifest: repository is missing');
  }

  if (!isNonEmptyString(data.license)) {
    throw new Error('Invalid manifest: license is missing');
  }

  if (!isValidExtensionType(data.extensionType)) {
    throw new Error('Invalid manifest: extension type is invalid');
  }

  if (data.contributes !== undefined && !isValidManifestContributions(data.contributes)) {
    throw new Error('Invalid manifest: contributes are invalid');
  }

  if (data.main !== undefined && !isNonEmptyString(data.main)) {
    throw new Error('Invalid manifest: main is missing');
  }

  if (data.main === undefined && !canOmitManifestMain(data)) {
    throw new Error('Invalid manifest: main is missing');
  }

  if (!isPermissionsList(data.permissions)) {
    throw new Error('Invalid manifest: permissions are invalid');
  }

  if (data.platforms !== undefined && !isValidPlatformList(data.platforms)) {
    throw new Error('Invalid manifest: platforms are invalid');
  }

  if (data.binaries !== undefined) {
    if (!Array.isArray(data.binaries) || data.binaries.some(binary => !isValidManifestBinaryDefinition(binary))) {
      throw new Error('Invalid manifest: binaries are invalid');
    }
  }

  if (!isObjectRecord(data.engines) || !isNonEmptyString(data.engines.sigmaFileManager)) {
    throw new Error('Invalid manifest: engines.sigmaFileManager is required');
  }
}
