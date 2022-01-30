// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fsExtra = require('fs-extra')
const fsWin = require('fswin')
const PATH = require('path')
const electron = require('electron')
const supportedNames = require('./supportedNames.js')
const sharedUtils = require('./sharedUtils.js')

const defaultDirItemFileHeight = 48
const defaultDirItemDirectoryHeight = 48
const preloadCount = 100

/** Gets and returns dirItem object
* @param {string} path
* @param {string} itemHeight
* @returns {object}
*/
async function getDirItemInfo (path, itemHeight) {
  const nameBase = PATH.parse(path).base
  return await fetchDirItemData(path, nameBase, itemHeight)
}

/** Gets and returns dirItem object array
* @param {string} dirPath
* @param {string} itemHeight
* @return {array<object>}
*/
async function getDirItems (params) {
  let {path: dirPath, itemHeight} = params
  try {
    let {nameBases, nameBasesProcessed} = await getNameBases(params)
    const allItemsFetched = params.preload ? preloadCount >= nameBases.length : true

    const statsPromises = nameBasesProcessed.map(nameBase => {
      const path = PATH.join(dirPath, nameBase)
      return fetchDirItemData(path, nameBase, itemHeight)
    })

    let dirItems = await Promise.all(statsPromises)
    dirItems = filterDirItems(dirItems)
    updateIDProperty(dirItems)
    return {dirItems, allItemsFetched}
  }
  catch (error) {
    console.log(error)
    throw Error(error)
  }
}

/** Returns either full or sliced dir path array,
* depending on whether preload was requested or not.
* Preload - small part of the array, that's used for dir item list rendering,
* while the stats for the whole array are being fetched.
* @param {string} path
* @param {string} itemHeight
* @returns {object}
*/
async function getNameBases (params) {
  let nameBases = await fsExtra.readdir(params.path)
  let nameBasesProcessed = params.preload
    ? nameBases.slice(0, preloadCount)
    : nameBases
  return {
    nameBasesProcessed,
    nameBases,
  }
}

/** Checks whether the specified name is allowed
* @param {string} name
* @returns {boolean}
*/
function isDirItemAllowed (name) {
  return !supportedNames.includes({type: 'disallowed', name: name})
}

/** Filters out disallowed and inaccessible paths (undefined|null|false)
* @param {array} list
* @returns {array}
*/
function filterDirItems (list) {
  return list
    .filter(Boolean)
    .filter(item => isDirItemAllowed(item.name))
}

/** updates object property 'id' to each dirItem on the specified list
* @param {array} list
* @returns {void}
*/
function updateIDProperty (list) {
  list.forEach((item, index) => {
    item.id = index
  })
}

/** Gets and returns item type
* @param {array} list
* @returns {string('file'|'directory'|'file-symlink'|'directory-symlink')}
*/
async function getType (dirItem, stat) {
  if (dirItem.isInaccessible) {
    if (dirItem.fsAttributes.isReparsePoint) {
      return `${dirItem.realPathType}-symlink`
    }
    else if (dirItem.fsAttributes.isDirectory) {
      return 'directory'
    }
    else if (!dirItem.fsAttributes.isDirectory) {
      return 'file'
    }
  }
  else {
    const isDirectory = stat.isDirectory()
    const isSymbolicLink = stat.isSymbolicLink()
    if (dirItem.isWin32Shortcut) {
      return `${dirItem.win32ShortcutData.realPathType}-symlink`
    }
    else if (isSymbolicLink) {
      return `${dirItem.realPathType}-symlink`
    }
    else if (isDirectory) {
      return 'directory'
    }
    else if (!isDirectory) {
      return 'file'
    }
  }
}

