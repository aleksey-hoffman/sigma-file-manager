// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import utils from '@/utils/utils'
import dialogs from '@/utils/dialogs.js'
import * as notifications from '@/utils/notifications.js'

const electron = require('electron')
const PATH = require('path')

const defaultParams = {
  safeCheck: true,
  silent: false,
  allowUndo: false,
  reloadDir: false,
  goUpDir: false,
  operation: 'trash',
}

export default async function trashDirItems (store, params) {
  params = utils.cloneDeep({...defaultParams, ...params})
  try {
    if (params.safeCheck) {
      params.items = await chooseItemsToRemove(store, params) || []
    }
    let result = await initRemoveDirItems(params)
    await onTrashSuccess(store, {...result, ...params})
  }
  catch (error) {
    console.error(error)
    notifications.emit({
      name: 'trashItemsError',
      error,
    })
  }
}

async function initRemoveDirItems (params) {
  if (params.items.length === 0) {
    return {
      removedItems: [],
      notRemovedItems: [],
    }
  }
  if (params.items.length > 0) {
    let {removedItems, notRemovedItems} = await electron.ipcRenderer.invoke('trash-dir-items', params)
    return {
      removedItems,
      notRemovedItems,
    }
  }
}

async function chooseItemsToRemove (store, params) {
  if (params?.items?.length === 0) {return []}
  let {items} = params
  let filteredItems = utils.cloneDeep(items)
  filteredItems = filteredItems.filter(item => !item.isStorageRoot)
  if (filteredItems.length === 0) {return []}

  const currentDirPath = store.state.navigatorView.currentDir.path
  const includesDirItemsInRootDir = checkIncludesDirItemsInRootDir(filteredItems)
  const includesCurrentDir = filteredItems.some(item => item.path === currentDirPath)
  const protectedDirItems = getProtectedDirItems({
    items: filteredItems,
    protectedItems: store.state.storageData.protected.items,
  })
  const includesProtectedDirItems = protectedDirItems.length > 0

  let conflictCount = [includesDirItemsInRootDir, includesCurrentDir, includesProtectedDirItems].filter(Boolean).length
  let currentConflict = 0

  if (includesDirItemsInRootDir) {
    currentConflict++
    filteredItems = await promptTrashRootDir(store, filteredItems, currentConflict, conflictCount, params, includesDirItemsInRootDir)
  }
  if (includesCurrentDir) {
    currentConflict++
    filteredItems = await promptTrashCurrentDir(store, filteredItems, currentConflict, conflictCount, params, includesCurrentDir)
  }
  if (includesProtectedDirItems) {
    currentConflict++
    filteredItems = await promptTrashProtected(store, filteredItems, currentConflict, conflictCount, protectedDirItems)
  }

  return filteredItems
}

async function promptTrashRootDir (store, filteredItems, currentConflict, conflictCount, params, includesDirItemsInRootDir) {
  if (filteredItems.length === 0) {
    return []
  }
  if (!includesDirItemsInRootDir) {
    return filteredItems
  }
  const {choice, items} = await dialogs.showDialog(store, {
    name: 'trashInRoot',
    currentConflict,
    conflictCount,
    clipboardItemSize: store.state.navigatorView.clipboard.clipboardItemSize,
    items: filteredItems,
  })
  if (choice === 'trash') {
    params.reloadDir = true
  }
  return choice === 'cancel' ? [] : items
}

async function promptTrashCurrentDir (store, filteredItems, currentConflict, conflictCount, params, includesCurrentDir) {
  if (filteredItems.length === 0) {
    return []
  }
  if (!includesCurrentDir) {
    return filteredItems
  }
  const {choice, items} = await dialogs.showDialog(store, {
    name: 'trashCurrentDir',
    currentConflict,
    conflictCount,
    clipboardItemSize: store.state.navigatorView.clipboard.clipboardItemSize,
    items: filteredItems,
  })
  if (choice === 'trash') {
    params.goUpDir = true
  }
  return choice === 'cancel' ? [] : items
}

async function promptTrashProtected (store, filteredItems, currentConflict, conflictCount, protectedDirItems) {
  if (filteredItems.length === 0) {
    return []
  }
  if (protectedDirItems.length === 0) {
    return filteredItems
  }
  const {choice, items} = await dialogs.showDialog(store, {
    name: 'trashProtected',
    currentConflict,
    conflictCount,
    clipboardItemSize: store.state.navigatorView.clipboard.clipboardItemSize,
    items: filteredItems,
    protectedDirItems,
  })
  return choice === 'cancel' ? [] : items
}

function checkIncludesDirItemsInRootDir (items) {
  return items.some(item => {
    const itemDir = PATH.parse(item.path).dir
    const itemDirIsRoot = PATH.parse(itemDir).base === ''
    return itemDirIsRoot
  })
}

async function onTrashSuccess (store, params) {
  if (params.items.length === 0) {return}

  notifications.emit({
    name: 'trashItemsSuccess',
    props: params,
  })

  let paramsClone = utils.cloneDeep(params)
  store.dispatch('REMOVE_FROM_PROTECTED', paramsClone)
  store.dispatch('REMOVE_FROM_PINNED', paramsClone)
  store.dispatch('CLEAR_FS_CLIPBOARD')
  store.dispatch('DESELECT_ALL_DIR_ITEMS')

  if (params.goUpDir) {
    store.dispatch('goUpDirectory')
  }
  if (params.reloadDir) {
    store.dispatch('RELOAD_DIR', {scrollTop: false})
  }
}

function getProtectedDirItems (params) {
  return [...params.items].filter(item => {
    return params.protectedItems.some(protectedItem => {
      return protectedItem.path === item.path
    })
  })
}