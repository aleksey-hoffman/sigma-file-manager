// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const ffmpeg = require('fluent-ffmpeg')

self.addEventListener('message', (event) => {
  initWorker(event.data)
})

async function initWorker (data) {
  try {
    ffmpeg.setFfmpegPath(data.appPaths.binFFMPEG)
    ffmpeg.setFfprobePath(data.appPaths.binFFPROBE)

    ffmpeg.ffprobe(data.path, (error, metadata) => {
      if (error) {
        self.postMessage({result: 'error', error})
      }
      else {
        self.postMessage({result: 'end', metadata})
      }
    })
  }
  catch (error) {
    self.postMessage({result: 'error', error})
  }
}
