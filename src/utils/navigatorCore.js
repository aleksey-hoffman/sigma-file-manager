// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import fsExtra from 'fs-extra'
import fsWin from 'fswin'
import utils from './utils'
import * as fsManager from '../utils/fsManager'
const PATH = require('path')
const electron = require('electron')

const DISALLOWED_DIR_ITEM_NAMES = [
  'bootmgr',
  'System Volume Information',
  '$Recycle.Bin',
  '$RECYCLE.BIN',
  '$SysReset',
  '$Windows.~WS',
  'msdownld.tmp',
  'Thumbs.db',
  'desktop.ini',
  '.DS_Store'
]

const state = {
  extraStats: {},
  isGettingStats: false
}

/**
* @param {string} path
* @param {string} itemHeight
* @returns {object}
*/
async function getDirItemInfo (path, itemHeight) {
  const nameBase = PATH.parse(path).base
  return await fetchDirItemData(path, nameBase, itemHeight)
}

/** Take in dir path and return item object with stat
* @param {string} dirPath
* @param {string} itemHeight
* @return {array<object>}
*/
async function getDirItems (dirPath, itemHeight) {
  try {
    const dir = PATH.parse(dirPath).dir.replace(/\\/g, '/')
    // state.extraStats = await fsManager.getItemChildrenStats({ path: dirPath })
    state.extraStatsDir = dir
    const nameBases = await fsExtra.readdir(dirPath)
    const statsPromises = nameBases.map(nameBase => {
      const path = PATH.join(dirPath, nameBase)
      return fetchDirItemData(path, nameBase, itemHeight)
    })
    let contents = await Promise.all(statsPromises)
    // addExtraStatsPropertyToAll({ contents, dirPath })
    contents = filterDirItems(contents)
    addIDProperty(contents)
    return contents
  }
  catch (error) {
    console.log(error)
  }
}

/**
* @param {string} dirItemName
* @returns {boolean}
*/
function isDirItemAllowed (dirItemName) {
  return !DISALLOWED_DIR_ITEM_NAMES.some(listName => listName === dirItemName)
}

function filterDirItems (list) {
  // Filter out disallowed and inaccessible items:
  // (undefined|null|false)
  return list
    .filter(Boolean)
    .filter(item => isDirItemAllowed(item.name))
}

function addExtraStatsPropertyToAll (params) {
  params.contents.forEach((item, index) => {
    addExtraStatsProperty(item)
  })
  return params.contents
}

function addExtraStatsProperty (item) {
  const systemCallItem = state.extraStats.find(listItem => {
    return listItem.FullName.replace(/\\/g, '/') === item.path
  })
  if (systemCallItem) {
    item.extraStats = {
      linkType: systemCallItem.LinkType,
      mode: systemCallItem.Mode,
      creationTime: systemCallItem.CreationTime,
      type: getTypeFromProperties(systemCallItem)
    }
    // item.type = getTypeFromProperties(systemCallItem)
  }
}

function getTypeFromProperties (params) {
  const typeIsDirectory = params.Mode[0] === 'd'
  const typeIsHardlink = params.LinkType === 'HardLink'
  const typeIsSymlink = params.LinkType === 'SymbolicLink'
  if (typeIsDirectory) {
    if (typeIsSymlink) {
      return 'directory-symlink'
    }
    else if (typeIsHardlink) {
      return 'directory-hardlink'
    }
    else {
      return 'directory'
    }
  }
  else {
    if (typeIsSymlink) {
      return 'file-symlink'
    }
    else if (typeIsHardlink) {
      return 'file-hardlink'
    }
    else {
      return 'file'
    }
  }
}

function addIDProperty (list) {
  list.forEach((item, index) => {
    item.id = index
  })
  return list
}

async function getType (dirItemData, stat) {
  // TODO: refactor to make more logical
  // (return dirItemData.extraStats.type instead of 'file' placeholder)
  if (dirItemData.isInaccessible) {
    return dirItemData?.extraStats?.type || 'file'
  }
  else if (stat.isDirectory()) {
    return 'directory'
  }
  else if (stat.isFile() && !dirItemData.isWin32Shortcut) {
    return 'file'
  }
  else if (dirItemData.isWin32Shortcut) {
    return `${dirItemData.win32ShortcutData.realPathType}-symlink`
  }
  else if (stat.isSymbolicLink()) {
    return `${dirItemData.realPathType}-symlink`
  }
}

function getHeight (dirItemData) {
  if (dirItemData.type === 'file' || dirItemData.type === 'file-symlink') {
    return dirItemData.height.file || 48
  }
  else if (dirItemData.type === 'directory' || dirItemData.type === 'directory-symlink') {
    return dirItemData.height.directory || 48
  }
}

async function getDirItemCount (dirItemData) {
  if (dirItemData.type === 'file' || dirItemData.type === 'file-symlink') {
    return null
  }
  else if (dirItemData.type === 'directory' || dirItemData.type === 'directory-symlink') {
    // Ignore dirs that couldn't be accessed by readdir
    try {
      const dirItems = await fsExtra.readdir(dirItemData.realPath)
      const dirItemsFiltered = dirItems.filter(nameBase => isDirItemAllowed(nameBase))
      return dirItemsFiltered.length
    }
    catch (error) {
      return null
    }
  }
}

function updateData (dirItemData) {
  if (dirItemData.type === 'directory' || dirItemData.type === 'directory-symlink') {
    dirItemData.stat.size = null
  }
}

