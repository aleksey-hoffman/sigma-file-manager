// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export default function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function isUncPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath.startsWith('//') && !normalizedPath.startsWith('///');
}

export function getPathSegments(path: string): string[] {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');
  return normalizedPath.split('/').filter(Boolean);
}

export function getPathLeafName(path: string): string {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');

  if (!normalizedPath) {
    return '';
  }

  const pathSegments = getPathSegments(normalizedPath);
  return pathSegments[pathSegments.length - 1] || normalizedPath;
}

export function getParentPath(path: string): string | null {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');

  if (!normalizedPath) {
    return null;
  }

  if (isUncPath(normalizedPath)) {
    const pathSegments = normalizedPath.slice(2).split('/').filter(Boolean);

    if (pathSegments.length <= 1) {
      return null;
    }

    return `//${pathSegments.slice(0, -1).join('/')}`;
  }

  const slashIndex = normalizedPath.lastIndexOf('/');

  if (slashIndex < 0) {
    return null;
  }

  if (slashIndex === 0) {
    return '/';
  }

  const parentPath = normalizedPath.substring(0, slashIndex);
  return parentPath.endsWith(':') ? `${parentPath}/` : parentPath;
}

export function getParentDirectory(filePath: string): string {
  return getParentPath(filePath) ?? filePath;
}
