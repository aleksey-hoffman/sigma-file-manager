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

function parseVersionComparator(value: string): { operator: string;
  version: string; } | null {
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

  if (!isNonEmptyString(entryValue.publisher)) {
    return false;
  }

  if (!isNonEmptyString(entryValue.publisherUrl)) {
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

  if (!isNonEmptyString(data.main)) {
    throw new Error('Invalid manifest: main is missing');
  }

  if (!isPermissionsList(data.permissions)) {
    throw new Error('Invalid manifest: permissions are invalid');
  }

  if (!isObjectRecord(data.engines) || !isNonEmptyString(data.engines.sigmaFileManager)) {
    throw new Error('Invalid manifest: engines.sigmaFileManager is required');
  }
}
