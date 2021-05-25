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
const dirNameBases = fsExtra.readdirSync(binDirPath)
const pathsToRemove = dirNameBases.filter(nameBase => nameBase !== compressedFileName)
const maxRAMusage = '700mb'
let commands = []

// Config compressor
// The more RAM it uses, the better compression ratio it will produce
if (maxRAMusage === '700mb') {
  commands = ['-t7z', '-m0=lzma2', '-mx=9', '-mfb=64', '-md=64m', '-ms=on']
}
else if (maxRAMusage === '400mb') {
  commands = ['-t7z', '-m0=lzma2', '-mx=9', '-mfb=64', '-md=32m', '-ms=on']
}

async function initCompressBinaries () {
  console.log('INFO: bundled binaries: init prepare for build')
  if (!fsExtra.existsSync(compressedFilePath)) {
    await compressBinaries()
    console.log('SUCCESS: bundled binaries: prepared for build')
  }
  else {
    console.log('SUCCESS: bundled binaries: already prepared for build')
  }
}

// Compress dir items
async function compressBinaries () {
  return new Promise((resolve, reject) => {
    const binariesCompressStream = node7z.add(
      compressedFilePath,
      `${binDirPath}/*`,
      {
        $bin: bin7Zip.path7za,
        $progress: true,
        recursive: true,
        // $raw: commands
      }
    )
    console.log('INFO: bundled binaries: start compressing binaries')
    binariesCompressStream.on('progress', (progress) => {
      process.stdout.write(`IN PROGRESS: bundled binaries: compressing: ${progress.percent}%\r`)
    })
    binariesCompressStream.on('end', async () => {
      console.log('INFO: bundled binaries: init delete binary dirs')
      await deleteSources()
      console.log('SUCCESS: bundled binaries: binary dirs deleted')
      resolve()
    })
  })
}

// Remove non-compressed dir items
function deleteSources () {
  dirNameBases.forEach(nameBase => {
    if (pathsToRemove.includes(nameBase)) {
      fsExtra.removeSync(`${binDirPath}/${nameBase}`)
    }
  })
}

initCompressBinaries()
