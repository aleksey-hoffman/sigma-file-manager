// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  isUnixSystemMountRoot,
  isWindowsLocationsMountRoot,
} from '@/utils/system-mount-roots';
import { isVirtualLocationPath } from '@/utils/virtual-path-constants';

export function isProtectedSystemPath(path: string, platform: string | null): boolean {
  if (!path) {
    return false;
  }

  if (isVirtualLocationPath(path)) {
    return true;
  }

  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');

  if (platform === 'windows') {
    return isWindowsLocationsMountRoot(normalized);
  }

  return isUnixSystemMountRoot(normalized);
}
