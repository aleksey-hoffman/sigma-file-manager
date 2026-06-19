// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const LOCATIONS_VIRTUAL_PATH = 'sfm://locations';

export function isVirtualLocationPath(path: string): boolean {
  return path.replace(/\\/g, '/') === LOCATIONS_VIRTUAL_PATH;
}
