// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';
import type { PlatformInfo, PlatformOS } from '@/types/extension';

let platformInfo: PlatformInfo | null = null;
let platformInfoPromise: Promise<PlatformInfo> | null = null;

function toPlatformInfo(os: PlatformOS, arch: string): PlatformInfo {
  return {
    os,
    arch,
    pathSeparator: os === 'windows' ? '\\' : '/',
    isWindows: os === 'windows',
    isMacos: os === 'macos',
    isLinux: os === 'linux',
  };
}

function defaultPlatformInfo(): PlatformInfo {
  return toPlatformInfo('windows', 'x64');
}

export async function initPlatformInfo(): Promise<PlatformInfo> {
  if (platformInfo) {
    return platformInfo;
  }

  if (!platformInfoPromise) {
    platformInfoPromise = (async () => {
      try {
        const info = await invoke<{
          os: PlatformOS;
          arch: string;
        }>('get_platform_info');
        const resolvedPlatformInfo = toPlatformInfo(info.os, info.arch);
        platformInfo = resolvedPlatformInfo;
        return resolvedPlatformInfo;
      }
      catch (error) {
        console.error('Failed to detect platform info:', error);
        const fallbackPlatformInfo = defaultPlatformInfo();
        platformInfo = fallbackPlatformInfo;
        return fallbackPlatformInfo;
      }
      finally {
        platformInfoPromise = null;
      }
    })();
  }

  return platformInfoPromise;
}

export function getPlatformInfo(): PlatformInfo {
  if (!platformInfo) {
    console.warn('[Platform] Platform info accessed before initialization, using defaults');
    return defaultPlatformInfo();
  }

  return platformInfo;
}

export async function ensurePlatformInfo(): Promise<PlatformInfo> {
  return platformInfo ?? initPlatformInfo();
}
