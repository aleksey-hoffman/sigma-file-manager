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

export function isWslPath(path: string): boolean {
  const normalizedPath = normalizePath(path).toLowerCase();

  if (!isUncPath(normalizedPath)) {
    return false;
  }

  const firstSegment = normalizedPath.slice(2).split('/').filter(Boolean)[0] ?? '';
  return firstSegment === 'wsl.localhost' || firstSegment === 'wsl$';
}

export function isWslHostRootUncPath(path: string): boolean {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '').toLowerCase();

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
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');
  return /^[A-Za-z]:$/.test(normalizedPath);
}

export function isUncShareRootPath(path: string): boolean {
  const normalizedPath = normalizePath(path).replace(/\/+$/, '');

  if (!isUncPath(normalizedPath)) {
    return false;
  }

  return normalizedPath.slice(2).split('/').filter(Boolean).length === 2;
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

export function getPathDisplayName(path: string): string {
  const normalizedPath = normalizePath(path);

  if (!normalizedPath) {
    return '';
  }

  if (normalizedPath === '/') {
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

  if (normalizedPath === '/') {
    return '/';
  }

  if (isWindowsDriveRootPath(normalizedPath)) {
    return normalizedPath.replace(/\/+$/, '');
  }

  if (isUncShareRootPath(normalizedPath)) {
    return normalizedPath.replace(/\/+$/, '');
  }

  return normalizedPath;
}
