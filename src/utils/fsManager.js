// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 7 — read, write, execute
// 6 — read, write
// 5 — read, execute
// 4 — read
// 3 — write, execute
// 2 — write
// 1 — execute
// 0 — no permissions

const electron = require('electron')
const fs = require('fs')
const fsExtra = require('fs-extra')
const PATH = require('path')
const childProcess = require('child_process')
const CLI = require('../processes/reusableCli.js')
const reusableCli = new CLI()

const state = {
  cliProcess: null
}
const SID = {
  everyone: '*S-1-1-0'
}

async function trashFSItems (params) {
  return new Promise((resolve, reject) => {
    electron.ipcRenderer.send('compute-request:trashDirItems', {items: params.items})
    electron.ipcRenderer.once('compute-request-reply:trashDirItems', (event, data) => {
      resolve({
        removedItems: data.trashedItems,
        notRemovedItems: data.notTrashedItems
      })
    })
  })
}

async function deleteFSItems (params) {
  async function initResolveRemove () {
    const results = []
    for (const item of params.items) {
      const path = PATH.normalize(item.path)
      let resolveResults = await resolveRemove(path)
      results.push(resolveResults)
    }
    return results
  }

  async function resolveRemove (path) {
    try {
      await fsExtra.remove(path)
      return {
        path,
        status: 'fulfilled'
      }
    }
    catch (error) {
      return {
        path,
        status: 'rejected',
        error
      }
    }
  }

  function getFilteredResults (results) {
    let removedItems = results
      .filter(item => item.status === 'fulfilled')
      .map(item => item.path.replace(/\\/g, '/'))
  
    let notRemovedItems = results
      .filter(item => item.status === 'rejected')
      .map(item => item.path.replace(/\\/g, '/')) 
  
    return {
      removedItems,
      notRemovedItems
    }
  }

  return getFilteredResults(await initResolveRemove()) 
}

// Note: exec only at one place so only 1 CLI is spawned
async function initCliProcess () {
  const params = {
    shell: '',
    args: [],
    options: {}
  }
  if (process.platform === 'win32') {
    // params.shell = 'powershell'
    params.shell = 'chcp 65001 >NUL & powershell.exe -NonInteractive -NoProfile -nologo -Command -'
    params.args = []
    params.options = { shell: true }
  }
  else if (process.platform === 'linux') {
    params.shell = '/bin/sh'
    params.args = []
  }
  else if (process.platform === 'darwin') {
    params.shell = '/bin/sh'
    params.args = []
  }
  
  reusableCli.init(
    params,
    (spawnedCliProcess) => {
      state.cliProcess = spawnedCliProcess
      if (process.platform === 'win32') {
        setUTF8encoding()
      }
    }
  )
}

