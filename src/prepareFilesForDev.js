// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// Disable packaging
return true

const fsExtra = require('fs-extra')
const node7z = require('node-7z')
const bin7Zip = require('7zip-bin')

const binDirPath = `./public/resources/${process.platform}/bin`
const compressedFileName = 'compressed.zip'
const compressedFilePath = `${binDirPath}/${compressedFileName}`

async function initCompressBinaries () {
  console.log('INFO: bundled binaries: init prepare for dev')
  if (fsExtra.existsSync(compressedFilePath)) {
    await decompressBinaries()
    console.log('SUCCESS: bundled binaries: finished preparing for dev')
  }
  else {
    console.log('SUCCESS: bundled binaries: already prepared for dev')
  }
}

// Deompress dir items
async function decompressBinaries () {
  return new Promise((resolve, reject) => {
    const binariesCompressStream = node7z.extractFull(
      compressedFilePath,
      binDirPath,
      {
        $bin: bin7Zip.path7za,
        $progress: true
      }
    )
    console.log('INFO: bundled binaries: start decompressing')
    binariesCompressStream.on('progress', (progress) => {
      process.stdout.write(`IN PROGRESS: bundled binaries: decompressing: ${progress.percent}%\r`)
    })
    binariesCompressStream.on('end', async () => {
      console.log('INFO: bundled binaries: init delete compressed file')
      await deleteSources()
      console.log('SUCCESS: bundled binaries: compressed file deleted')
      resolve()
    })
  })
}

// Remove compressed file
function deleteSources () {
  fsExtra.removeSync(compressedFilePath)
}

initCompressBinaries()
