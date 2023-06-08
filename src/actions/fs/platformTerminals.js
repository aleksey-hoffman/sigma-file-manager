// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import sharedUtils from '@/utils/sharedUtils'

const {exec} = require('child_process')
const fs = require('fs')
const path = require('path')

const defaultShellOptions = [
  {
    title: 'Command Prompt',
  },
  {
    title: 'Windows Powershell',
  },
]

export const terminal = getTerminals()

export async function fetchInstalledTerminals (store) {
  const windowsTerminalIsInstalled = await isWindowsTerminalInstalled()
  const windowsTerminal = store.state.storageData.settings.terminal.terminalOptions.find(terminal => terminal.name === 'wt')
  if (windowsTerminalIsInstalled && windowsTerminal) {
    windowsTerminal.isInstalled = true
    windowsTerminal.shellOptions = await getInstalledWindowsTerminalShells(store, windowsTerminal)
  }
}

export async function getInstalledWindowsTerminalShells (store, windowsTerminal) {
  const localAppData = store.state.storageData.settings.appPaths.systemLocalAppData
  const stableWtSettingsPath = path.join(localAppData, 'Packages/Microsoft.WindowsTerminal_8wekyb3d8bbwe/LocalState/settings.json')
  const previewWtSettingsPath = path.join(localAppData, 'Packages/Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe/LocalState/settings.json')
  const unpackagedWtSettingsPath = path.join(localAppData, 'Microsoft/Windows Terminal/settings.json')
  const stableWtData = await readFile(stableWtSettingsPath)
  const previewWtData = await readFile(previewWtSettingsPath)
  const unpackagedWtData = await readFile(unpackagedWtSettingsPath)
  const shellData = stableWtData || previewWtData || unpackagedWtData
  if (!shellData) {
    return windowsTerminal.shellOptions
  }
  return shellData.map(item => ({title: item.name}))
}

export async function setSelectedTerminal (store, terminal) {
  store.dispatch('SET', {
    key: 'storageData.settings.terminal.selectedTerminal',
    value: terminal,
  })
}

export async function setSelectedShell (store, shell) {
  store.dispatch('SET', {
    key: 'storageData.settings.terminal.selectedTerminal.selectedShell',
    value: shell,
  })
}

export async function setSelectedAdminTerminal (store, terminal) {
  store.dispatch('SET', {
    key: 'storageData.settings.terminal.selectedAdminTerminal',
    value: terminal,
  })
}

export async function setSelectedAdminShell (store, shell) {
  store.dispatch('SET', {
    key: 'storageData.settings.terminal.selectedAdminTerminal.selectedAdminShell',
    value: shell,
  })
}

export function isWindowsTerminalInstalled () {
  return new Promise((resolve, reject) => {
    exec('where wt', (error, stdout, stderr) => {
      if (error) {
        if (error.code === 1) {
          resolve(false)
        }
        else {
          reject(error)
        }
      }
      else {
        resolve(true)
      }
    })
  })
}

export function getTerminals () {
  if (sharedUtils.platform === 'win32') {
    return getAvailableWin32Terminals()
  }
  else {
    return null
  }
}

function getAvailableWin32Terminals () {
  return {
    selectedTerminal: {
      title: 'Windows Powershell',
      name: 'powershell',
      isInstalled: true,
    },
    selectedAdminTerminal: {
      title: 'Windows Powershell',
      name: 'powershell',
      isInstalled: true,
    },
    terminalOptions: [
      {
        title: 'Command prompt',
        name: 'cmd',
        isInstalled: true,
      },
      {
        title: 'Windows Powershell',
        name: 'powershell',
        isInstalled: true,
      },
      {
        title: 'Windows Terminal',
        name: 'wt',
        isInstalled: null,
        selectedShell: {
          title: 'Windows Powershell',
        },
        selectedAdminShell: {
          title: 'Windows Powershell',
        },
        shellOptions: defaultShellOptions,
      },
    ],
  }
}

async function readFile (path) {
  try {
    const fileData = await fs.promises.readFile(path, 'utf8')
    const settings = JSON.parse(fileData)
    const profiles = settings.profiles.list
    return profiles
  }
  catch (error) {
    return []
  }
}
