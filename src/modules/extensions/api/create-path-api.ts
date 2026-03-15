// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function createPathAPI() {
  function dirname(filePath: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex === -1) return '.';
    if (lastSlashIndex === 0) return '/';
    return filePath.slice(0, lastSlashIndex);
  }

  function basename(filePath: string, suffix?: string): string {
    const normalizedPath = filePath.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    const base = lastSlashIndex === -1 ? normalizedPath : normalizedPath.slice(lastSlashIndex + 1);

    if (suffix && base.endsWith(suffix)) {
      return base.slice(0, base.length - suffix.length);
    }

    return base;
  }

  function extname(filePath: string): string {
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
