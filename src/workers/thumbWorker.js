// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const ffmpeg = require('fluent-ffmpeg')

const state = {
  canceled: false
}

self.addEventListener('message', (event) => {
  if (event.data.action === 'cancel') {
    state.cancelled = true
  }
  else {
    state.cancelled = false
    initWorker(event.data)
  }
})

async function initWorker (data) {
  // Notes:
  // - Generating image 2x the size of the thumb to make it look sharper
  // - To preserve image aspect ratio and avoid distortion,
  //   I can use auto width: '?x96' and CSS "object-fit: cover"
  const scale = 2
  const small = `${48 * scale}x?`
  const large = `${280 * scale}x?`
  const thumbSize = data.navigatorLayout === 'list' ? small : large
  
  ffmpeg.setFfmpegPath(data.appPaths.binFFMPEG)
  ffmpeg.setFfprobePath(data.appPaths.binFFPROBE)

  // TODO:
  // Support files containing glob characters e.g. "!@#$filename.jpg"
  // by storing filename encoded with utils.getUrlSafePath
  ffmpeg(data.dirItemRealPath)
    .size(thumbSize)
    .on('error', (error) => {
      self.postMessage({result: 'error'})
    })
    .on('end', () => {
      self.postMessage({result: 'end'})
    })
    .save(data.thumbPath)
}
