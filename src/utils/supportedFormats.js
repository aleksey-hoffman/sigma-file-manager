// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

let formats = {
  fileType: {
    archivePack: [
      '7z', 'xz', 'bz2', 'gz', 'tar', 'zip', 'wim',
    ],
    archiveUnpack: [
      '7z', 'xz', 'bz2', 'gz', 'tar', 'zip', 'wim',
      'ar', 'arj', 'cab', 'chm', 'cpio', 'cramfs', 'dmg',
      'ext', 'fat', 'gpt', 'hfs', 'ihex', 'iso', 'lzh',
      'lzma', 'mbr', 'msi', 'nsis', 'ntfs', 'qcow2', 'rar',
      'rpm', 'squashfs', 'udf', 'uefi', 'vdi', 'vhd',
      'vmdk', 'xar', 'z',
    ],
  },
  videoHosting: {
    youtube: ['youtube', 'youtu.be'],
  },
  videoContentTypes: {
    m3u8: {
      headerContentType: 'application/vnd.apple.mpegurl',
      fileExt: 'm3u8',
    },
  },
}

function includes (params) {
  if (params.type === 'archive') {
    let extBase = params.ext.replace('.', '')
    let includesArchivePack = formats.fileType.archivePack.includes(extBase)
    let includesArchiveUnpack = formats.fileType.archiveUnpack.includes(extBase)
    return includesArchivePack || includesArchiveUnpack
  }
}

/**
* @param {string} params.filePath
* @param {string} params.headerContentType
* @returns {boolean}
*/
function getVideoContentType (params) {
  let result = {
    isSupported: false,
    source: '',
  }
  for (const [key, value] of Object.entries(formats.videoContentTypes)) {
    const filePathMatches = value.some(item => params.filePath.endsWith(item.filePath))
    const headerContentTypeMatches = value.some(item => params.headerContentType === item.headerContentType)
    if (filePathMatches && headerContentTypeMatches) {
      result.isSupported = true
      result.source = key
    }
  }
  return result
}

/**
* @param {string} params.host
* @returns {boolean}
*/
function getVideoHosting (params) {
  let result = {
    isSupported: false,
    source: '',
  }
  for (const [key, value] of Object.entries(formats.videoHosting)) {
    if (value.some(item => params.host.includes(item))) {
      result.isSupported = true
      result.source = key
    }
  }
  return result
}

module.exports = {
  formats,
  includes,
  getVideoContentType,
  getVideoHosting,
}