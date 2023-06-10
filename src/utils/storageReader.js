// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fs = require('fs')
const path = require('path')
const appPaths = require('../appPaths')

class StorageReader {
  async initStorageDirectories () {
    const directoriesToInit = appPaths.storageDirectories
    for (const directory of Object.values(directoriesToInit)) {
      try {
        await fs.promises.mkdir(directory, {recursive: true})
      }
      catch (error) {
        if (error.code !== 'EEXIST') { // Ignore the error if the directory already exists
          console.error(`Error creating directory: ${error.message}`)
        }
      }
    }
  }

  async initStorageFiles () {
    const filesToInit = appPaths.storageFiles
    for (const fileData of Object.values(filesToInit)) {
      const filePath = path.join(appPaths.storageDirectories.appStorage, fileData.fileName)
      const formattedData = JSON.stringify(fileData.defaultData, null, 2)
      try {
        await fs.promises.access(filePath, fs.F_OK)
      }
      catch (error) {
        try {
          await fs.promises.writeFile(filePath, formattedData, {encoding: 'utf-8'})
        }
        catch (error) {
          console.error(`Error writing file: ${error.message}`)
        }
      }
    }
  }

  /**
   * Get property value from app storage file
   * @param {string} storageFileName
   * @param {string} key
   */
  async get (storageFileName, key) {
    await this.initStorageDirectories()
    await this.initStorageFiles()
    const filePath = path.join(appPaths.storageDirectories.appStorage, storageFileName)
    try {
      const data = JSON.parse(await fs.promises.readFile(filePath, {encoding: 'utf-8'}))
      return key ? data[key] : data
    }
    catch (error) {
      console.error(`Error reading file: ${error.message}`)
      throw error
    }
  }
}

module.exports = StorageReader
