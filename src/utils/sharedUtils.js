// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// This modules contains functions that can be used in both main and rendrer processes

export default {
  getHash (length = 32) {
    let hashID = ''
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    for (let i = 0; i < length; i++) {
      hashID += alphabet.charAt(Math.floor(Math.random() * alphabet.length))
    }
    return hashID
  },
  /** Removes URL-unsafe symbols like '#'
  * @param {string} path
  * @returns {string}
  */
  getUrlSafePath (path) {
    const safePath = path
      .replace(/#/g, '%23')
      .replace(/'/g, '%27')
    return safePath
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
  }
}
