// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type LanShareMode = 'stream' | 'ftp';

export type LanSharePendingReplace = {
  originalPath: string;
  mode: LanShareMode;
  isFile: boolean;
  openPopover: boolean;
  hubPaths?: string[];
};
