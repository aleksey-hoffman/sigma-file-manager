// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// TODO: (?) Move to the main process
// TODO: If systeminformation.fsSize() ever becomes faster,
// replace "node-diskuage" with the "sysInfo.fsSize()""
// and then remove "app.allowRendererProcessReuse = false" from the main.
// Currently it's 1000 times slower (0.1 ms vs 100 ms)

import utils from './utils'
const sysInfo = require('systeminformation')
const diskusage = require('diskusage')
const PATH = require('path')

export default async function getStorageDevices () {
  return []
  let drives = await sysInfo.blockDevices()
  drives = formatDrivesData(drives)
  drives = processDrivesData(drives)
  drives = await addPropertiesToDrivesData(drives)
  return drives
}

async function addPropertiesToDrivesData (drives) {
  for (let index = 0; index < drives.length; index++) {
    const drive = drives[index]

    let size
    let percentUsed

    try {
      size = await diskusage.check(drive.mount)
      percentUsed = Math.floor((1 - (size.free / size.total)) * 100)
    }
    catch (e) {
      // Drive couldn't be checked by diskusage, likely because it isn't readable
      size = { available: 0, free: 0, total: 0 }
      percentUsed = 0
    }

    drive.size = size
    drive.percentUsed = percentUsed
    drive.titleSummary = getDriveTitleSummary(drive)
    drive.infoSummary = getDriveInfoSummary(drive, percentUsed)
    drive.infoMiniSummary = getDriveInfoMiniSummary(drive)
  }
  return drives
}

function processDrivesData (drives) {
  if (process.platform === 'linux') {
    // Filter out unneeded mount points
    drives = drives.filter(drive => {
      const allowedTypes = ['part', 'rom'].includes(drive.type)
      const isSwap = drive.fsType === 'swap'
      return allowedTypes && !isSwap
    })
  }
  else if (process.platform === 'win32') {
    // Filter out drives with empty 'fsType' property (likely RAW drives or CD/DVD Drives)
    drives = drives.filter(drive => drive.fsType !== '')
  }
  return drives
}

function formatDrivesData (drives) {
  drives.forEach(drive => {
    drive.name = PATH.posix.join(drive.name, '/')
    drive.mount = PATH.posix.join(drive.mount, '/')
  })
  return drives
}

function getDriveTitleSummary (drive) {
  if (process.platform === 'win32') {
    return `${drive.mount.replace(':/', ':')} • ${drive.label}`
  }
  else {
    return `${drive.name} • ${drive.mount}`
  }
}

function getDriveInfoSummary (drive, percentUsed) {
  const freeSize = utils.prettyBytes(drive.size.free, 1)
  const totalSize = utils.prettyBytes(drive.size.total, 1)
  const fsType = drive.fsType.toUpperCase()
  return `${freeSize} left of ${totalSize} • ${fsType}`
}

function getDriveInfoMiniSummary (drive) {
  const mount = drive.mount
  const freeSize = utils.prettyBytes(drive.size.free, 1)
  const totalSize = utils.prettyBytes(drive.size.total, 1)
  const fsType = drive.fsType.toUpperCase()
  return `${mount} • ${freeSize} left of ${totalSize} • ${fsType}`
}
