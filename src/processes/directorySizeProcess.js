// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const trammelGetSize = require('trammel')

process.on('message', (event) => {
  initWorker(event)
})

async function initWorker (event) {
  if (event.items) {
    let promises = []
    event.items.forEach(item => {
      promises.push(getDirectorySizePromise(item))
    })
    await Promise.allSettled(promises)
      .then((results) => {
        process.send(results)
      })
  }
  else if (event.item) {
    const size = await getDirectorySize(event.item.path)
    process.send({item: event.item, size})
  }
}

async function getDirectorySizePromise (item) {
  return await new Promise((resolve, reject) => {
    getDirectorySize(item.path)
      .then((result) => {
        resolve({
          item,
          size: result,
        })
      })
  })
}

async function getDirectorySize (path) {
  return await new Promise((resolve, reject) => {
    const options = {type: 'raw', stopOnError: false}
    trammelGetSize(path, options, (error, size) => {
      if (error) {reject(error)}
      resolve(size)
    })
  })
}
