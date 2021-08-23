// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// GLOBAL NOTES | DEVELOPMENT:
// - Import js files carefully:
//   - If a worker imports a file which include 'document' object, it will break the worker
//   - Avoid circular imports (e.g. import store.js, which imports util.js, into utils.js...)
// - Vue:
//   - Do not reference periodically updated variables, such as "drives", in the <template> of
//   bigger components, they will cause re-render of the whole component.
//   Move them to their own separate child components.

'use strict'

const createProtocol = require('vue-cli-plugin-electron-builder/lib').createProtocol
const electron = require('electron')
const PATH = require('path')
const downloadManager = require('./utils/downloadManager')
const SigmaAppUpdater = require('./utils/sigmaAppUpdater.js')
const StorageReader = require('./utils/storageReader.js')
const externalLinks = require('./utils/externalLinks.js')
const appVersion = electron.app.getVersion()
const appUpdater = new SigmaAppUpdater()
const storageReader = new StorageReader()

// TODO: remove '@electron/remote' module and migrate to ipcRenderer.invoke
require('@electron/remote/main').initialize()

global.mainProcessProps = {
  safeFileProtocolName: 'sigma-file-manager',
  env: process.env
}

// Keep global references to prevent garbage collection
const singleAppInstance = electron.app.requestSingleInstanceLock()
const windows = {
  main: null,
  hiddenGame: null,
  errorWindow: null,
  trashManager: null,
  quickViewWindow: null
}
const globalShortcuts = {}
let storageData
let tray

// Scheme must be registered before the app is ready
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true // needed for loading WASM modules
    }
  }
])

lockSingleAppInstance()
setAppProperties()
initIPCListeners()
initAppListeners()

function lockSingleAppInstance () {
  if (!singleAppInstance && process.env.NODE_ENV === 'production') {
    electron.app.quit()
  } 
  else {
    electron.app.on('second-instance', (event, commandLine, workingDirectory) => {
      if (windows.main) {
        if (windows.main.isMinimized()) {
          windows.main.restore()
        }
        windows.main.focus()
      }
    })
  }
}

function setAppProperties () {
  // Temporary disable until native modules like 'node-diskusage'
  // are updated (to become context-aware or loaded via N-API)
  electron.app.allowRendererProcessReuse = false
  electron.app.setAppUserModelId('com.alekseyhoffman.sigma-file-manager')
}

function setCustomizedAppProperties (params) {
  electron.app.setLoginItemSettings({
    openAtLogin: params.openAtLogin
  })
}

function createMainWindow () {
  windows.main = new electron.BrowserWindow({
    title: 'Sigma file manager',
    icon: PATH.join(__static, '/icons/logo-1024x1024.png'),
    show: !storageData['storageData.settings.appProperties.openAsHidden'],
    width: 1280,
    height: 720,
    minWidth: 500,
    minHeight: 300,
    frame: false,
    transparent: false,
    webviewTag: true,
    webPreferences: {
      enableRemoteModule: true,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegrationInWorker: true
    }
  })
  // TODO: report Electron bug:
  // Note: execution order is important
  // DevTools has to be loaded before loading window url or after with a delay
  // Otherwise the main window will halt during loading
  openMainWindowDevTools()
  loadWindow('main')
  initWindowListeners('main')
}

function createQuickViewWindow () {
  // Create window
  windows.quickViewWindow = new electron.BrowserWindow({
    title: 'Sigma file manager | Quick view',
    icon: PATH.join(__static, '/icons/logo-1024x1024.png'),
    show: false,
    // Set content size to 16:9 ratio by default since it's the most common one.
    // Window dimensions are adjusted in the quickViewWindow.html, when the content is loaded 
    useContentSize: true,
    width: 1280,
    height: 720,
    minWidth: 300,
    minHeight: 200,
    webPreferences: {
      partition: 'quickView',
      webviewTag: true,
      enableRemoteModule: true,
      contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
      nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION
    }
  }) 
  loadWindow('quickViewWindow')
  initWindowListeners('quickViewWindow')
}

