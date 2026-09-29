// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { isVirtualLocationPath } from '@/utils/virtual-locations';

export function guessPathIsFile(path: string): boolean {
  if (isVirtualLocationPath(path)) {
    return false;
  }

  return !path.endsWith('/') && path.includes('.');
}
