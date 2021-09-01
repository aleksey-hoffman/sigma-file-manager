// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fswin = require('fswin')
const PATH = require('path')
const fs = require('fs')

async function getDirSize (path) {
  const trammelGetSize = require('trammel')

  return await new Promise((resolve, reject) => {
    const options = {type: 'raw', stopOnError: false}
    trammelGetSize(path, options, (error, size) => {
      if (error) {reject(error)}
      resolve(size)
    })
  })
}

async function getDirSizeOnDisk (dir) {
  return new Promise((resolve, reject) => {
    let paths = getFilesRecursively(dir)
    let totalSize = 0
    let promises = []
    paths.forEach(path => {
      promises.push(new Promise((resolve) => {
        fswin.ntfs.getCompressedSize(path, (size) => {
          resolve(size)
        })
      }))
    })
  
    Promise.allSettled(promises)
      .then((data) => {
        data.forEach(promise => {
          totalSize += promise.value
        })
        resolve(totalSize)
      })
  })
}

function getFilesRecursively (dir) {
  let files = []

  const walk = (dir) => {
    const filesInDirectory = fs.readdirSync(dir)
    for (const file of filesInDirectory) {
      const absolute = PATH.join(dir, file)
      try {
        if (fs.statSync(absolute).isDirectory()) {
          walk(absolute)
        } 
        else {
          files.push(absolute)
        }
      }
      catch (error) {}
    }
  }
  walk(dir)

  return files
}

module.exports = {
  getDirSize,
  getDirSizeOnDisk
}