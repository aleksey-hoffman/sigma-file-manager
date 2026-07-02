// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type {
  ExtensionHttpHostPermission,
  ExtensionManifestPermissionEntry,
  ExtensionPermission,
} from '@/types/extension';

export type ParsedExtensionPermissions = {
  permissions: ExtensionPermission[];
  httpAllowedHosts?: string[];
};

const BASE_EXTENSION_PERMISSIONS: ExtensionPermission[] = [
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
  'view',
];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isValidHttpHostPattern(pattern: string): boolean {
  const trimmedPattern = pattern.trim();

  if (trimmedPattern.length === 0) {
    return false;
  }

  const normalizedPattern = trimmedPattern.endsWith(':*')
    ? `${trimmedPattern.slice(0, -2)}:0`
    : trimmedPattern;

  try {
    const parsedUrl = new URL(normalizedPattern);
    return (parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:')
      && parsedUrl.hostname.length > 0;
  }
  catch {
    return false;
  }
}

function parseHttpHostPermission(value: Record<string, unknown>): ExtensionHttpHostPermission {
  if (value.name !== 'http') {
    throw new Error('Invalid manifest: unsupported permission object');
  }

  if (!Array.isArray(value.hosts) || value.hosts.length === 0) {
    throw new Error('Invalid manifest: http permission requires a non-empty hosts list');
  }

  const hosts = value.hosts.map((hostEntry) => {
    if (typeof hostEntry !== 'string' || hostEntry.trim().length === 0) {
      throw new Error('Invalid manifest: http permission hosts must be non-empty strings');
    }

    const hostPattern = hostEntry.trim();

    if (!isValidHttpHostPattern(hostPattern)) {
      throw new Error(`Invalid manifest: invalid http host pattern "${hostPattern}"`);
    }

    return hostPattern;
  });

  return {
    name: 'http',
    hosts,
  };
}

export function parseExtensionPermissions(
  rawPermissions: ExtensionManifestPermissionEntry[],
): ParsedExtensionPermissions {
  const permissions: ExtensionPermission[] = [];
  let httpAllowedHosts: string[] | undefined;
  let hasHttpPermission = false;

  for (const permissionEntry of rawPermissions) {
    if (typeof permissionEntry === 'string') {
      if (permissionEntry === 'http') {
        throw new Error('Invalid manifest: http permission requires a host allowlist object');
      }

      if (!BASE_EXTENSION_PERMISSIONS.includes(permissionEntry)) {
        throw new Error(`Invalid manifest: unknown permission "${permissionEntry}"`);
      }

      permissions.push(permissionEntry);
      continue;
    }

    if (isObjectRecord(permissionEntry)) {
      const httpPermission = parseHttpHostPermission(permissionEntry);

      if (hasHttpPermission) {
        throw new Error('Invalid manifest: duplicate http permission');
      }

      hasHttpPermission = true;
      permissions.push('http');
      httpAllowedHosts = httpPermission.hosts;
      continue;
    }

    throw new Error('Invalid manifest: permissions must be strings or http host objects');
  }

  return {
    permissions,
    httpAllowedHosts,
  };
}

export function getManifestPermissionKey(permissionEntry: ExtensionManifestPermissionEntry): ExtensionPermission {
  if (typeof permissionEntry === 'string') {
    return permissionEntry;
  }

  return permissionEntry.name;
}

export function getManifestPermissionHosts(permissionEntry: ExtensionManifestPermissionEntry): string[] | undefined {
  if (typeof permissionEntry === 'string' || permissionEntry.name !== 'http') {
    return undefined;
  }

  return permissionEntry.hosts;
}
