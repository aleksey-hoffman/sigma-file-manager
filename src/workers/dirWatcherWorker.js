// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Note:
// Use Chokidar only in a web worker. When used in the renderer / main,
// it blocks the main thread and makes UI stutter when depth > 0

// TODO:
// Perhaps replace Chokidar with fabiospampinato/watcher

import TimeUtils from '../utils/timeUtils.js'
const chokidar = require('chokidar')

const state = { cancelled: false }
let eventDebouncer = null
let dirWatcher = null
let lastWatchedPath = ''

self.addEventListener('message', (event) => {
  if (event.data.action === 'init-dir-watch') {
    state.cancelled = false
    try {
      initDirWatch(event)
    }
    catch (error) {
      throw Error(error)
    }
  }
})

async function initDirWatch (event) {
  // If specified path is the same as the last one, do not re-init the watcher.
  // It will create an infinite loop:
  // This function emits the update that reloads the navigator page, which
  // in turn calls this function when some change is detected and re-inits the watcher,
  // which re-scans the directory. There's no need to re-init the watcher if it's already
  // watching the specified directory.
  if (lastWatchedPath === event.data.path) { return }
  lastWatchedPath = event.data.path
  eventDebouncer = new TimeUtils()
  const dirPath = event.data.path
  resetWatcher()
  initWatcher(dirPath, eventDebouncer)
}

async function resetWatcher () {
  try {
    await dirWatcher.close()
    dirWatcher = null
  }
  catch (error) {}
}

function initWatcher (dirPath, eventDebouncer) {
  dirWatcher = chokidar
    .watch(dirPath, {
      ignorePermissionErrors: true,
      ignored: [
        '**/$RECYCLE.BIN',
        '.**'
      ],
      ignoreInitial: true,
      // Watch 1 nested directory to get updates,
      // when the directory contents are modifed
      depth: 1,
      awaitWriteFinish: {
        pollInterval: 200
      }
    })
    .on('all', (event, path) => {
      // Bug: when watching a drive root dir (e.g. `C:/`),
      // the first time an event occurs, chokidar re-scans the whole tree and
      // emits a few hundred events, one for every path. Use debounce to avoid the issue
      eventDebouncer.debounce(() => {
        self.postMessage({
          action: 'info-update',
          data: {
            chokidarEvent: 'all',
            dirPath,
            path
          }
        })
      }, { time: 1000 })
    })
    .on('ready', () => {
    })
    .on('error', (error) => {
    })
}
