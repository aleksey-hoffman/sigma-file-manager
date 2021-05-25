// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const fs = require('fs')
const PATH = require('path')
const readdirp = require('readdirp')
const SPDXIdentifier = 'SPDX-License-Identifier'
const directories = ['./public', './src']

async function initAppendLicense () {
  directories.forEach(dirPath => {
    readdirp(dirPath, {
      fileFilter: ['*.vue', '*.html', '*.js', '!lodash.min.js'],
      directoryFilter: ['!resources'],
      type: 'files',
      alwaysStat: true,
      depth: Infinity
    }
    )
      .on('data', (entry) => {
        const licenseLines = getLicenseLines(entry).reverse()
        const fileLines = fs.readFileSync(entry.fullPath).toString().split('\n')
        const alreadyHasLicense = fileLines[0].includes(SPDXIdentifier)
        if (!alreadyHasLicense) {
          licenseLines.forEach(licenseLine => {
            fileLines.unshift(licenseLine)
          })
          fs.writeFileSync(entry.fullPath, fileLines.join('\n'))
        }
      })
      .on('warn', error => console.error('non-fatal error', error))
      .on('error', error => console.error('fatal error', error))
  })
}

function getLicenseLines (dirItem) {
  const parsedFileName = PATH.parse(dirItem.basename)
  const licenseText = [
    'SPDX-License-Identifier: GPL-3.0-or-later',
    'License: GNU GPLv3 or later. See the license file in the project root for more information.',
    'Copyright © 2021 - present Aleksey Hoffman. All rights reserved.'
  ]
  if (['.vue', '.html'].includes(parsedFileName.ext)) {
    return [
      `<!-- ${licenseText[0]}`,
      `${licenseText[1]}`,
      `${licenseText[2]}`,
      '-->',
      ''
    ]
  }
  else if (['.js'].includes(parsedFileName.ext)) {
    return [
      `// ${licenseText[0]}`,
      `// ${licenseText[1]}`,
      `// ${licenseText[2]}`,
      ''
    ]
  }
}

initAppendLicense()
