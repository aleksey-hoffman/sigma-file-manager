// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

export default function getVar(varName: string) {
  const processedVarName = varName.startsWith('--') ? varName : `--${varName}`;
  const rootNode = document.querySelector(':root');

  if (rootNode) {
    const value = getComputedStyle(rootNode).getPropertyValue(processedVarName);
    return value.trim();
  }
  return '';
}