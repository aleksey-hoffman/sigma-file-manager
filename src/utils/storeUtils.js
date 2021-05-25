// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// This modules contains functions moved from utils.js
// to avoid circular dependencies: store.js <-> utils.js
const store = require('../store').default

export default {
  getSafePath (path) {
    if (!path) {
      throw Error('getSafePath(): path is undefined')
    }
    return `${store.state.appPaths.fileProtocol}://${path}`
  }
}
