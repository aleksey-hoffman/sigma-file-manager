// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// TODO: (?) Move to the main process

import utils from './utils'
import * as fsManager from './fsManager.js'

const PATH = require('path')
const sysInfo = require('systeminformation')
const diskusage = require('diskusage')

let state = {
  extraDeviceData: [],
  driveList: [],
  previousDriveList: [],
  driveTypes: {
    '1': '',
    '2': 'removable',
    '3': 'fixed',
    '4': 'network',
    '5': 'cd',
    '6': 'RAM'
  },
  driveMemoryTypes: {
    '1': '',
    '3': 'HDD',
    '4': 'SSD',
    '5': 'SCM'
  }
}

export async function getStorageDevices () {
  try {
    let blockDevices = await getBlockDevices()
    let storageDevices = [
      ...blockDevices, 
    ]
    state.previousDriveList = [...state.driveList]
    state.driveList = blockDevices
    handleDriveListChange()
    return storageDevices
  } 
  catch (error) {
    console.error(error)
    return []
  }
}

function handleDriveListChange () {
  let driveListChanged = state.previousDriveList.length !== state.driveList.length
  if (driveListChanged) {
    fetchBlockDevicesExtraData()
  }
}

export async function fetchBlockDevicesExtraData () {
  try {
    getBlockDevicesExtraData()
      .then((data) => {
        const extraDeviceDataFormatted = data
          .map(drive => {
            drive.MediaType = state.driveMemoryTypes[drive.MediaType]
            return drive
          })
        state.extraDeviceData = extraDeviceDataFormatted
      })
  }
  catch (error) {}
}

export async function getBlockDevicesExtraData () {
  return new Promise((resolve, reject) => {
    if (process.platform === 'win32') {
      fsManager.getExtraDriveInfo().then((data) => resolve(data))
    }
    else {
      return [] 
    }
  })
}

async function getBlockDevicesData () {
  try {
    if (process.platform === 'win32') {
      return await fsManager.getDriveInfo()
    }
    else if (process.platform === 'linux') {
      return await sysInfo.blockDevices()
    }
    else if (process.platform === 'darwin') {
      return await sysInfo.blockDevices()
    }  
  }
  catch (error) {
    return []
  }
}

async function getBlockDevices () {
  let blockDevices = await getBlockDevicesData()
  blockDevices = formatBlockDevicesProperties(blockDevices)
  blockDevices = formatDrivesData(blockDevices)
  blockDevices = processDrivesData(blockDevices)
  blockDevices = await addPropertiesToDrivesData(blockDevices)
  return blockDevices
}

function formatBlockDevicesProperties (blockDevices) {
  if (process.platform === 'win32') {
    blockDevices.forEach(device => {
      device.mount = device.Caption
      device.path = device.Caption
      device.name = device.Caption
      device.label = device.ProviderName ? device.ProviderName : device.VolumeName
      device.fsType = device.FileSystem
      device.type = getDriveType(device)
      device.memoryType = getDriveMemoryType(device)
    })
  }
  else if (process.platform === 'linux') {
    blockDevices.forEach(device => {
      device.type = getDriveType(device)
    })
  }
  else if (process.platform === 'darwin') {
    blockDevices.forEach(device => {
      device.type = getDriveType(device)
    })
  }
  return blockDevices
}

function getDriveType (device) {
  if (process.platform === 'win32') {
    return state.driveTypes[device.driveType] || ''
  }
  else if (process.platform === 'linux') {
    if (device.removable  && device.type === 'rom') {
      return 'rom'
    }
    else {
      return device.removable ? 'removable' : device.type
    }
  }
  else if (process.platform === 'darwin') {
    if (device.removable  && device.type === 'rom') {
      return 'rom'
    }
    else {
      return device.removable ? 'removable' : device.type
    }
  }
  else {
    return ''
  }
}

function getDriveMemoryType (device) {
  if (process.platform === 'win32') {
    let extraData = state.extraDeviceData.find(drive => drive.DriveLetter === device.Caption)
    if (extraData) {
      return extraData.MediaType
    }
    else {
      return ''
    }
  }
  else {
    return ''
  }
}

async function addPropertiesToDrivesData (drives) {
  for (let index = 0; index < drives.length; index++) {
    const drive = drives[index]
    let size = {available: 0, free: 0, total: 0}
    let percentUsed = 0

    try {
      size = await diskusage.check(drive.mount)
      percentUsed = Math.floor((1 - (size.free / size.total)) * 100) || 0
    }
    catch (error) {}

    drive.size = size
    drive.path = drive.mount
    drive.percentUsed = percentUsed
    drive.titleSummary = getDriveTitleSummary(drive)
    drive.infoSummary = getDriveInfoSummary(drive, percentUsed)
    drive.infoMiniSummary = getDriveInfoMiniSummary(drive)
  }
  return drives
}

function processDrivesData (drives) {
  if (process.platform === 'win32') {
    drives = drives.filter(drive => {
      return drive.fsType !== ''
    })
  }
  else if (process.platform === 'linux') {
    drives = drives.filter(drive => {
      const incudesAllowedTypes = ['disk', 'part', 'rom', 'removable'].includes(drive.type)
      const includesDisallowedMounts = ['/boot/efi/'].includes(drive.mount)
      const isSwap = drive.fsType === 'swap'
      return drive.fsType !== '' && incudesAllowedTypes && !includesDisallowedMounts && !isSwap
    })
  }
  else if (process.platform === 'darwin') {
    drives = drives.filter(drive => {
      const disallowedMountEntryPoints = ['/System']
      const isRootEntryPoint = drive.mount === '/'
      const isDisallowedEntryPoint = disallowedMountEntryPoints.some(entryPoint => drive.mount.startsWith(entryPoint))
      return drive.fsType !== '' && !isDisallowedEntryPoint && !isRootEntryPoint
    })
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
    let mount = drive.mount.replace(':/', ':')
    if (drive.memoryType)  {
      return `${mount} • ${drive.label} • ${drive.memoryType}`
    }
    else {
      return `${mount} • ${drive.label}`
    }
  }
  else {
    if (drive.label) {
      return `${drive.label}`
    }
    else {
      return `${drive.mount}`
    }
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
