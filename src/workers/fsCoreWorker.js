// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const {parentPort, workerData} = require('worker_threads')
const fsCore = require('../utils/fsCore.js')

let data = workerData

fsCore.getDirItems(data)
  .then((dirItems) => {
    parentPort.postMessage(dirItems)
  })