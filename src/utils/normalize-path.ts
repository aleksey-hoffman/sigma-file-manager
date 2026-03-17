// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export default function normalizePath(path: string): string {
  return path.replace(/\\/g, '/');
}

export function getParentDirectory(filePath: string): string {
  const slashIndex = filePath.lastIndexOf('/');
  if (slashIndex <= 0) return '/';
  const parent = filePath.substring(0, slashIndex);

  return parent.endsWith(':') ? `${parent}/` : parent;
}
