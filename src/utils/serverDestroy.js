// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// This is a local version of 'server-destroy' module
module.exports = enableDestroy

function enableDestroy (server) {
  const connections = {}

  server.on('connection', (connection) => {
    const key = connection.remoteAddress + ':' + connection.remotePort
    connections[key] = connection
    connection.on('close', () => {
      delete connections[key]
    })
  })

  server.destroy = (cb) => {
    server.close(cb)
    for (const key in connections) {
      connections[key].destroy()
    }
  }
}
