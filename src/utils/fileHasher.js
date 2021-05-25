// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

const { createXXHash64 } = require('hash-wasm')
const { XXHash3, XXHash128 } = require('xxhash-addon')

const fs = require('fs')

class FileHasher {
  constructor (path, algorithm) {
    this.state = { isCanceled: false }
    this.interval = null
    this.readStream = null
    this.path = path
  }

  cancel () {
    this.state.isCanceled = true
  }

  /**
  * @param {object} params
  * @param {string} params.algorithm
  */
  async gen (params) {
    const defaultParams = {
      algorithm: 'xxhash64'
    }
    params = { ...defaultParams, ...params }
    try {
      let hasher
      if (params.algorithm === 'xxhash64') {
        hasher = await createXXHash64()
      }
      else if (params.algorithm === 'xxhash3') {
        hasher = new XXHash3()
      }
      else if (params.algorithm === 'xxhash128') {
        hasher = new XXHash128()
      }
      return new Promise((resolve, reject) => {
        // Get hash
        this.readStream = fs.createReadStream(this.path)
          .on('data', data => hasher.update(data))
          .on('end', () => {
            clearInterval(this.interval)
            if (params.algorithm === 'xxhash64') {
              resolve(hasher.digest('hex'))
            }
            else if (['xxhash3', 'xxhash128'].includes(params.algorithm)) {
              // Convert Uint8Array to HEX
              const result = [...hasher.digest()]
                .map(item => item.toString(16).padStart(2, '0'))
                .join('')
              resolve(result)
            }
          })
        // Init an interval to watch 'cancel' event
        this.interval = setInterval(() => {
          if (this.state.isCanceled) {
            clearInterval(this.interval)
            this.readStream.destroy()
            reject(undefined)
          }
        }, 10)
      })
    }
    catch (error) {
      console.log('error: fileHasher:', error)
    }
  }
}

export default FileHasher
