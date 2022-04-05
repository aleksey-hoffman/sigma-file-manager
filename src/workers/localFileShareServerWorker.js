// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const express = require('express')
const expressServer = express()

let selfDistructionTimeout = null

process.on('message', (event) => {
  scheduleSelfTermination()
  if (event.action === 'start-server') {
    serveFile(event)
  }
})

/** Self-distruct the process if it stops receiving reset signals
* from the main process, e.g. if the main process is terminated
* unexpectedly. Otherwise the process will keep hanging in the memory
*/
function scheduleSelfTermination () {
  clearTimeout(selfDistructionTimeout)
  selfDistructionTimeout = setTimeout(() => {
    process.kill()
  }, 15000)
}

function serveFile (payload) {
  const {
    path,
    fileShareType,
    fileSharePort
  } = payload

  expressServer.get('/', (request, response, next) => {
    if (fileShareType === 'stream') {
      response.sendFile(path)
    }
    else if (fileShareType === 'download') {
      response.download(path, (error) => {
        if (error) { throw error }
      })
    }
  })
  
  expressServer.listen(fileSharePort)
}