/** Returns item height depending on item type and selected navigator list layout
* @param {object} dirItem
* @returns {number}
*/
function getHeight (dirItem) {
  if (dirItem.type === 'file' || dirItem.type === 'file-symlink') {
    return dirItem.height.file || defaultDirItemFileHeight
  }
  else if (dirItem.type === 'directory' || dirItem.type === 'directory-symlink') {
    return dirItem.height.directory || defaultDirItemDirectoryHeight
  }
}

/** Returns nested item count if item is a directory
* @param {object} dirItem
* @returns {number|null}
*/
async function getDirItemCount (dirItem) {
  if (dirItem.type === 'file' || dirItem.type === 'file-symlink') {
    return null
  }
  else if (dirItem.type === 'directory' || dirItem.type === 'directory-symlink') {
    // Ignore dirs that couldn't be accessed by readdir
    try {
      const dirItems = await fsExtra.readdir(dirItem.realPath)
      return dirItems.filter(nameBase => isDirItemAllowed(nameBase)).length
    }
    catch (error) {
      return null
    }
  }
}

/** Updates some dirItem properties after the value of some other properties was fetched
* @param {object} dirItem
* @returns {void}
*/
async function updateData (dirItem) {
  if (dirItem.type === 'directory' || dirItem.type === 'directory-symlink') {
    dirItem.stat.size = null
  }
  if (dirItem.isInaccessible) {
    if (process.platform === 'win32') {
      dirItem.stat.size = dirItem.fsAttributes.size
      dirItem.stat.birthtime = dirItem.fsAttributes.creationTime
      dirItem.stat.mtime = dirItem.fsAttributes.lastWriteTime
      dirItem.stat.ctime = dirItem.fsAttributes.lastAccessTime
    }
  }
}

/** Gets and returns item's real path if it's a symlink or Windows shortcut
* @param {object} dirItem
* @returns {string}
*/
async function getRealPath (dirItem) {
  if (dirItem.isWin32Shortcut) {
    return dirItem.win32ShortcutData.resolvedPath.replace(/\\/g, '/')
  }
  else {
    try {
      const realpath = await fsExtra.realpath(dirItem.path)
      return realpath.replace(/\\/g, '/')
    }
    catch (error) {
      return dirItem.path.replace(/\\/g, '/')
    }
  }
}

/** Gets and returns Windows shortcut data
* @param {object} dirItem
* @returns {object|null}
*/
async function getWin32ShortcutData (dirItem) {
  if (dirItem.isWin32Shortcut) {
    const win32ShortcutResolvedPath = electron.shell.readShortcutLink(dirItem.path).target
    const win32ShortcutRealPathStat = await fsExtra.lstat(win32ShortcutResolvedPath)
    const win32ShortcutRealPathType = win32ShortcutRealPathStat.isFile() ? 'file' : 'directory'
    return {
      resolvedPath: win32ShortcutResolvedPath,
      realPathStat: win32ShortcutRealPathStat,
      realPathType: win32ShortcutRealPathType,
    }
  }
  else {
    return null
  }
}

/** Gets and returns item stat
* @param {object} dirItem
* @returns {object|null}
*/
async function getStat (path) {
  try {
    let stat = fsExtra.lstat(path)
    return stat
  }
  catch (error) {
    return {}
  }
}

/** Gets and returns items's realPath stat if it's different from the actual path
* @param {object} dirItem
* @returns {object}
*/
async function getRealPathStat (dirItem) {
  if (dirItem.realPath !== dirItem.path) {
    return await getStat(dirItem.realPath)
  }
  else {
    return dirItem.stat
  }
}

/** Gets and returns isFile property, using different methods,
* depending on whether the item is accessible or not
* @param {object} dirItem
* @returns {boolean}
*/
async function isFile (dirItem, stat) {
  return dirItem.isInaccessible
    ? !dirItem.fsAttributes.isDirectory
    : stat.isFile()
}

/** Gets and returns isHidden property, using different methods,
* depending on platform
* @param {object} dirItem
* @returns {boolean}
*/
function isHidden (dirItem) {
  return process.platform === 'win32'
    ? dirItem.fsAttributes.isHidden
    : sharedUtils.unixHiddenFileRegex.test(dirItem.path)
}

