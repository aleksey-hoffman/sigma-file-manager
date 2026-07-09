// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export type PathAPI = {
  dirname(filePath: string): string;
  basename(filePath: string, suffix?: string): string;
  extname(filePath: string): string;
};

export function createPathAPI(): PathAPI;
