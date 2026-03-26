// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { PlatformOS, PlatformArch, PlatformInfo } from '@/types/extension';

let platformInfo: PlatformInfo | null = null;
let platformInfoPromise: Promise<void> | null = null;

export async function initPlatformInfo(): Promise<void> {
  if (platformInfo) return;
  if (platformInfoPromise) return platformInfoPromise;

  platformInfoPromise = (async () => {
    const info = await invoke<{
      os: string;
      arch: string;
    }>('get_platform_info');
    const os = info.os as PlatformOS;

    platformInfo = {
      os,
      arch: info.arch as PlatformArch,
      pathSeparator: os === 'windows' ? '\\' : '/',
      isWindows: os === 'windows',
      isMacos: os === 'macos',
      isLinux: os === 'linux',
    };
  })();

  return platformInfoPromise;
}

export function getPlatformInfo(): PlatformInfo {
  if (!platformInfo) {
    console.warn('[Extensions API] Platform info accessed before initialization, using defaults');
    return {
      os: 'linux',
      arch: 'x64',
      pathSeparator: '/',
      isWindows: false,
      isMacos: false,
      isLinux: true,
    };
  }

  return platformInfo;
}

export async function ensurePlatformInfo(): Promise<PlatformInfo> {
  if (!platformInfo) {
    await initPlatformInfo();
  }

  return platformInfo!;
}
