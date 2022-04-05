// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

let names = {
  disallowed: [
    'bootmgr',
    'System Volume Information',
    '$Recycle.Bin',
    '$RECYCLE.BIN',
    '$SysReset',
    '$Windows.~WS',
    'msdownld.tmp',
    'Thumbs.db',
    'desktop.ini',
    '.DS_Store',
  ],
}

function includes (params) {
  if (params.type === 'disallowed') {
    return names.disallowed.some(listName => listName === params.name)
  }
}

module.exports = {
  names,
  includes,
}