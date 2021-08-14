// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// TODO:
// PERFORMANCE IMPROVEMENTS:
// - Spawn a separate worker for every drive
// - Divide storage data files into sections and spawn a separate worker for every section

import { search } from '../utils/search.js'
const fs = require('fs')
const PATH = require('path')
const readline = require('readline')
const zlib = require('zlib')

const state = { isCanceled: false }
let readInterface = null
let readStream = null
let lines = []
let lineCounter = 0
let linesProcessed = 0
let chunk = 0
const chunkLineCount = 16384
let searchResults = []
let lastSearchUpdateTime = 0

self.addEventListener('message', (event) => {
  if (event.data.action === 'cancel') {
    state.isCanceled = true
    closeStream()
  }
  else {
    state.isCanceled = false
    initWorker(event)
  }
})

function closeStream () {
  if (readStream !== null) {
    readStream.destroy()
  }
  if (readInterface !== null) {
    readInterface.close()
  }
}

async function initWorker (event) {
  try {
    const searchResults = await getSearchResults(event.data)
    self.postMessage({
      action: 'results',
      searchResults,
      mount: event.data.mount,
      isFinished: true,
      isCancelled: state.isCanceled
    })
  }
  catch (error) {
    // console.log('error: globalSearchWorker.js: initWorker', error)
    self.postMessage({ action: 'error', error })
  }
}

async function getSearchResults (data) {
  return new Promise((resolve, reject) => {
    readStream = fs.createReadStream(PATH.normalize(data.path))
    if (data.compressSearchData) {
      readInterface = readline.createInterface({
        input: readStream.pipe(zlib.createGunzip())
      })
    }
    else {
      readInterface = readline.createInterface({
        input: readStream
      })
    }
    readInterface.on('line', async (line) => {
      // Build up a chunk of lines before processing
      lines.push(line)
      lineCounter += 1
      linesProcessed += 1
      // Process a chunk of lines
      if (lineCounter === chunkLineCount) {
        processChunkOfLines(data)
        self.postMessage({
          action: 'info-update',
          update: {
            type: 'data',
            mount: data.mount,
            linesProcessed
          }
        })
        const timePassedSinceLastSearchUpdate = new Date() - lastSearchUpdateTime
        if (timePassedSinceLastSearchUpdate > data.searchResultsUpdateInterval) {
          lastSearchUpdateTime = new Date()
          self.postMessage({
            action: 'results',
            searchResults: getBestSearchItems(data, searchResults),
            mount: data.mount,
            isFinished: false,
            isCancelled: state.isCanceled
          })
        }
      }
    })
    readInterface.on('close', async (line) => {
      if (lineCounter > 0) {
        processChunkOfLines(data, { lastChunk: true })
        self.postMessage({
          action: 'info-update',
          update: {
            type: 'data',
            mount: data.mount,
            linesProcessed
          }
        })
      }
      const bestResults = getBestSearchItems(data, searchResults)
      searchResults = bestResults
      resolve(searchResults)
    })
  })
}

function processChunkOfLines (data, options = {}) {
  let searchResultsChunk = search({
    list: lines,
    query: data.query,
    options: data.options
  })
  searchResultsChunk = getBestSearchItems(data, searchResultsChunk)
  searchResults = [...searchResults, ...searchResultsChunk]
  // Reset values
  lines = []
  lineCounter = 0
  chunk += 1
}

function getBestSearchItems (data, searchResultsChunk) {
  return searchResultsChunk
    .sort((a, b) => parseFloat(b.score) - parseFloat(a.score))
    .slice(0, data.amount) // get the best N items
}
