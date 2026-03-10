// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { getPlatformInfo } from '@/modules/extensions/api/platform';

export function createPlatformAPI() {
  return {
    get os() {
      return getPlatformInfo().os;
    },
    get arch() {
      return getPlatformInfo().arch;
    },
    get pathSeparator() {
      return getPlatformInfo().pathSeparator;
    },
    get isWindows() {
      return getPlatformInfo().isWindows;
    },
    get isMacos() {
      return getPlatformInfo().isMacos;
    },
    get isLinux() {
      return getPlatformInfo().isLinux;
    },
    joinPath: (...segments: string[]): string => {
      return segments.join(getPlatformInfo().pathSeparator);
    },
  };
}