function createHiddenGameWindow () {
  // TODO:
  // The game will stop working in Chrome 91.
  // Console warning:
  // jumpingDinosaurGame-0.0.3.loader.js:5
  // [Deprecation] SharedArrayBuffer will require cross-origin isolation as of M91, around May 2021.
  // See https://developer.chrome.com/blog/enabling-shared-array-buffer/ for more details.
  // Will need to wait for Unity to fix this and then recompile the game.
  try { windows.hiddenGame.close() }
  catch (error) {}
  windows.hiddenGame = new electron.BrowserWindow({
    title: 'Sigma file manager',
    icon: PATH.join(__static, '/icons/logo-1024x1024.png'),
    width: 1300,
    height: 740,
    minWidth: 500,
    minHeight: 300,
    webPreferences: {
      sandbox: true
    }
  })
  loadWindow('hiddenGame')
  windows.hiddenGame.maximize()
}

function openMainWindowDevTools () {
  if (process.env.NODE_ENV === 'development' && !process.env.IS_TEST) {
    windows.main.webContents.openDevTools({ mode: 'undocked' })
  }
}

function loadWindow (windowName) {
  let developmentPath
  let productionPath
  let filePath
  // Set window URL
  if (windowName === 'main') {
    filePath = 'index.html'
  }
  else if (windowName === 'hiddenGame') {
    filePath = 'game/index.html'
  }
  else if (windowName === 'trashManager') {
    filePath = 'trashManagerWindow.html'
  }
  else if (windowName === 'errorWindow') {
    filePath = 'errorWindow.html'
  }
  else if (windowName === 'quickViewWindow') {
    filePath = 'quickViewWindow.html'
    developmentPath = `file://${__static}/quickViewWindow.html`
    productionPath = `file://${__static}/quickViewWindow.html`
  }
  // Get window URL
  if (!developmentPath) {
    developmentPath = `${process.env.WEBPACK_DEV_SERVER_URL}${filePath}`
  }
  if (!productionPath) {
    productionPath = `app://./${filePath}`
  }
  // Load window URL
  if (process.env.WEBPACK_DEV_SERVER_URL) {
    windows[windowName].loadURL(developmentPath)
  }
  else {
    // Load protocol
    if (windowName === 'main') {
      createProtocol('app')
    }
    windows[windowName].loadURL(productionPath)
  }
}

function initWindowListeners (name) {
  if (name === 'main') {
    windows.main.on('focus', () => {
      windows.main.setSkipTaskbar(false)
      windows.main.webContents.send('window:focus')
    })
    windows.main.on('blur', () => {
      windows.main.webContents.send('window:blur')
    })
    windows.main.on('closed', () => {
      windows.main = null
    })
  }
  else if (name === 'quickViewWindow') {
    // Init listeners
    // Note: this listener is used to detect unsupported by Chromium files that cannot be displayed.
    // Unsupported files trigger will-download event.
    windows.quickViewWindow.webContents.session.once('will-download', _willDownloadHandler)
    windows.quickViewWindow.once('close', () => {
      // Remove listener to avoid multiple listeners
      // Without it, a duplicate listener is created every time the windows is closed
      windows.quickViewWindow.webContents.session.removeListener('will-download', _willDownloadHandler)
    })
    windows.quickViewWindow.once('closed', () => {
      createQuickViewWindow()
    })
    function _willDownloadHandler (event, item, webContents) {
      event.preventDefault()
      const fileURL = item.getURL()
      windows.quickViewWindow.webContents.send('load:webview::cancel')
      windows.main.webContents.send('load:webview::failed', {path: fileURL})
      // Note: close the window even if file is not supported and window.show()
      // wasn't called, in order to reset the listeners. Otherwise, unsupported
      // files will break the window for all consecutive runs by throwing an error
      windows.quickViewWindow.close()
    }
  }
}

function createUtilWindow (fileName) {
  return new Promise((resolve, reject) => {
    if (fileName === 'trashManagerWindow') {
      windows.trashManager = new electron.BrowserWindow({
        width: 200,
        height: 200,
        show: false,
        webPreferences: {
          contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
          nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION
        }
      })
      loadWindow('trashManager')
      windows.trashManager.on('closed', () => {
        windows.trashManager = null
      })
      windows.trashManager.webContents.on('did-finish-load', () => {
        resolve()
      })
    }
    else if (fileName === 'errorWindow') {
      windows.errorWindow = new electron.BrowserWindow({
        width: 800,
        height: 500,
        webPreferences: {
          contextIsolation: !process.env.ELECTRON_NODE_INTEGRATION,
          nodeIntegration: process.env.ELECTRON_NODE_INTEGRATION
        }
      })
      loadWindow('errorWindow')
      windows.errorWindow.on('closed', () => {
        windows.errorWindow = null
      })
      windows.errorWindow.webContents.on('did-finish-load', () => {
        resolve()
      })
    }
  })
}