function getCommand (params) {
  if (process.platform === 'win32') {
    // Format path
    if (params.path) {
      params.path = params.path.replace(/\//g, '\\')
    }
    // Get command
    if (params.command === 'sudo') {
      return '-Verb RunAs'
    }
    if (params.command === 'set-utf-8-encoding') {
      return '[System.Console]::OutputEncoding = [System.Console]::InputEncoding = [System.Text.Encoding]::UTF8'
    }
    if (params.command === 'get-drive-info') {
      return [
        'get-ciminstance -ClassName Win32_LogicalDisk',
        '| convertTo-csv | convertFrom-csv | convertTo-json'
      ].join(' ')
    }
    if (params.command === 'get-extra-drive-info') {
      return `(Get-CimInstance Win32_Diskdrive -Filter "Partitions>0" | ForEach-Object {
        $disk = Get-CimInstance
          -ClassName MSFT_PhysicalDisk
          -Namespace root\\Microsoft\\Windows\\Storage
          -Filter "SerialNumber='$($_.SerialNumber.trim())'";
    
        foreach ($partition in $_ | Get-CimAssociatedInstance -ResultClassName Win32_DiskPartition) {
            foreach ($logicaldisk in $partition | Get-CimAssociatedInstance -ResultClassName Win32_LogicalDisk) {
                [PSCustomObject]@{
                    Disk          = $_.DeviceID;
                    DiskModel     = $_.Model;
                    DiskSize      = $_.Size;
                    HealthStatus  = $disk.HealthStatus;
                    BusType       = $disk.BusType;
                    DiskType      = $_.MediaType;
                    MediaType     = $disk.MediaType;
                    Partition     = $partition.Name;
                    PartitionSize = $partition.Size;
                    VolumeName    = $logicaldisk.VolumeName;
                    DriveLetter   = $logicaldisk.DeviceID;
                    VolumeSize    = $logicaldisk.Size;
                    FreeSpace     = $logicaldisk.FreeSpace;
                }
            }
          }
        }) | convertTo-csv | convertFrom-csv | convertTo-json
      `.replace(/\n/g, ' ')
    }
    // Note: all commands on win32 are executed with powershell.
    // it doesn't have support for operators like &&.
    if (params.command === 'reset') {
      // TODO: should it run the command as admin instead?
      // const closeTerminalAfterExec = '/c'
      // let sudoArg = getCommand({command: 'sudo'})
      // return `${sudoArg} '${closeTerminalAfterExec} icacls "${params.path}" /reset'`
      return `icacls "${params.path}" /reset`
    }
    else if (params.command === 'add-read-only') {
      return `attrib +r "${params.path}"`
    }
    else if (params.command === 'remove-read-only') {
      return `attrib -r "${params.path}"`
    }
    else if (params.command === 'get-owner') {
      return `(Get-Acl "${params.path}").owner`
    }
    else if (params.command === 'get-fs-attributes') {
      return `(Get-Item "${params.path}").Attributes`
    }
    else if (params.command === 'get-item-stats') {
      return `Get-Item -Path "${params.path}" | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    else if (params.command === 'get-item-children-stats') {
      return `Get-ChildItem -Path "${params.path}" | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    else if (params.command === 'get-files') {
      return `Get-ChildItem -Path "${params.path}" -File | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    else if (params.command === 'get-directories') {
      return `Get-ChildItem -Path "${params.path}" -Directory | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    else if (params.command === 'is-link') {
      return `@("HardLink", "SymbolicLink") -contains (Get-Item "${params.path}").LinkType`
    }
    else if (params.command === 'is-hardlink') {
      return `(Get-Item "${params.path}").LinkType -eq "HardLink"`
    }
    else if (params.command === 'is-symlink') {
      return `(Get-Item "${params.path}").LinkType -eq "SymbolicLink"`
    }
    else if (params.command === 'file-exists') {
      return `Test-Path -Path "${params.path}" -PathType Leaf`
    }
    else if (params.command === 'directory-exists') {
      return `Test-Path -Path "${params.path}" -PathType Container`
    }
    else if (params.command === 'add-immutable-state') {
      // TODO: should it run the command as admin instead?
      // let sudoArg = getCommand({command: 'sudo'})
      // return `${sudoArg} '/c icacls "${params.dirItem.path}" /deny "${SID.everyone}:(F)"'`
      return `icacls "${params.dirItem.path}" /deny "${SID.everyone}:(F)"`
    }
    else if (params.command === 'remove-immutable-state') {
      // TODO: should it run the command as admin instead?
      // let sudoArg = getCommand({command: 'sudo'})
      // return `${sudoArg} '/c icacls "${params.dirItem.path}" /grant "${SID.everyone}:(F)"'`
      return `icacls "${params.dirItem.path}" /grant "${SID.everyone}:(F)"`
    }
    else if (params.command === 'create-windows-link') {
      return [
        '$WshShell = New-Object -comObject WScript.Shell',
        `$Shortcut = $WshShell.CreateShortcut("${params.destPath}")`,
        `$Shortcut.TargetPath = "${params.srcPath}"`,
        '$Shortcut.Save()'
      ].join(';')
    }
    else if (params.command === 'create-link') {
      let argDirectory = params.isDirectory ? '/d' : ''
      let argLinkType = ''
      if (params.linkType === 'symlink') {argLinkType = ''}

      const commandArgs = [
        '/c',
        'mklink',
        `${argDirectory}`,
        `${argLinkType}`,
        `""${params.uniqueDestPath}""`,
        `""${params.srcPath}"" `
      ].filter(item => item !== '')

      const innerCommand = `"${commandArgs.join(' ')}"`
      const command = [
        '-command', 
        'Start-Process cmd', 
        innerCommand, 
        '-Verb RunAs'
      ]
      return command
    }
  }
  else if (process.platform === 'linux') {
    if (params.command === 'sudo') {
      if (params.adminPrompt === 'built-in') {
        // return `echo -e "${params.sudoPassword}\n" | sudo -S`
        return `echo ${params.sudoPassword} | sudo -S`
      }
      else if (params.adminPrompt === 'pkexec') {
        return 'pkexec'
      }
    }
    if (params.command === 'reset') {
      return ''
    }
    else if (params.command === 'add-read-only') {
      return ''
    }
    else if (params.command === 'remove-read-only') {
      return ''
    }
    else if (params.command === 'get-owner') {
      return ''
    }
    else if (params.command === 'is-link') {
      return ''
    }
    else if (params.command === 'is-hardlink') {
      return ''
    }
    else if (params.command === 'is-symlink') {
      return ''
    }
    else if (params.command === 'file-exists') {
      return ''
    }
    else if (params.command === 'directory-exists') {
      return ''
    }
    else if (params.command === 'add-immutable-state') {
      const resetSudoPassword = params.resetSudoPassword
        ? '&& sudo -k'
        : ''
      const sudoArg = getCommand({ ...params, command: 'sudo' })
      return `${sudoArg} chattr +i "${params.dirItem.path}" ${resetSudoPassword}`
    }
    else if (params.command === 'remove-immutable-state') {
      const resetSudoPassword = params.resetSudoPassword
        ? '&& sudo -k'
        : ''
      const sudoArg = getCommand({ ...params, command: 'sudo' })
      return `${sudoArg} chattr -i "${params.dirItem.path}" ${resetSudoPassword}`
    }
    else if (params.command === 'create-link') {
      let argLinkType = ''
      if (params.linkType === 'hard-link') {argLinkType = ''}
      if (params.linkType === 'symlink') {argLinkType = '-s'}
      const commandArgs = [
        'sudo', 
        'ln', 
        argLinkType, 
        params.srcPath, 
        params.uniqueDestPath
      ].filter(item => item !== '')
      return commandArgs
    }
  }
}

/**
* @param {string} params.command
* @returns {boolean}
*/
async function execCommand (params) {
  return new Promise((resolve, reject) => {
    reusableCli.exec({
      process: state.cliProcess,
      command: params.command,
      onFinish: (result) => resolve(result)
    })
  })
}

/**
* @returns void
*/
async function setUTF8encoding () {
  execCommand({
    command: getCommand({command: 'set-utf-8-encoding'})
  })
}

/**
* @returns {array}
*/
async function getDriveInfo () {
  try {
    let data = await execCommand({
      command: getCommand({command: 'get-drive-info'})
    })
    return parseJSONStringArray(data)
  }
  catch (error) {
    return []
  }
}

/**
* @returns {array}
*/
async function getExtraDriveInfo () {
  try {
    let data = await execCommand({
      command: getCommand({command: 'get-extra-drive-info'})
    })
    return parseJSONStringArray(data)
  }
  catch (error) {
    return []
  }
}

/**
* @param {string[]} data
* @returns {array}
*/
function parseJSONStringArray (data) {
  try {
    let dataFormatted = JSON.parse(data.join(''))
    return Array.isArray(dataFormatted)
      ? dataFormatted
      : [dataFormatted]
  }
  catch (error) {
    return []
  }
}

/**
* @param {string} params.path
* @returns void
*/
async function resetPermissions (params) {
  if (!params.path) { throw Error('resetPermissions: path is not defined') }
  execCommand({
    command: getCommand({ ...params, command: 'reset' })
  })
}

/**
* @param {string} params.path
* @returns void
*/
async function getType (params) {
  const typeIsHardlink = await isHardlink(params)
  const typeIsSymlink = await isSymlink(params)
  const typeIsFile = await isFile(params)
  if (typeIsFile) {
    if (typeIsSymlink) {
      return 'file-symlink'
    }
    else if (typeIsHardlink) {
      return 'file-hardlink'
    }
    else {
      return 'file'
    }
  }
  else {
    if (typeIsSymlink) {
      return 'directory-symlink'
    }
    else if (typeIsHardlink) {
      return 'directory-hardlink'
    }
    else {
      return 'directory'
    }
  }
}

/**
* @param {string} params.path
* @returns {string}
*/
async function getFSAttributes (params) {
  try {
    let data = await execCommand({
      command: getCommand({
        path: params.path,
        command: 'get-fs-attributes'
      })
    })
    return data[0].split(',').map(item => item.trim())
  }
  catch (error) {
    return []
  }
}

/** This command uses a system command to get dir info.
* Unlike Node, it can read immutable and readonly files.
* @param {string} params.path
* @returns {boolean}
*/
async function getItemStats (params) {
  const dirStats = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'get-item-stats'
    }),
    ...params
  })
  return JSON.parse(dirStats.join(''))
}

