// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export function isProtectedSystemPath(path: string, platform: string | null): boolean {
  if (!path) return false;

  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');

  if (platform === 'windows') {
    return /^[a-z]:$/i.test(normalized);
  }

  return normalized === '' || normalized === '/';
}
