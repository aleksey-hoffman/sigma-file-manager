// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

let data = {
  defaultFileNameBase: 'Serenity by Alena Aenami.jpg',
  windowTransparencyEffectData: {
    background: {
      selected: {},
      items: []
    }
  }
}

let backgroundItems = getBackgroundItems()
setWindowTransparencyEffectData(backgroundItems)

function setWindowTransparencyEffectData () {
  data.windowTransparencyEffectData.background.selected = getSelectedBackground(backgroundItems)
  data.windowTransparencyEffectData.background.items = backgroundItems
}

function getBackgroundItems () {
  let backgroundItems = require('../homeBannerMediaData.js').items
  backgroundItems = processBackgroundItems(backgroundItems)
  return backgroundItems
}

function processBackgroundItems (backgroundItems) {
  return backgroundItems.map(item => {
    return {
      fileNameBase: item.fileNameBase,
      path: item.path,
      type: item.type
    }
  })
}

function getSelectedBackground (backgroundItems) {
  return backgroundItems
    .find(item => item.fileNameBase === data.defaultFileNameBase) ||
    backgroundItems[0]
}

module.exports = data.windowTransparencyEffectData
