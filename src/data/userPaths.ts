// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  appCacheDir,
  appConfigDir,
  appDataDir,
  appLocalDataDir,
  appLogDir,
  audioDir,
  cacheDir,
  configDir,
  dataDir,
  desktopDir,
  documentDir,
  downloadDir,
  executableDir,
  fontDir,
  homeDir,
  localDataDir,
  pictureDir,
  publicDir,
  resourceDir,
  runtimeDir,
  templateDir,
  videoDir
} from '@tauri-apps/api/path';

export interface UserPaths {
  appCacheDir: string;
  appConfigDir: string;
  appDataDir: string;
  appLocalDataDir: string;
  appLogDir: string;
  audioDir: string;
  cacheDir: string;
  configDir: string;
  dataDir: string;
  desktopDir: string;
  documentDir: string;
  downloadDir: string;
  executableDir: string;
  fontDir: string;
  homeDir: string;
  localDataDir: string;
  pictureDir: string;
  publicDir: string;
  resourceDir: string;
  runtimeDir: string;
  templateDir: string;
  videoDir: string;
}

export interface UserPathsFunctions {
  appCacheDir: () => Promise<string>;
  appConfigDir: () => Promise<string>;
  appDataDir: () => Promise<string>;
  appLocalDataDir: () => Promise<string>;
  appLogDir: () => Promise<string>;
  audioDir: () => Promise<string>;
  cacheDir: () => Promise<string>;
  configDir: () => Promise<string>;
  dataDir: () => Promise<string>;
  desktopDir: () => Promise<string>;
  documentDir: () => Promise<string>;
  downloadDir: () => Promise<string>;
  executableDir: () => Promise<string>;
  fontDir: () => Promise<string>;
  homeDir: () => Promise<string>;
  localDataDir: () => Promise<string>;
  pictureDir: () => Promise<string>;
  publicDir: () => Promise<string>;
  resourceDir: () => Promise<string>;
  runtimeDir: () => Promise<string>;
  templateDir: () => Promise<string>;
  videoDir: () => Promise<string>;
}

export const userPathsFunctions: UserPathsFunctions = {
  appCacheDir,
  appConfigDir,
  appDataDir,
  appLocalDataDir,
  appLogDir,
  audioDir,
  cacheDir,
  configDir,
  dataDir,
  desktopDir,
  documentDir,
  downloadDir,
  executableDir,
  fontDir,
  homeDir,
  localDataDir,
  pictureDir,
  publicDir,
  resourceDir,
  runtimeDir,
  templateDir,
  videoDir
};
