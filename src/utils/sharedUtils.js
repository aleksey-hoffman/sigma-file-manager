// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// This modules contains functions that can be used in both main and rendrer processes

const PATH = require('path')
const MIME = require('mime-types')
const supportedFormats = require('./supportedFormats.js')

module.exports = {
  env: process.env.NODE_ENV,
  platform: process.platform,
  unixHiddenFileRegex: /(^|[\/\\])\../,
  winFSstatusAttributes: {
    offline: '5248544',
    keepOnDevice: '525344',
    reparsePoint: 'ReparsePoint',
  },
  isObjectEmpty (obj) {
    return obj && Object.keys(obj).length === 0 && obj.constructor === Object
  },
  getHash (length = 32) {
    let hashID = ''
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < length; i++) {
      hashID += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    return hashID
  },
  /** Encode URL, replacing all URL-unsafe
  * characters (except slash) with hex representation
  * @param {string} path
  * @returns {string}
  */
  getUrlSafePath (path) {
    let colonCharPlacholder = `PLACEHOLDER-${this.getHash()}`
    return path
      .replace(/\\/g, '/')
      .replace(/:/g, colonCharPlacholder)
      .split('/')
      .map(pathItem => encodeURIComponent(pathItem))
      .join('/')
      .replace(new RegExp(colonCharPlacholder, 'g'), ':')
  },
  shortcutReadableToRaw (shortcut) {
    const rawShortcut = shortcut
      .replace(/\s/g, '')
      .replace('Key', '')
      .replace('Digit', '')
      .replace(/Backquote/g, '~')
      .replace(/Minus/g, '-')
      .replace(/Plus/g, '+')
      .replace(/Equal/g, '=')
      .replace(/BracketLeft/g, '[')
      .replace(/BracketRight/g, ']')
      .replace(/Semicolon/g, ';')
      .replace(/Quote/g, '\'')
      .replace(/Comma/g, ',')
      .replace(/Period/g, '.')
      .replace(/Slash/g, '/')
      .replace(/Backslash/g, '\\')
    return rawShortcut
  },
  shortcutRawToReadable (rawShortcut) {
    const shortcut = rawShortcut
      .replace('+', ' + ')
      .replace('+ +', '+')
      .replace('Key', '')
      .replace('Digit', '')
      .replace(/~/g, 'Backquote')
      .replace(/-/g, 'Minus')
      .replace(/\+/g, 'Plus')
      .replace(/=/g, 'Equal')
      .replace(/\[/g, 'BracketLeft')
      .replace(/]/g, 'BracketRight')
      .replace(/;/g, 'Semicolon')
      .replace(/'/g, 'Quote')
      .replace(/,/g, 'Comma')
      .replace(/\./g, 'Period')
      .replace(/\//g, 'Slash')
      .replace(/\\/g, 'Backslash')
    return shortcut
  },
  normalizePath (path) {
    if (!path || path === '') {return ''}
    if (['linux', 'darwin'].includes(process.platform)) {
      // Add '/' to index 0. Node fs throws ENOENT error
      // if path doesn't start with '/'
      if (path[0] !== '/') {
        path = `/${path}`
      }
    }
    return path
  },
  toCamelCase (string) {
    return string.toLowerCase().replace(/([-_][a-z])/ig, ($1) => {
      return $1.toUpperCase()
        .replace('-', '')
        .replace('_', '')
    })
  },
  toCamelCaseObjectKeys (object) {
    let newObject = {}
    if (!object) {return {}}
    for (const key of Object.keys(object)) {
      let camelCaseKey = this.toCamelCase(key)
      newObject[camelCaseKey] = object[key]
    }
    return newObject
  },
  getFileType (path, type = 'file') {
    let data = {
      mime: '',
      mimeDescription: '',
    }
    if (type === 'file' || type === 'extension') {
      if (type === 'extension') {
        path = `file.${path}`
      }
      const ext = PATH.extname(path)
      const mime = MIME.lookup(ext) || ''
      const isImage = mime.includes('image/')
      const isVideo = mime.includes('video/')
      const isAudio = mime.includes('audio/')
      const isText = mime.includes('text/')
      const isArchive = supportedFormats.includes({type: 'archive', ext})
      // Set properties
      data.mime = mime
      if (isImage) {data.mimeDescription = 'image'}
      else if (isVideo) {data.mimeDescription = 'video'}
      else if (isAudio) {data.mimeDescription = 'audio'}
      else if (isText) {data.mimeDescription = 'text'}
      else if (isArchive) {data.mimeDescription = 'archive'}
      else {
        data.mimeDescription = mime.length === 0
          ? ext.replace('.', '')
          : mime
      }
    }
    return data
  },
}
