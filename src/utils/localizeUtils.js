// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// This modules contains functions moved from utils.js
// to avoid circular dependencies: utils.js <-> localize.js <-> store.js

import * as localize from './localize.js'

export default {
  pluralize (value, word) {
    const singular = localize.get(`text_${word}`, { capitalize: false })
    const plural = localize.get(`text_${word}_plural`, { capitalize: false })
    return parseInt(value) === 1 ? singular : plural
  }
}