async function getRealPath (dirItemData) {
  if (dirItemData.isWin32Shortcut) {
    return dirItemData.win32ShortcutData.resolvedPath.replace(/\\/g, '/')
  }
  else {
    try {
      const realpath = await fsExtra.realpath(dirItemData.path)
      return realpath.replace(/\\/g, '/')
    }
    catch (error) {
      return dirItemData.path.replace(/\\/g, '/')
    }
  }
}

async function getWin32ShortcutData (dirItemData, path) {
  if (dirItemData.isWin32Shortcut) {
    const win32ShortcutResolvedPath = electron.shell.readShortcutLink(path).target
    const win32ShortcutRealPathStat = await fsExtra.lstat(win32ShortcutResolvedPath)
    const win32ShortcutRealPathType = win32ShortcutRealPathStat.isFile() ? 'file' : 'directory'
    return {
      resolvedPath: win32ShortcutResolvedPath,
      realPathStat: win32ShortcutRealPathStat,
      realPathType: win32ShortcutRealPathType
    }
  }
  else {
    return undefined
  }
}

async function getStat (path) {
  try {
    return await fsExtra.lstat(path)
  }
  catch (error) {
    return {}
  }
}

async function isFile (dirItemData, stat) {
  if (dirItemData.isInaccessible) {
    try {
      // return await fsManager.isFile(dirItemData.path)
      return true
    }
    catch (error) {
      console.log(error)
      return false
    }
  }
  else {
    return stat.isFile()
  }
}

function isHidden (dirItemData) {
  return utils.platform === 'win32' 
    ? fsWin.getAttributesSync(dirItemData.path).IS_HIDDEN 
    : utils.unixHiddenFileRegex.test(dirItemData.path)
}

function isObjectEmpty (obj) {
  return obj &&
    Object.keys(obj).length === 0 &&
    obj.constructor === Object
}

function shouldFetchExtraStats (path) {
  const isExtraStatsEmpty = utils.isObjectEmpty(state.extraStats)
  const isExtraStatsFetchInProgress = state.isGettingStats
  const pathDir = PATH.parse(path).dir.replace(/\\/g, '/')
  const isExtraStatsForCurrentDir = state.extraStatsDir === pathDir
  return isExtraStatsEmpty && !isExtraStatsFetchInProgress && isExtraStatsForCurrentDir
}

function getAttributes (dirItemData) {
  if (utils.platform === 'win32') {
    return fsWin.getAttributesSync(dirItemData.path)
  }
  // TODO: FINISH
  else if (utils.platform === 'linux') {
    return {}
  }
  else if (utils.platform === 'darwin') {
    return 0
  }
}

function getSizeOnDisk (dirItemData) {
  if (utils.platform === 'win32') {
    return fsWin.ntfs.getCompressedSizeSync(dirItemData.path)
  }
  // TODO: FINISH
  else if (utils.platform === 'linux') {
    return {}
  }
  else if (utils.platform === 'darwin') {
    return 0
  }
}

/**
* @param {string} path
* @param {string} nameBase
* @param {string} itemHeight
* @returns {object}
*/
async function fetchDirItemData (path, nameBase, itemHeight) {
  if (shouldFetchExtraStats(path)) {
    state.isGettingStats = true
    const dir = PATH.parse(path).dir.replace(/\\/g, '/')
    // state.extraStats = await fsManager.getItemChildrenStats({ path })
    state.extraStatsDir = dir
    state.isGettingStats = false
  }
  const dirItemData = {
    stat: {},
    type: '',
    mime: {},
    name: '',
    path: path.replace(/\\/g, '/'),
    realPath: '',
    realPathStat: {},
    realPathType: '',
    height: itemHeight,
    dirItemCount: null,
    isStorageRoot: null,
    isHighlighted: false,
    isDamaged: false,
    isShown: true,
    isIntersected: true,
    isWin32Shortcut: null,
    win32ShortcutData: {}
  }
  try {
    // addExtraStatsProperty(dirItemData)
    dirItemData.stat = await getStat(path)
    // if (isObjectEmpty(dirItemData.stat)) {throw Error('inaccessible item')}
    // console.log(dirItemData.path, isObjectEmpty(dirItemData.stat))
    dirItemData.attributes = getAttributes(dirItemData)
    dirItemData.sizeOnDisk = getSizeOnDisk(dirItemData)
    dirItemData.isHidden = isHidden(dirItemData)
    dirItemData.isInaccessible = isObjectEmpty(dirItemData.stat)
    dirItemData.isWin32Shortcut = await isFile(dirItemData, dirItemData.stat) && nameBase.endsWith('.lnk')
    dirItemData.win32ShortcutData = await getWin32ShortcutData(dirItemData, path)
    dirItemData.realPath = await getRealPath(dirItemData)
    dirItemData.realPathStat = await getStat(dirItemData.realPath)
    dirItemData.realPathType = await getType(dirItemData, dirItemData.realPathStat)
    dirItemData.isStorageRoot = nameBase === ''
    dirItemData.name = nameBase === '' ? path.replace(/\\/g, '/') : nameBase
    dirItemData.type = await getType(dirItemData, dirItemData.stat)
    dirItemData.height = getHeight(dirItemData)
    dirItemData.dirItemCount = await getDirItemCount(dirItemData)
    dirItemData.mime = utils.getFileType(dirItemData.realPath, dirItemData.type)

    updateData(dirItemData)
  }
  catch (error) {}
  return dirItemData
}

export {
  getDirItemInfo,
  getDirItems
}
