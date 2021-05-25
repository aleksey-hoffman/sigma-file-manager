// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PATH = require('path')
const fs = require('fs')
const { app } = require('electron')

function getUniquePath (destPath) {
  let num = 1
  const parsed = PATH.parse(destPath)
  const dir = parsed.dir
  const name = parsed.name
  const ext = parsed.ext

  while (fs.existsSync(destPath)) {
    destPath = ext !== ''
      ? PATH.join(dir, `${name} (${num++})${ext}`)
      : PATH.join(dir, `${name} (${num++})`)
  }
  return destPath
}

const queue = new Set()

function registerListener (win, options) {
  return new Promise((resolve, reject) => {
    let receivedBytes = 0
    let completedBytes = 0
    let totalBytes = 0
    const getQueueSize = () => queue.size
    const getQueueProgress = () => receivedBytes / totalBytes

    const listener = (event, item, webContents) => {
      item.hashID = options.hashID
      queue.add(item)
      totalBytes += item.getTotalBytes()
      let previousReceivedBytes = 0
      const progressData = {}

      // Parse filename
      let filePath = options.filename !== undefined
        ? PATH.join(options.dir, options.filename)
        : PATH.join(options.dir, item.getFilename())

      // Set downlaod path
      filePath = getUniquePath(filePath)
      const uniqueFilename = PATH.parse(filePath).base
      item.setSavePath(PATH.normalize(filePath))

      // Handle "updated" event
      item.on('updated', (event, state) => {
        const receivedBytes = item.getReceivedBytes()
        const totalBytes = item.getTotalBytes()
        // Update badge counter
        if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
          app.badgeCount = getQueueSize()
        }
        // Update progress bar
        if (!win.isDestroyed()) {
          win.setProgressBar(getQueueProgress())
        }
        // Emit onProgress callback
        if (options.onProgress) {
          // Emit onProgress callback
          options.onProgress({
            isPaused: item.isPaused(),
            percentDone: (receivedBytes / totalBytes * 100).toFixed(0),
            receivedBytes: receivedBytes,
            totalBytes: totalBytes,
            speed: receivedBytes - previousReceivedBytes,
            filename: uniqueFilename,
            filePath: filePath,
            dir: options.dir,
            hashID: options.hashID,
            isUpdate: options.isUpdate
          })
          previousReceivedBytes = receivedBytes
        }
      })
      // Handle "done" event
      item.once('done', (event, state) => {
        // Remove listener when done
        win.webContents.session.removeListener('will-download', listener)

        completedBytes += item.getTotalBytes()
        queue.delete(item)

        if (options.showBadge && ['darwin', 'linux'].includes(process.platform)) {
          app.badgeCount = getQueueSize()
        }

        if (!win.isDestroyed() && !getQueueSize()) {
          win.setProgressBar(-1)
          receivedBytes = 0
          completedBytes = 0
          totalBytes = 0
        }

        if (state === 'cancelled') {
          if (options.onCancel) {
            options.onCancel({
              percentDone: (receivedBytes / totalBytes * 100).toFixed(0),
              receivedBytes: receivedBytes,
              totalBytes: totalBytes,
              speed: receivedBytes - previousReceivedBytes,
              filename: uniqueFilename,
              filePath: filePath,
              dir: options.dir,
              hashID: options.hashID,
              isUpdate: options.isUpdate
            })
          }
        }
        else if (state === 'interrupted' && options.onError) {
          options.onError(item.getFilename())
        }
        else if (state === 'completed') {
          if (process.platform === 'darwin') {
            app.dock.downloadFinished(filePath)
          }
          resolve({
            filename: uniqueFilename,
            filePath: filePath,
            dir: options.dir,
            hashID: options.hashID,
            isUpdate: options.isUpdate
          })
        }
      })
    }

    win.webContents.session.on('will-download', listener)
  })
}

function download (win, options) {
  return new Promise((resolve, reject) => {
    options = {
      ...options,
      showBadge: true
    }
    // Register download listener
    registerListener(win, options)
      .then((item) => {
        resolve(item)
      })
    // Download specified file
    win.webContents.downloadURL(options.url)
  })
}

function resume (hashID) {
  queue.forEach((item) => {
    if (item.hashID === hashID) {
      item.resume()
    }
  })
}

function pause (hashID) {
  queue.forEach((item) => {
    if (item.hashID === hashID) {
      item.pause()
    }
  })
}

function cancel (hashID) {
  queue.forEach((item) => {
    if (item.hashID === hashID) {
      queue.delete(item)
      item.cancel()
    }
  })
}

module.exports = {
  download,
  resume,
  pause,
  cancel
}
