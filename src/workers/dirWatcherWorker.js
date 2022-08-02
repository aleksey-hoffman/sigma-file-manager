// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Note:
// Use only in a web worker / child process to avoid blocking UI

import TimeUtils from '@/utils/timeUtils.js'
const Watcher = require('watcher')

let eventDebouncer = null
let watcher = null
let lastWatchedPath = null

self.addEventListener('message', (event) => {
  if (event.data.action === 'init') {
    init(event)
  }
})

async function init (event) {
  // If specified path is the same as the last one, do not re-init the watcher.
  // It will create an infinite loop:
  // This function emits the update that reloads the navigator page, which
  // in turn calls this function when some change is detected and re-inits the watcher,
  // which re-scans the directory. There's no need to re-init the watcher if it's already
  // watching the specified directory.
  if (lastWatchedPath === event.data.path) {return}
  lastWatchedPath = event.data.path
  eventDebouncer = new TimeUtils()
  const path = event.data.path
  await resetWatcher()
  initWatcher(path, eventDebouncer)
}

async function resetWatcher () {
  try {
    await watcher.close()
    watcher = null
  }
  catch (error) {}
}

function initWatcher (path, eventDebouncer) {
  watcher = new Watcher(path, {depth: 1, ignoreInitial: true})
  let updatedBatch = []

  watcher.on('all', (eventName, path) => {
    updatedBatch.push({
      action: 'change',
      eventName,
      path,
    })
    eventDebouncer.throttle(() => {
      self.postMessage(updatedBatch)
      updatedBatch = []
    }, {time: 1000})
  })
}