function initIPCListeners () {
  electron.ipcMain.on('compute-request:trashDirItems', (event, payload) => {
    if (payload.items.length === 0) {
      throw Error(`
        electron.ipcMain.on('compute-request:trashDirItems')::
        payload.items should contain more than 0 paths
      `)
    }
    else {
      createUtilWindow('trashManagerWindow')
        .then(() => {
          windows.trashManager.webContents
            .send('compute:trashDirItems', payload.items)
        })
    }
  })

  electron.ipcMain.on('show:errorWindow', (event, payload) => {
    createUtilWindow('errorWindow')
      .then(() => {
        payload.githubIssuesLink = externalLinks.githubIssuesLink
        windows.errorWindow.webContents
          .send('data:errorWindow', payload)
        windows.errorWindow.focus()
      })
  })

  electron.ipcMain.on('compute-reply:trashDirItems', (event, data) => {
    windows.main.webContents
      .send('compute-request-reply:trashDirItems', data)
    if (windows.trashManager) {
      windows.trashManager.close()
    }
  })

  electron.ipcMain.on('download-file', async (event, params) => {
    downloadFile({ event, params })
  })

  electron.ipcMain.on('download-file:resume', (event, payload) => {
    downloadManager.resume(payload.hashID)
  })

  electron.ipcMain.on('download-file:pause', (event, payload) => {
    downloadManager.pause(payload.hashID)
  })

  electron.ipcMain.on('download-file:cancel', (event, payload) => {
    downloadManager.cancel(payload.hashID)
  })

  electron.ipcMain.on('focus-main-app-window', (event) => {
    global.focusApp({ type: 'code' })
  })

  electron.ipcMain.on('toggle-main-app-window', (event) => {
    global.toggleApp({ type: 'code' })
  })

  electron.ipcMain.on('handle:close-app', (event, action) => {
    if (action === 'minimizeAppToTray') {
      windows.main.setSkipTaskbar(true)
      // Note: blur the window before hiding it
      // so it can be toggled right after being hidden
      // (before user focuses another app)
      windows.main.blur()
      windows.main.hide()
    }
    if (action === 'closeMainWindow') {
      windows.main.close()
    }
    if (action === 'closeApp') {
      windows.main.close()
      electron.app.quit()
    }
  })

  electron.ipcMain.on('set-global-shortcut', (event, data) => {
    const shortcut = data.shortcut.replace(/\s/g, '')
    const previousShortcut = data.previousShortcut.replace(/\s/g, '')
    // Un-register current global shortcut
    if (electron.globalShortcut.isRegistered(previousShortcut)) {
      electron.globalShortcut.unregister(previousShortcut)
    }
    const shortcutWasSet = electron.globalShortcut.register(shortcut, () => {
      // runShortcutHandler(data.name)
      global[data.name]()
    })
    event.sender.send('set-global-shortcut-reply', { success: shortcutWasSet })
    // Update globalShortcuts
    globalShortcuts[data.name] = {
      shortcut: data.shortcut
    }
    // Update global shortcuts in tray menu
    createTrayMenu()
  })

  electron.ipcMain.on('window:drag-out', (event, paths) => {
    if (Array.isArray(paths) && paths.length > 0) {
      // Remove duplicates
      paths = [...new Set(paths)]
      // Handle path outbound drag
      event.sender.startDrag({
        files: paths,
        icon: PATH.join(__static, '/icons/copy-32x32.png')
      })
    }
  })

  electron.ipcMain.on('open-hidden-game', (event) => {
    createHiddenGameWindow()
  })

  electron.ipcMain.on('quick-view::open-file', (event, path) => {
    openFileInQuickViewWindow(path)
  })
}