/** This command uses a system command to get dir info.
* Unlike Node, it can read immutable and readonly files.
* it's also faster than making many separate system calls
* for every dir item (e.g. to get item type)
* @param {string} params.path type: directory
* @returns {boolean}
*/
async function getItemChildrenStats (params) {
  const dirStats = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'get-item-children-stats'
    }),
    ...params
  })
  return JSON.parse(dirStats.join(''))
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function getFiles (params) {
  const dirFileItems = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'get-files'
    }),
    ...params
  })
  return JSON.parse(dirFileItems.join(''))
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function getDirectories (params) {
  const dirDirectoryItems = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'get-directories'
    }),
    ...params
  })
  return JSON.parse(dirDirectoryItems.join(''))
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function isHardlink (params) {
  const typeIsHardlink = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'is-hardlink'
    }),
    ...params
  })
  return typeIsHardlink[0] === 'True'
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function isSymlink (params) {
  const typeIsSymlink = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'is-symlink'
    }),
    ...params
  })
  return typeIsSymlink[0] === 'True'
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function isFile (params) {
  const typeIsFile = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'file-exists'
    }),
    ...params
  })
  return typeIsFile[0] === 'True'
}

/**
* @param {string} params.path
* @returns {boolean}
*/
async function isDirectory (params) {
  const typeIsDirectory = await execCommand({
    command: getCommand({
      path: params.path,
      command: 'directory-exists'
    }),
    ...params
  })
  return typeIsDirectory[0] === 'True'
}

