// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

let formats = {
  fileType: {
    archivePack: [
      '7z', 'xz', 'bz2', 'gz', 'tar', 'zip', 'wim'
    ],
    archiveUnpack: [
      '7z', 'xz', 'bz2', 'gz', 'tar', 'zip', 'wim', 
      'ar', 'arj', 'cab', 'chm', 'cpio', 'cramfs', 'dmg', 
      'ext', 'fat', 'gpt', 'hfs', 'ihex', 'iso', 'lzh', 
      'lzma', 'mbr', 'msi', 'nsis', 'ntfs', 'qcow2', 'rar', 
      'rpm', 'squashfs', 'udf', 'uefi', 'vdi', 'vhd', 
      'vmdk', 'xar', 'z'
    ]
  }
}

function includes (params) {
  if (params.type === 'archive') {
    let extBase = params.ext.replace('.', '')
    let includesArchivePack = formats.fileType.archivePack.includes(extBase)
    let includesArchiveUnpack = formats.fileType.archiveUnpack.includes(extBase)
    return includesArchivePack || includesArchiveUnpack
  }
}

export {
  formats,
  includes
} 