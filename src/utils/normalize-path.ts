// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { isVirtualLocationPath } from '@/utils/virtual-path-constants';

export default function normalizePath(path: string): string {
  if (!path.includes('\\')) {
    return path;
  }

  return path.replace(/\\/g, '/');
}

export function canonicalizePath(path: string): string {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath.endsWith('/')) {
    return normalizedPath;
  }

  let end = normalizedPath.length;

  while (end > 0 && normalizedPath.charCodeAt(end - 1) === 47) {
    end--;
  }

  if (end === 0) {
    return '/';
  }

  return normalizedPath.slice(0, end);
}

export function stripTrailingSlashesPreservingRoot(path: string): string {
  return canonicalizePath(path);
}

export function isUnixFilesystemRoot(path: string): boolean {
  return canonicalizePath(path) === '/';
}

export function isUncPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath.startsWith('//') && !normalizedPath.startsWith('///');
}

export function isWslPath(path: string): boolean {
  const normalizedPath = normalizePath(path).toLowerCase();

  if (!isUncPath(normalizedPath)) {
    return false;
  }

  const firstSegment = normalizedPath.slice(2).split('/').filter(Boolean)[0] ?? '';
  return firstSegment === 'wsl.localhost' || firstSegment === 'wsl$';
}

export function isWslHostRootUncPath(path: string): boolean {
  const normalizedPath = canonicalizePath(path).toLowerCase();

  if (!isUncPath(normalizedPath)) {
    return false;
  }

  const segments = normalizedPath.slice(2).split('/').filter(Boolean);

  if (segments.length !== 1) {
    return false;
  }

  return segments[0] === 'wsl.localhost' || segments[0] === 'wsl$';
}

export function isWindowsDriveRootPath(path: string): boolean {
  const normalizedPath = canonicalizePath(path);

  if (normalizedPath.length !== 2 || normalizedPath.charCodeAt(1) !== 58) {
    return false;
  }

  const code = normalizedPath.charCodeAt(0);
  return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

export function isUncShareRootPath(path: string): boolean {
  const normalizedPath = canonicalizePath(path);

  if (!isUncPath(normalizedPath)) {
    return false;
  }

  return normalizedPath.slice(2).split('/').filter(Boolean).length === 2;
}

export function getPathSegments(path: string): string[] {
  return canonicalizePath(path).split('/').filter(Boolean);
}

export function getAddressBarSegments(path: string): string[] {
  const canonicalPath = canonicalizePath(path);

  if (isUnixFilesystemRoot(canonicalPath)) {
    return ['/'];
  }

  return getPathSegments(canonicalPath);
}

export function getPathLeafName(path: string): string {
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath) {
    return '';
  }

  const pathSegments = getPathSegments(canonicalPath);
  return pathSegments[pathSegments.length - 1] || canonicalPath;
}

export function getParentPath(path: string): string | null {
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath || isUnixFilesystemRoot(canonicalPath)) {
    return null;
  }

  if (isUncPath(canonicalPath)) {
    const pathSegments = canonicalPath.slice(2).split('/').filter(Boolean);

    if (pathSegments.length <= 1) {
      return null;
    }

    return `//${pathSegments.slice(0, -1).join('/')}`;
  }

  const slashIndex = canonicalPath.lastIndexOf('/');

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex === 0) {
    return '/';
  }

  const parentPath = canonicalPath.substring(0, slashIndex);
  return parentPath.endsWith(':') ? `${parentPath}/` : parentPath;
}

export function getParentDirectory(filePath: string): string {
  return getParentPath(filePath) ?? canonicalizePath(filePath);
}

export function joinPath(parentPath: string, childName: string): string {
  const canonicalParentPath = canonicalizePath(parentPath);
  const trimmedChildName = childName.replace(/^\/+|\/+$/g, '');

  if (!trimmedChildName) {
    return canonicalParentPath;
  }

  if (!canonicalParentPath) {
    return trimmedChildName;
  }

  if (isUnixFilesystemRoot(canonicalParentPath)) {
    return `/${trimmedChildName}`;
  }

  return `${canonicalParentPath}/${trimmedChildName}`;
}

export function isSameOrDescendantPath(childPath: string, parentPath: string): boolean {
  const canonicalChildPath = canonicalizePath(childPath);
  const canonicalParentPath = canonicalizePath(parentPath);

  if (!canonicalChildPath || !canonicalParentPath) {
    return false;
  }

  if (canonicalChildPath === canonicalParentPath) {
    return true;
  }

  if (isUnixFilesystemRoot(canonicalParentPath)) {
    return canonicalChildPath.startsWith('/');
  }

  return canonicalChildPath.startsWith(`${canonicalParentPath}/`);
}

export function getPathDisplayName(path: string, translate?: (key: string) => string): string {
  if (isVirtualLocationPath(path)) {
    if (translate) {
      return translate('locations');
    }

    return 'Locations';
  }

  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return '';
  }

  if (isUnixFilesystemRoot(normalizedPath)) {
    return '/';
  }

  const leafName = getPathLeafName(normalizedPath);
  return leafName || normalizedPath;
}

export function getPathDisplayValue(path: string): string {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return '';
  }

  if (isUnixFilesystemRoot(normalizedPath)) {
    return '/';
  }

  if (isWindowsDriveRootPath(normalizedPath) || isUncShareRootPath(normalizedPath)) {
    return canonicalizePath(normalizedPath);
  }

  return normalizedPath;
}
