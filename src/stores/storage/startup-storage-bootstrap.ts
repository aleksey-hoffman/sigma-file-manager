// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { invoke } from '@tauri-apps/api/core';

export type StartupStorageFileStatus = 'ready' | 'missing' | 'invalid' | 'error';

export interface StartupStorageFileBootstrap {
  path: string;
  status: StartupStorageFileStatus;
  data: Record<string, unknown> | null;
  schemaVersion: number | null;
  error: string | null;
}

export interface StartupStorageBootstrap {
  userSettings: StartupStorageFileBootstrap;
  workspaces: StartupStorageFileBootstrap;
  userStats: StartupStorageFileBootstrap;
  extensions: StartupStorageFileBootstrap;
}

export type StartupStorageFileName = keyof StartupStorageBootstrap;

let startupStorageBootstrapPromise: Promise<StartupStorageBootstrap> | null = null;

function getStartupStorageBootstrap(): Promise<StartupStorageBootstrap> {
  if (!startupStorageBootstrapPromise) {
    startupStorageBootstrapPromise = invoke<StartupStorageBootstrap>('get_startup_storage_bootstrap')
      .catch((error) => {
        startupStorageBootstrapPromise = null;
        throw error;
      });
  }

  return startupStorageBootstrapPromise;
}

export async function getStartupStorageFile(
  fileName: StartupStorageFileName,
): Promise<StartupStorageFileBootstrap | undefined> {
  const startupStorageBootstrap = await getStartupStorageBootstrap();
  return startupStorageBootstrap[fileName];
}

export function getStartupStorageRecord(
  bootstrapFile: StartupStorageFileBootstrap | null | undefined,
): Record<string, unknown> | null {
  if (!bootstrapFile || bootstrapFile.status !== 'ready') {
    return null;
  }

  return bootstrapFile.data ?? null;
}

export function canUseStartupStorageFastPath(
  bootstrapFile: StartupStorageFileBootstrap | null | undefined,
  requiredSchemaVersion?: number,
): boolean {
  if (!bootstrapFile) {
    return false;
  }

  if (bootstrapFile.status === 'missing') {
    return true;
  }

  if (bootstrapFile.status !== 'ready' || !bootstrapFile.data) {
    return false;
  }

  if (requiredSchemaVersion === undefined) {
    return true;
  }

  return bootstrapFile.schemaVersion === requiredSchemaVersion;
}
