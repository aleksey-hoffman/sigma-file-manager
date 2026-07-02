// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export const FILE_BROWSER_LIST_SIDE_GUTTER_DEFAULT = 0;
export const FILE_BROWSER_LIST_SIDE_GUTTER_INCREASED = 20;
export const FILE_BROWSER_GRID_GAP_DEFAULT = 12;
export const FILE_BROWSER_GRID_GAP_INCREASED = 20;

export function getFileBrowserListSideGutter(increasedGapsEnabled: boolean): number {
  return increasedGapsEnabled
    ? FILE_BROWSER_LIST_SIDE_GUTTER_INCREASED
    : FILE_BROWSER_LIST_SIDE_GUTTER_DEFAULT;
}

export function getFileBrowserGridGap(increasedGapsEnabled: boolean): number {
  return increasedGapsEnabled
    ? FILE_BROWSER_GRID_GAP_INCREASED
    : FILE_BROWSER_GRID_GAP_DEFAULT;
}
