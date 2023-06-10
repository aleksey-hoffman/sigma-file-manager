// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fsExtra = require('fs-extra')

export default function copyOldUserData (oldUserData, newUserData) {
  fsExtra.copySync(oldUserData, newUserData, {overwrite: true})
}
