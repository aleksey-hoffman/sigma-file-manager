// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fs = require('fs')
const PATH = require('path')
const electron = require('electron')
const appPaths = require('../appPaths')

class StorageReader {
  async initStorageDirectories () {
    return new Promise((resolve, reject) => {
      const directoriesToInit = appPaths.storageDirectories
      const promises = []
      for (const [key, path] of Object.entries(directoriesToInit)) {
        // Attempt to create directory.
        // Don't do anything if it's already created
        promises.push(fs.promises.mkdir(path, { recursive: true }))
      }
      Promise.allSettled(promises)
        .then(() => resolve())
    })
  }

  async initStorageFiles () {
    const filesToInit = appPaths.storageFiles
    for (const [key, fileData] of Object.entries(filesToInit)) {
      const filePath = `${appPaths.storageDirectories.appStorage}/${fileData.fileName}`
      const formattedData = JSON.stringify(fileData.defaultData, null, 2)
      try {
        await fs.promises.access(filePath, fs.F_OK)
      }
      catch (error) {
        await fs.promises.writeFile(filePath, formattedData, { encoding: 'utf-8' })
      }
    }
  }

  /** Get property value from app storage file
  * @param {string} storageFileName
  * @param {string} key
  */
  async get (storageFileName, key) {
    await this.initStorageDirectories()
    await this.initStorageFiles()
    try {
      const userDataDirPath = electron.app.getPath('userData')
      const appStorageDirName = 'app storage'
      const filePath = PATH.join(userDataDirPath, appStorageDirName, storageFileName)
      let data = await fs.promises.readFile(filePath, { encoding: 'utf-8' })
      data = JSON.parse(data)
      if (key) {
        return data[key]
      }
      else {
        return data
      }
    }
    catch (error) {
      throw new Error(error)
    }
  }
}

module.exports = StorageReader
