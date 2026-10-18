// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

/**
 * The app's own folders, resolved by the backend (src-tauri/src/app_dirs.rs).
 * Use these instead of the app*Dir functions from '@tauri-apps/api/path' so
 * that isolated e2e runs (SFM_E2E_DATA_DIR, debug builds only) never touch
 * the user's real app data.
 */
export interface AppDirs {
  appDataDir: string;
  appConfigDir: string;
  appLocalDataDir: string;
  appCacheDir: string;
  appLogDir: string;
  isolatedRoot: string | null;
}

let appDirsPromise: Promise<AppDirs> | null = null;

export function getAppDirs(): Promise<AppDirs> {
  if (!appDirsPromise) {
    appDirsPromise = invoke<AppDirs>('get_app_dirs').catch((error: unknown) => {
      appDirsPromise = null;
      throw error;
    });
  }

  return appDirsPromise;
}

export async function appDataDir(): Promise<string> {
  return (await getAppDirs()).appDataDir;
}

export async function appConfigDir(): Promise<string> {
  return (await getAppDirs()).appConfigDir;
}

export async function appLocalDataDir(): Promise<string> {
  return (await getAppDirs()).appLocalDataDir;
}

export async function appCacheDir(): Promise<string> {
  return (await getAppDirs()).appCacheDir;
}

export async function appLogDir(): Promise<string> {
  return (await getAppDirs()).appLogDir;
}

export async function isIsolatedDataDir(): Promise<boolean> {
  return Boolean((await getAppDirs()).isolatedRoot);
}
