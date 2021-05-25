// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PATH = require('path')
const fs = require('fs')
const MIME = require('mime-types')
const appPaths = require('./appPaths.js')

const defaultFiles = fs.readdirSync(appPaths.homeBannerMedia)
const customFiles = fs.readdirSync(appPaths.storageDirectories.appStorageHomeBannerMedia)
const mediaItemsConfig = getMediaItemsConfig()
const parsedDefaultMediaItems = fetchParsedDefaultMediaItems()
const parsedCustomMediaItems = fetchParsedCustomMediaItems()
const defaultMediaItem = parsedDefaultMediaItems.find(item => item.isDefault)
const items = [...parsedDefaultMediaItems, ...parsedCustomMediaItems]

function fetchParsedDefaultMediaItems() {
  return getParsedMediaItems({
    files: defaultFiles, 
    isCustom: false,
    path: appPaths.homeBannerMedia
  })
}

function fetchParsedCustomMediaItems() {
  return getParsedMediaItems({
    files: customFiles, 
    isCustom: true,
    path: appPaths.storageDirectories.appStorageHomeBannerMedia
  })
}

function getParsedMediaItems (params) {
  return [...params.files].map(fileNameBase => {
    let mediaItemData = getMediaItemData({fileNameBase, ...params})
    mediaItemData = applyConfigProperties(mediaItemData)
    return mediaItemData
  })
}

function getMediaItemData (params) {
  const parsedPath = PATH.parse(params.fileNameBase)
  const path = PATH.join(params.path, parsedPath.base)
  const mime = MIME.lookup(parsedPath.ext) || ''
  const type = mime.includes('image/') ? 'image' : 'video'
  const mediaItemData = {
    isDefault: false,
    isCustom: params.isCustom,
    positionX: 50,
    positionY: 50,
    fileNameBase: parsedPath.base,
    path,
    type
  }
  return mediaItemData
}

function applyConfigProperties (mediaItemData) {
  const configMediaItem = mediaItemsConfig.items.find(customItem => {
    return customItem.fileNameBase === mediaItemData.fileNameBase
  })
  if (configMediaItem) {
    mediaItemData = { ...mediaItemData, ...configMediaItem }
  }
  return mediaItemData
}

function getMediaItemsConfig () {
  const configPath = PATH.join(__static, 'configs/homeBanner.config.json')
  return JSON.parse(
    fs.readFileSync(configPath, { encoding: 'utf8' })
  )
}

module.exports = {
  items,
  defaultItem: defaultMediaItem
}
