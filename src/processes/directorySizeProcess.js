// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const trammelGetSize = require('trammel')

process.on('message', (event) => {
  initWorker(event)
})

async function initWorker (event) {
  const size = await getDirectorySize(event.item.path)
  process.send({ item: event.item, size })
}

async function getDirectorySize (path) {
  return await new Promise((resolve, reject) => {
    const options = { type: 'raw', stopOnError: false }
    trammelGetSize(path, options, (error, size) => {
      if (error) { reject(error) }
      resolve(size)
    })
  })
}
