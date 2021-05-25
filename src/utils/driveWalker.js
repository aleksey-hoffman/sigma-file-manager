// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const PATH = require('path')
const through2 = require('through2')
const readdirp = require('readdirp')
const micromatch = require('micromatch')

class Walk {
  constructor (root, maxDepth, disallowedPaths) {
    this.root = root
    this.maxDepth = maxDepth
    this.disallowedPaths = disallowedPaths.map(path => {
      return PATH.normalize(path).replace(/\\/g, '/')
    })
    this.init()
  }

  init () {
    const classScope = this
    const readStream = readdirp(this.root, {
      type: 'files_directories',
      lstat: true,
      depth: this.maxDepth || undefined
    })
    const lineTransformer = through2.obj(function (data, enc, next) {
      const fullPath = data.fullPath
      if (!micromatch.isMatch(fullPath, classScope.disallowedPaths)) {
        this.push(`${fullPath}\n`)
      }
      next()
    })

    return readStream
      .pipe(lineTransformer)
  }
}

module.exports = { Walk }
