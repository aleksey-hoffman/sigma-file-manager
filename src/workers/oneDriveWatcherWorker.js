// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Note:
// Use only in a web worker / child process to avoid blocking UI

import TimeUtils from '@/utils/timeUtils.js'
const nodeWatch = require('node-watch')

let eventThrottle = null
let watcher = null

self.addEventListener('message', (event) => {
  if (event.data.action === 'init') {
    init(event)
  }
})

async function init (event) {
  eventThrottle = new TimeUtils()
  const paths = event.data.paths
  await resetWatcher()
  initWatcher(paths, eventThrottle)
}

async function resetWatcher () {
  try {
    await watcher.close()
    watcher = null
  }
  catch (error) {}
}

function initWatcher (paths, eventThrottle) {
  watcher = nodeWatch(paths, {recursive: true})
  let updatedBatch = []

  watcher.on('change', (eventName, path) => {
    updatedBatch.push({
      action: 'change',
      eventName,
      path,
    })
    eventThrottle.throttle(() => {
      self.postMessage(updatedBatch)
      updatedBatch = []
    }, {time: 1000})
  })
}
