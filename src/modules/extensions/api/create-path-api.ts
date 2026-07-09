// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  canonicalizePath,
  getParentPath,
  getPathLeafName,
  isUnixFilesystemRoot,
} from '@/utils/normalize-path';

export function createPathAPI() {
  function dirname(filePath: string): string {
    const canonicalPath = canonicalizePath(filePath);

    if (!canonicalPath) {
      return '.';
    }

    if (isUnixFilesystemRoot(canonicalPath)) {
      return '/';
    }

    return getParentPath(canonicalPath) ?? '.';
  }

  function basename(filePath: string, suffix?: string): string {
    const base = getPathLeafName(filePath);

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