/** Gets and returns the actual file size on disk
* @param {object} dirItem
* @returns {number}
*/
function getSizeOnDisk (dirItem) {
  if (process.platform === 'win32') {
    return fsWin.ntfs.getCompressedSizeSync(dirItem.path)
  }
  // TODO: FINISH
  else if (process.platform === 'linux') {
    return 0
  }
  else if (process.platform === 'darwin') {
    return 0
  }
}

/** Gets and updates fsAttributes into dirItem object
* @param {object} dirItem
* @returns {void}
*/
function updateFSAttributes (dirItem) {
  if (process.platform === 'win32') {
    fsWin.find(dirItem.path, (data) => {
      dirItem.fsAttributes = sharedUtils.toCamelCaseObjectKeys(data[0])
      // Decode RAW attributes and add readable props
      for (const [key, value] of Object.entries(dirItem.fsAttributes)) {
        if (dirItem.fsAttributes.rawAttributes.toString() === value) {
          dirItem.fsAttributes[key] = true
        }
      }
    })
  }
  // TODO: FINISH
  else if (process.platform === 'linux') {
    return {}
  }
  else if (process.platform === 'darwin') {
    return {}
  }
}

/** Gets and returns dirItem data object
* @param {string} path
* @param {string} nameBase
* @param {string} itemHeight
* @returns {object}
*/
async function fetchDirItemData (path, nameBase, itemHeight) {
  const dirItem = {
    stat: {},
    mime: {},
    sizeOnDisk: 0,
    type: '',
    name: '',
    path: path.replace(/\\/g, '/'),
    realPath: '',
    realPathStat: {},
    realPathType: '',
    height: itemHeight.file,
    dirItemCount: null,
    isInaccessible: false,
    isStorageRoot: null,
    isHighlighted: false,
    isDamaged: false,
    isShown: true,
    isIntersected: true,
    isMediaType: false,
    fsAttributes: {},
    status: [],
    isWin32Shortcut: null,
    win32ShortcutData: {},
  }
  try {
    dirItem.stat = await getStat(path)
    dirItem.isInaccessible = sharedUtils.isObjectEmpty(dirItem.stat)
    await updateStatIndependentProps(dirItem, nameBase)
  }
  catch (error) {
    try {
      dirItem.isInaccessible = true
      await updateStatIndependentProps(dirItem, nameBase)
    }
    catch (error) {}
  }
  return dirItem
}

async function updateStatIndependentProps (dirItem, nameBase) {
  dirItem.name = nameBase === '' ? dirItem.path.replace(/\\/g, '/') : nameBase
  dirItem.sizeOnDisk = getSizeOnDisk(dirItem)
  dirItem.isStorageRoot = nameBase === ''
  dirItem.isHidden = isHidden(dirItem)
  dirItem.isWin32Shortcut = await isFile(dirItem, dirItem.stat) && dirItem.name.endsWith('.lnk')
  dirItem.win32ShortcutData = await getWin32ShortcutData(dirItem)
  dirItem.type = await getType(dirItem, dirItem.stat)
  dirItem.realPath = await getRealPath(dirItem)
  dirItem.realPathStat = await getRealPathStat(dirItem)
  dirItem.realPathType = await getType(dirItem, dirItem.realPathStat)
  dirItem.dirItemCount = await getDirItemCount(dirItem)
  dirItem.mime = sharedUtils.getFileType(dirItem.realPath, dirItem.type)
  dirItem.isMediaType = ['image', 'audio', 'video'].includes(dirItem.mime.mimeDescription)
  dirItem.height = getHeight(dirItem)
  updateFSAttributes(dirItem)
  updateData(dirItem)
}

module.exports = {
  getDirItemInfo,
  getDirItems,
}
