// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

function canonicalizePath(path) {
  const normalizedPath = String(path).replace(/\\/g, '/');
  return normalizedPath.replace(/\/+$/, '') || (normalizedPath.startsWith('/') ? '/' : '');
}

function isUnixFilesystemRoot(path) {
  return canonicalizePath(path) === '/';
}

function isWindowsDriveRootPath(path) {
  return /^[A-Za-z]:$/.test(canonicalizePath(path));
}

function isUncPath(path) {
  const normalizedPath = String(path).replace(/\\/g, '/');
  return normalizedPath.startsWith('//') && !normalizedPath.startsWith('///');
}

function getParentPath(path) {
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

function getPathLeafName(path) {
  const canonicalPath = canonicalizePath(path);

  if (!canonicalPath || isUnixFilesystemRoot(canonicalPath) || isWindowsDriveRootPath(canonicalPath)) {
    return '';
  }

  const pathSegments = canonicalPath.split('/').filter(Boolean);
  return pathSegments[pathSegments.length - 1] || '';
}

export function createPathAPI() {
  function dirname(filePath) {
    const canonicalPath = canonicalizePath(filePath);

    if (!canonicalPath) {
      return '.';
    }

    if (isUnixFilesystemRoot(canonicalPath)) {
      return '/';
    }

    return getParentPath(canonicalPath) ?? '.';
  }

  function basename(filePath, suffix) {
    const base = getPathLeafName(filePath);

    if (suffix && base.endsWith(suffix)) {
      return base.slice(0, base.length - suffix.length);
    }

    return base;
  }

  function extname(filePath) {
    const base = basename(filePath);
    const dotIndex = base.lastIndexOf('.');
    if (dotIndex <= 0) return '';
    return base.slice(dotIndex);
  }

  return {
    dirname,
    basename,
    extname,
  };
}