/**
* @param {object} params.dirItem
* @returns {boolean}
*/
async function getDirItemOwner (params) {
  const owner = await execCommand({
    command: getCommand({
      path: params.dirItem.path,
      command: 'get-owner'
    }),
    ...params
  })
  return owner[0]
}

function getDirItemGroups (params) {
}

function getFileSystemGroups (params) {
}

/**
* @param {object} params.dirItem
* @returns {boolean}
*/
async function isDirItemImmutable (params) {
  return new Promise((resolve, reject) => {
    let command
    if (process.platform === 'win32') {
      // Converting to CSV before JSON to preserve
      // readable format for FileSystemRights values
      command = `(Get-Acl "${params.dirItem.path}").access | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    reusableCli.exec({
      process: state.cliProcess,
      command,
      onFinish: (result) => {
        try {
          const parsedResult = JSON.parse(result.join(''))
          const hasFullControlAttributeDenied = parsedResult.some(item => {
            return item.FileSystemRights === 'FullControl' &&
              item.AccessControlType === 'Deny'
          })
          const isImmutable = hasFullControlAttributeDenied
          resolve(isImmutable)
        }
        catch (error) {
          reject()
        }
      }
    })
  })
}

/**
* @param {object} params.dirItem
* @returns {boolean}
*/
async function getDirItemUsers (params) {
  return new Promise((resolve, reject) => {
    let command
    if (process.platform === 'win32') {
      // Converting to CSV before JSON to preserve
      // readable format for FileSystemRights values
      command = `(Get-Acl "${params.dirItem.path}").access | ConvertTo-Csv | ConvertFrom-Csv | ConvertTo-Json`
    }
    reusableCli.exec({
      process: state.cliProcess,
      command,
      onFinish: (result) => {
        const parsedResult = JSON.parse(result.join(''))
        const users = parsedResult.map(item => {
          const splitPath = item.IdentityReference.split('\\')
          const user = splitPath[splitPath.length - 1]
          return {
            uid: null,
            text: user
          }
        })
        resolve(users)
      }
    })
  })
}

/**
* @param {object} params.dirItem
* @param {boolean} params.value
* @param {string} params.adminPrompt
* @param {string} params.sudoPassword
* @returns {boolean}
*/
async function setDirItemImmutableState (params) {
  return await execCommand({
    command: getCommand({
      ...params,
      command: params.value ? 'add-immutable-state' : 'remove-immutable-state'
    })
  })
}

function changeMode (params) {
  const isDir = fs.statSync(params.path).isDirectory()
  if (process.platform === 'win32') {
    const command = `icacls "${params.path}" /deny *S-1-1-0:(F)`
    childProcess.exec(command)
  }
  else if (process.platform === 'darwin') {
    const command = `0o${params.permissions.owner}${params.permissions.group}${params.permissions.others}`
    fs.promises.chmod(params.path, command)
  }
  else if (process.platform === 'linux') {
    const command = `0o${params.permissions.owner}${params.permissions.group}${params.permissions.others}`
    fs.promises.chmod(params.path, command)
  }
}

export {
  trashFSItems,
  deleteFSItems,
  initCliProcess,
  changeMode,
  getDriveInfo,
  getExtraDriveInfo,
  resetPermissions,
  getDirItemOwner,
  isDirItemImmutable,
  getDirItemUsers,
  setDirItemImmutableState,
  getItemStats,
  getItemChildrenStats,
  isFile,
  isDirectory,
  getType,
  getFSAttributes,
  getCommand
}