function registerSafeFileProtocol () {
  electron.protocol.registerFileProtocol(global.mainProcessProps.safeFileProtocolName, (request, callback) => {
    const url = request.url
      .replace(`${global.mainProcessProps.safeFileProtocolName}://`, '')
      .replace(/(.*)(#t=.*)/, '$1') // remove "#t=*" query at the end (used in video paths)
    try {
      return callback(decodeURIComponent(url))
    }
    catch (error) {
      console.error(error)
    }
  })
}

async function fetchAppStorageData () {
  return await storageReader.get('settings.json')
}

async function initAppUpdater () {
  if ([true, undefined].includes(storageData['storageData.settings.appUpdates.autoCheck'])) {
    await checkAppUpdates()
  }
}

async function checkAppUpdates () {
  appUpdater.init({
    repo: externalLinks.githubRepo,
    currentVersion: appVersion,
    onUpdateAvailable: (payload) => {
      showNativeNotificationUpdateAvailable(payload)
      handleAutoUpdate(payload)
    }
  })
}

function showNativeNotificationUpdateAvailable (payload) {
  const notificationParams = {
    title: 'Update available',
    body: `Sigma File Manager v${payload.latestVersion}`
  }
  const updateNotification = new electron.Notification(notificationParams)
  updateNotification.on('click', () => {
    global.focusApp()
  })
  updateNotification.show()
}

async function handleAutoUpdate (payload) {
  const autoDownload = [true, undefined].includes(storageData['storageData.settings.appUpdates.autoDownload'])
  const autoInstall = [true, undefined].includes(storageData['storageData.settings.appUpdates.autoInstall'])
  if (autoDownload) {
    if (autoInstall) {
      payload.autoInstall = true
      initUpdateAction({
        payload, 
        action: 'DOWNLOAD_APP_UPDATE'
      })
    }
    else {
      initUpdateAction({
        payload, 
        action: 'DOWNLOAD_APP_UPDATE'
      })
    }
  }
  else {
    initUpdateAction({
      payload, 
      action: 'HANDLE_APP_UPDATE_AVAILABLE'
    })
  }
}

async function initUpdateAction (params) {
  // Delay to make sure App.vue is loaded
  setTimeout(() => {
    windows.main.webContents.send('store:action', {
      action: params.action,
      params: params.payload
    })
  }, 5000)
}

function openFileInQuickViewWindow (path) {
  function _load () {
    windows.quickViewWindow.webContents.send('load:webview', {path})
  }
  if (!windows.quickViewWindow) {
    createQuickViewWindow() 
    windows.quickViewWindow.webContents.once('did-finish-load', () => {
      _load()
    })
  }
  else {
    _load()
  }
}

async function downloadFile (payload) {
  const resultInfo = await downloadManager.download(windows.main, {
    ...payload.params,
    onProgress: (progress) => {
      payload.event.sender.send('download-file-progress', progress)
    },
    onCancel: (progress) => {
      // payload.event.sender.send('download-file-progress', progress)
    },
    onError: (error) => {
      throw Error(error)
    }
  })
  payload.event.sender.send('download-file-done', resultInfo)
}

function createTrayMenu () {
  if (tray) {
    tray.destroy()
  }
  // Set tray icon
  const trayIcon = process.platform === 'darwin'
    ? 'logo-20x20.png'
    : 'logo-32x32.png'
  tray = new electron.Tray(PATH.join(__static, 'icons', trayIcon))
  const contextMenu = electron.Menu.buildFromTemplate([
    {
      label: `Sigma file manager v${appVersion}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Open the app window',
      accelerator: globalShortcuts.toggleApp
        ? globalShortcuts.toggleApp.shortcut
        : '',
      click: () => global.focusApp()
    },
    {
      label: 'Reload the app window',
      accelerator: 'Ctrl + Shift + R',
      click: () => windows.main.reload()
    },
    {
      label: 'Close the app',
      click: () => electron.app.quit()
    },
    { type: 'separator' },
    {
      label: 'Global shortcuts',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Create new note',
      accelerator: globalShortcuts.newNote
        ? globalShortcuts.newNote.shortcut
        : '',
      click: () => newNote()
    },
    { type: 'separator' },
    {
      label: 'Support the app and get rewards',
      click: () => electron.shell.openExternal(externalLinks.githubReadmeSupportSectionLink)
    }
  ])
  tray.setToolTip(`Sigma file manager v${appVersion}`)
  tray.setContextMenu(contextMenu)
  tray.on('click', () => {
    tray.popUpContextMenu()
  })
}

function disableAppMenu () {
  electron.Menu.setApplicationMenu(null)
  // Fix for:
  // Disabling app menu removes the shortcuts (accelerator) defined in the menu
  // Redefine shortcuts manually. Bind to the currently focused window:
  electron.app.on('web-contents-created', (webContentsCreatedEvent, webContents) => {
    webContents.on('before-input-event', (beforeInputEvent, input) => {
      const { code, alt, control, shift, meta } = input
      // Shortcut: devTools
      if (shift && control && !alt && !meta && code === 'KeyI') {
        electron.BrowserWindow.getFocusedWindow().webContents.toggleDevTools({ mode: 'detach' })
      }
      // Shortcut: window reload
      if (shift && control && !alt && !meta && code === 'KeyR') {
        electron.BrowserWindow.getFocusedWindow().reload()
      }
    })
  })
}

global.newNote = () => {
  global.focusApp()
  windows.main.webContents.send('open-new-note')
}

global.focusApp = (options = {}) => {
  // If window exists, focus it
  if (windows.main !== null) {
    // Notes:
    // - Using a workaround because of https://github.com/electron/electron/issues/2867
    //   When triggered programmatically (not from a global shortcut),
    //   the function windows.main.show() might not show the window by itself.
    // - Hide window (from taskbar) before focusing so that it doesn't switch to 
    //   another virtual screen if the app was opened there
    if (options.type === 'code') {
      windows.main.hide()
      setTimeout(() => {
        windows.main.setAlwaysOnTop(true)
        windows.main.show()
        windows.main.setAlwaysOnTop(false)
      }, 100)
    }
    else {
      windows.main.hide()
      setTimeout(() => {
        windows.main.show()
      }, 100)
    }
  }
  // If window doesn't exist, create it
  else {
    createMainWindow()
  }
}

global.toggleApp = (options) => {
  // If window exists, focus it
  if (windows.main !== null) {
    if (windows.main.isFocused()) {
      windows.main.minimize()
    }
    else {
      global.focusApp(options)
    }
  }
  // If window doesn't exist, create it
  else {
    createMainWindow()
  }
}

function getCustomizedAppProperties (storageData) {
  return {
    openAtLogin: storageData['storageData.settings.appProperties.openAtLogin'] ?? true
  }
}

function initAppListeners () {
  electron.app.on('render-process-gone', (event, webContents, details) => {
    windows.main.loadURL('app://./index.html')
    let payload = {
      title: 'An error occured in the main renderer process',
      error: details
    }
    createUtilWindow('errorWindow')
      .then(() => {
        payload.githubIssuesLink = externalLinks.githubIssuesLink
        windows.errorWindow.webContents
          .send('data:errorWindow', payload)
        windows.errorWindow.focus()
      })
  })

  electron.app.on('activate', () => {
    if (windows.main === null) {
      createMainWindow()
    }
  })

  electron.app.on('ready', async () => {
    // This method will be called when Electron has finished
    // initialization and is ready to create browser windows.
    // Some APIs can only be used after this event occurs.
    storageData = await fetchAppStorageData()
    setCustomizedAppProperties(getCustomizedAppProperties(storageData))
    disableAppMenu()
    registerSafeFileProtocol()
    createMainWindow()
    createTrayMenu()
    initAppUpdater()
    createQuickViewWindow()
  })

  electron.app.on('before-quit', () => {
    // Make sure all processes are terminated
    // Otherwise some keep running on app.quit()
    for (let window in windows) {
      windows[window] = null
    }
    if (tray !== null) {
      tray.destroy()
    }
  })

  electron.app.on('will-quit', () => {
    electron.globalShortcut.unregisterAll()
    if (tray !== null) {
      tray.destroy()
    }
  })

  electron.app.on('window-all-closed', event => {
    // Do not quit the app when all windows are closed
    event.preventDefault()
  })

  electron.app.on('web-contents-created', (event, contents) => {
    // Handle security
    // https://www.electronjs.org/docs/tutorial/security#12-disable-or-limit-navigation
    // Disable navigation to all external URLs
    contents.on('will-navigate', (event, navigationUrl) => {
      event.preventDefault()
    })
    // Disable or limit creation of new windows
    contents.on('new-window', async (event, navigationUrl) => {
      const trustedUrls = [
        'devtools://devtools/bundled/toolbox.html'
      ]
      const urlIsTrusted = trustedUrls.some(link => navigationUrl.startsWith(link))
      if (!urlIsTrusted) {
        event.preventDefault()
        await electron.shell.openExternal(navigationUrl)
      }
    })
  })
}

// Exit cleanly on request from parent process in development mode.
if (process.env.NODE_ENV === 'development') {
  if (process.platform === 'win32') {
    process.on('message', data => {
      if (data === 'graceful-exit') {
        electron.app.quit()
      }
    })
  }
  else {
    process.on('SIGTERM', () => {
      electron.app.quit()
    })
  }
}
