<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-app :data-theme-type="themeType">
    <!-- global-components -->
    <window-toolbar/>
    <action-toolbar/>
    <navigation-panel/>
    <notification-manager/>
    <overlays/>
    <clipboard-toolbar/>
    <dialogs v-if="appIsLoaded"/>

    <!-- app-content-area -->
    <v-main class="app-content">
      <transition
        name="route-transition"
        mode="out-in"
      >
        <keep-alive :include="['home']">
          <router-view/>
        </keep-alive>
      </transition>
    </v-main>
  </v-app>
</template>

<script>
console.time('time::App.vue::Imports')
import { mapGetters } from 'vuex'
import { mapFields } from 'vuex-map-fields'
import { Walk } from './utils/driveWalker.js'
import GlobalSearchWorker from 'worker-loader!./workers/globalSearchWorker.js'
import DirWatcherWorker from 'worker-loader!./workers/dirWatcherWorker.js'
import TimeUtils from './utils/timeUtils.js'
import getStorageDevices from './utils/storageInfo.js'
import idleJs from 'idle-js'
const electron = require('electron')
const PATH = require('path')
const fs = require('fs')
const mousetrap = require('mousetrap')
const diskusage = require('diskusage')
const sysInfo = require('systeminformation')
const getDirSize = require('trammel')
const fileUpload = require('express-fileupload')
const serveIndex = require('serve-index')
const getPort = require('get-port')
const net = require('net')
const qrCode = require('qrcode')
const childProcess = require('child_process')
const zlib = require('zlib')
const node7z = require('node-7z')
let express
let expressServer
console.timeEnd('time::App.vue::Imports')

export default {
  name: 'App',
  watch: {
    $route (to, from) {
      this.contextMenus.dirItem.value = false
      this.$store.dispatch('TERMINATE_ALL_FETCH_DIR_SIZE')
      if (to.name === 'home') {
        this.animateHomeBanner({ delay: true })
      }
    },
    drives (value) {
      this.handleConnectedDriveActions(value)
    },
    'contextMenus.dirItem.value' (value) {
      if (value) {
        this.$store.dispatch('INIT_FETCH_CONTEXT_MENU_TARGET_ITEMS', { type: 'dirItem' })
      }
    },
    selectedDirItems (value) {
      if (value.length === 0) {
        this.$store.dispatch('HANDLE_NO_DIR_ITEMS_SELECTED')
      }
    },
    'inputState.shift' (value) {
      if (!value) {
        this.$store.dispatch('DEHIGHLIGHT_ALL_DIR_ITEMS')
      }
    }
  },
  created () {
    this.$store.dispatch('CLONE_STATE')
    this.$store.dispatch('ADD_ACTION_TO_HISTORY', { action: 'App.vue::created()' })
    this.initWindowErrorHandler()
    this.initWindowResizeListener()
    this.extractAppBinaries()
  },
  async mounted () {
    this.$store.dispatch('ADD_ACTION_TO_HISTORY', { action: 'App.vue::mounted()' })
    try {
      await this.initMediaDirectories()
      await this.initAllStorageFiles()
      await this.fetchStorageDevices()
      this.handleFirstAppLaunch()
      this.initIPCListeners()
      this.setUIzoom()
      this.setWindowSize()
      this.bindKeyEvents()
      this.initGlobalSearchDataFiles()
      this.initGlobalSearchDataWatcher()
      this.initStorageDevicesWatcher()
      this.initAppStatusWatcher()
      this.initGlobalShortcuts()
      this.initIntervals()
      this.transitionOutLoadingScreen()
      this.removeLoadingScreen()
      this.checkForAppUpdateInstalled()
      this.initDirWatcherWorker()
      this.initEventHubListeners()
    }
    catch (error) {
      electron.ipcRenderer.send('show:errorWindow', {
        title: 'An error occured during loading',
        error
      })
      this.removeLoadingScreen()
    }
  },
  computed: {
    ...mapGetters([
      'uiState',
      'systemInfo',
      'selectedDirItems',
      'selectedDirItemsPaths',
      'selectedFilesPaths',
      'someDialogIsOpened',
      'selectedWorkspace',
      'computedShortcuts',
      'isCursorInsideATextField'
    ]),
    ...mapFields({
      appVersion: 'appVersion',
      appIsLoaded: 'appIsLoaded',
      appStatus: 'appStatus',
      inputState: 'inputState',
      contextMenus: 'contextMenus',
      dialogs: 'dialogs',
      appPaths: 'appPaths',
      detectedLocale: 'detectedLocale',
      currentDir: 'navigatorView.currentDir',
      navigatorRouteIsLoaded: 'navigatorRouteIsLoaded',
      navigationPanel: 'navigationPanel',
      appStorageGlobalSearchData: 'appPaths.storageDirectories.appStorageGlobalSearchData',
      globalSearchDataFiles: 'appPaths.globalSearchDataFiles',
      routeScrollPosition: 'routeScrollPosition',
      lastRecordedAppVersion: 'storageData.settings.lastRecordedAppVersion',
      shortcuts: 'storageData.settings.shortcuts',
      globalSearchScanDepth: 'storageData.settings.globalSearchScanDepth',
      globalSearchDisallowedPaths: 'storageData.settings.globalSearch.disallowedPaths',
      globalSearchCompressSearchData: 'storageData.settings.compressSearchData',
      isFirstAppLaunch: 'storageData.settings.isFirstAppLaunch',
      lastSearchScanTime: 'storageData.settings.time.lastSearchScan',
      globalSearchAutoScanIntervalTime: 'storageData.settings.globalSearchAutoScanIntervalTime',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
      thumbnailStorageLimit: 'storageData.settings.thumbnailStorageLimit',
      focusMainWindowOnDriveConnected: 'storageData.settings.focusMainWindowOnDriveConnected',
      timeSinceLoadDirItems: 'navigatorView.timeSinceLoadDirItems',
      history: 'navigatorView.history',
      globalSearchScanInProgress: 'globalSearch.scanInProgress',
      drives: 'drives',
      drivesPreviousData: 'drivesPreviousData',
      storageData: 'storageData',
      storageDataDirItemsTimeline: 'storageData.stats.dirItemsTimeline',
      storageDataNotes: 'storageData.notes',
      storageDataPinned: 'storageData.pinned',
      storageDataWorkspaces: 'storageData.workspaces',
      storageDataProtected: 'storageData.protected',
      storageDataStats: 'storageData.stats',
      storageDataSettings: 'storageData.settings',
      themeType: 'storageData.settings.theme.type',
      overlayInboundDrag: 'overlays.inboundDrag',
      targetItems: 'contextMenus.dirItem.targetItems',
      localServer: 'localServer',
      fileShareIp: 'localServer.fileShare.ip',
      fileSharePort: 'localServer.fileShare.port',
      fileShareServer: 'localServer.fileShare.server',
      fileShareType: 'localServer.fileShare.type',
      fileShareItems: 'localServer.fileShare.items',
      directoryShareIp: 'localServer.directoryShare.ip',
      directorySharePort: 'localServer.directoryShare.port',
      directoryShareServer: 'localServer.directoryShare.server'
    }),
    globalSearchScanWasInterrupted: {
      get () {
        return this.$store.state.storageData.settings.globalSearchScanWasInterrupted
      },
      set (value) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.globalSearchScanWasInterrupted',
          value
        })
      }
    }
  },
  methods: {
    initEventHubListeners () {
      this.$eventHub.$on('app:method', payload => {
        this[payload.method](payload.params)
      })
    },
    initIPCListeners () {
      electron.ipcRenderer.on('store:action', (event, data) => {
        this.$store.dispatch(data.action, data.params)
      })

      electron.ipcRenderer.on('check-app-updates', (event) => {
        this.$store.dispatch('INIT_APP_UPDATER', { notifyUnavailable: true })
      })

      electron.ipcRenderer.on('open-new-note', (event) => {
        this.$store.dispatch('OPEN_NOTE_EDITOR', { type: 'new' })
      })

      electron.ipcRenderer.on('window:blur', (event) => {
        this.windowBlurHandler()
      })

      electron.ipcRenderer.on('load:webview::failed', (event, data) => {
        this.$eventHub.$emit('notification', {
          action: 'update-by-type',
          type: 'load:webview::failed',
          closeButton: true,
          timeout: 3000,
          title: 'Quick view: file is not supported',
          message: data.path.replace('file:///', '')
        })
      })

      electron.ipcRenderer.on('download-file-progress', (event, data) => {
        const isDone = data.receivedBytes === data.totalBytes
        data.isDone = isDone
        data.started = data.percentDone > 0
        let actionButtons = []
        if (isDone) {
          actionButtons = [
            {
              title: 'open file',
              action: 'openDownloadedFile',
              closesNotification: true,
              onClick: () => {
                this.$store.dispatch('OPEN_FILE', data.filePath)
              }
            },
            {
              title: 'show in directory',
              action: 'showDownloadedFile',
              closesNotification: true,
              onClick: () => {
                this.$store.dispatch('SHOW_DIR_ITEM_IN_DIRECTORY', { dir: data.dir, itemPath: data.filePath })
              }
            }
          ]
        }
        else {
          actionButtons = [
            {
              title: 'cancel',
              action: 'cancelDownload',
              closesNotification: true,
              onClick: () => {
                electron.ipcRenderer.send('download-file:cancel', { hashID: data.hashID })
              }
            }
          ]
          if (data.isPaused) {
            actionButtons.unshift({
              title: 'resume',
              action: 'resumeDownloading',
              closesNotification: false,
              onClick: () => {
                electron.ipcRenderer.send('download-file:resume', { hashID: data.hashID })
              }
            })
          }
          else {
            actionButtons.unshift({
              title: 'pause',
              action: 'pauseDownloading',
              closesNotification: false,
              onClick: () => {
                electron.ipcRenderer.send('download-file:pause', { hashID: data.hashID })
              }
            })
          }
        }
        this.$eventHub.$emit('notification', {
          action: 'update-by-hash',
          type: 'progress:download-file',
          actionButtons: actionButtons,
          closeButton: true,
          timeout: 0,
          title: `Downloading ${data.isUpdate ? 'update' : 'file'}`,
          message: '',
          progress: data,
          hashID: data.hashID
        })
      })
    },
    checkForAppUpdateInstalled () {
      this.$store.dispatch('CHECK_IF_UPDATE_INSTALLED')
    },
    bindKeyEvents () {
      this.bindGeneralKeyEvents()
      this.bindGeneralMousetrapEvents()
    },
    initWindowErrorHandler () {
      window.addEventListener('error', (event) => {
        const disallowedErrors = [
          'ResizeObserver loop limit exceeded'
        ]
        console.log('error::App.vue::initWindowErrorHandler', event)
        if (!disallowedErrors.includes(event.message)) {
          const hashID = this.$utils.getHash()
          this.$eventHub.$emit('notification', {
            action: 'add',
            hashID,
            timeout: 0,
            closeButton: true,
            icon: 'mdi-alert-octagon-outline',
            title: 'An error occured',
            message: 'The app might not function properly until you reload it',
            actionButtons: [
              {
                title: 'Show the error',
                onClick: () => {
                  this.dialogs.errorDialog.data.errorEvent = event
                  this.dialogs.errorDialog.data.routeName = this.$route.name
                  this.dialogs.errorDialog.value = true
                },
                closesNotification: true
              },
              {
                title: 'Ignore',
                onClick: () => {},
                closesNotification: true
              }
            ]
          })
        }
      })
    },
    handleConnectedDriveActions (drives) {
      const previousDataExists = this.drivesPreviousData.length > 0
      const driveCountIncreased = drives.length > this.drivesPreviousData.length
      const shouldFocus = this.focusMainWindowOnDriveConnected
      if (previousDataExists && driveCountIncreased && shouldFocus) {
        electron.ipcRenderer.send('focus-main-app-window')
      }
    },
    extractAppBinaries () {
      // Moving binaries to app storage because fs.childProcess.spawn
      // and other modules cannot access it from within app.asar
      const isEnvProduction = process.env.NODE_ENV === 'production'
      if (isEnvProduction) {
        // TODO: do not overwrite existing dirs in appStorageBin
        // if user puts custom binaries there (need a setting switch for it)
        require('fs-extra').copy(
          this.appPaths.bin, 
          this.appPaths.storageDirectories.appStorageBin
        )
      }
    },
    windowBlurHandler () {
      // Force reset keyboard state to avoid pressed keys state remain true
      // when the the window looses focus and setKeyboardInputState()
      // is not called from within bindGeneralKeyEvents()
      this.setKeyboardInputState(false)
    },
    setKeyboardInputState (event) {
      if (event === false) {
        this.inputState.alt = false
        this.inputState.ctrl = false
        this.inputState.shift = false
        this.inputState.meta = false
      }
      else {
        this.inputState.alt = event.altKey
        this.inputState.ctrl = event.ctrlKey
        this.inputState.shift = event.shiftKey
        this.inputState.meta = event.metaKey
      }
    },
    setWindowSize () {
      this.$store.dispatch('SET', {
        key: 'windowSize',
        value: { x: window.innerWidth, y: window.innerHeight },
        options: {
          updateStorage: false
        }
      })
    },
    initWindowResizeListener () {
      this.$store.state.throttles.windowResizeHandler = new TimeUtils()
      window.addEventListener('resize', (event) => {
        this.$store.state.throttles.windowResizeHandler.throttle(() => {
          this.setWindowSize()
        }, { time: 250 })
      })
    },
    initIntervals () {
      this.$store.state.intervals.lastSearchScanTimeElapsed = setInterval(() => {
        // Update time elapsed since last search scan
        const lastSearchScanTimeElapsed = this.$utils.getTimeDiff(
          Date.now(),
          this.lastSearchScanTime,
          'ms'
        )
        this.$store.dispatch('SET', {
          key: 'globalSearch.lastScanTimeElapsed',
          value: lastSearchScanTimeElapsed
        })
      }, 1000)
    },
    initMediaDirectories () {
      // TODO:
      // - See what happens why I try to add the same image to multiple notes. 
      // Will there be duplicates? Make sure it's not copied if it's already there
      // - Add image gallery so that images from /notes can be reused in multiple notes
      return new Promise((resolve, reject) => {
        const directoriesToInit = [
          this.appPaths.storageDirectories.appStorage,
          this.appPaths.storageDirectories.appStorageBin,
          this.appPaths.storageDirectories.appStorageHomeBannerMedia,
          this.appPaths.storageDirectories.appStorageNotesMedia,
          this.appPaths.storageDirectories.appStorageGlobalSearchData,
          this.appPaths.storageDirectories.appStorageNavigatorThumbs
        ]
        const promises = []
        directoriesToInit.forEach(path => {
          // Attempt to create directory.
          // Don't do anything if it's already created
          promises.push(fs.promises.mkdir(path, { recursive: true }))
        })
        Promise.allSettled(promises)
          .then(() => resolve())
      })
    },
    async initGlobalSearchDataScan () {
      // TODO: Check if the drive has enough space on it
      await this.initGlobalSearchDataFiles()
      await this.startGlobalSearchDataScan()
    },
    async initGlobalSearchDataFiles () {
      this.drives.forEach(async (drive, index) => {
        const searchDataFilePath = `${this.appPaths.storageDirectories.appStorageGlobalSearchData}/search_data_${index}.txt`
        const searchDataFileObject = {
          mount: drive.mount,
          path: searchDataFilePath
        }
        const fileObject = this.appPaths.globalSearchDataFiles.find(object => object.mount === drive.mount)
        if (!fileObject) {
          this.$store.commit('PUSH', {
            key: 'appPaths.globalSearchDataFiles',
            value: searchDataFileObject
          })
        }
        // Check if file already exists, otherwise create it
        try {
          await fs.promises.access(searchDataFilePath, fs.constants.F_OK)
        }
        catch (error) {
          await fs.promises.writeFile(searchDataFilePath, '')
        }
      })
    },
    initGlobalSearchDataScanUpdateInterval (task, notification) {
      // Setup notification update interval, if it doesn't exist yet
      clearInterval(task.props.updateInterval)
      task.props.updateInterval = setInterval(() => {
        const scannedDriveCount = task.props.scannedDriveCount
        const driveCount = task.props.driveCount
        const scannedDrivesProgress = `${scannedDriveCount}/${driveCount}`
        notification.message = `Drives scanned: ${scannedDrivesProgress}`
        this.$eventHub.$emit('notification', notification)
      }, 1000)
    },
    initAllGlobalSearchDataScanStreams (task, notification) {
      // Init a scan stream for each search data file
      this.appPaths.globalSearchDataFiles.forEach((searchDataFile, index) => {
        this.initGlobalSearchDataScanStream(searchDataFile, index, notification, task)
      })
    },
    addTaskGlobalSearchDataScan () {
      return new Promise((resolve, reject) => {
        const taskHashID = this.$utils.getHash()
        this.$store.dispatch('ADD_TASK', {
          name: 'global-search::data-scan',
          hashID: taskHashID,
          props: {
            scans: [],
            driveCount: 0,
            scannedDriveCount: 0,
            scannedDrives: [],
            updateInterval: null
          }
        })
          .then((task) => resolve(task))
      })
    },
    startGlobalSearchDataScan () {
      if (!this.globalSearchScanInProgress) {
        this.addTaskGlobalSearchDataScan()
          .then((task) => {
            this.globalSearchScanInProgress = true
            // Emit notification
            const hashID = this.$utils.getHash()
            const scannedDriveCount = task.props.scannedDriveCount
            const driveCount = task.props.driveCount
            const scannedDrivesProgress = `${scannedDriveCount}/${driveCount}`
            const notification = {
              action: 'update-by-hash',
              hashID,
              timeout: 0,
              closeButton: false,
              title: 'Global search: drive scan is in progress',
              message: `Drives scanned: ${scannedDrivesProgress}`,
              actionButtons: [
                {
                  title: 'cancel scan',
                  onClick: () => {
                    this.globalSearchScanInProgress = false
                    // Avoid Zlib error "unexpected end of file"
                    this.globalSearchScanWasInterrupted = true
                    // Destroy all ongoing streams
                    task.props.scans.forEach(scan => {
                      scan.stream.destroy()
                    })
                    clearInterval(task.props.updateInterval)
                    // Reset values
                    task.props.driveCount = 0
                    task.props.scannedDriveCount = 0
                    task.props.scannedDrives = []
                    task.props.updateInterval = null
                  },
                  closesNotification: true
                }
              ]
            }
            this.$eventHub.$emit('notification', notification)
            this.initGlobalSearchDataScanUpdateInterval(task, notification)
            this.initAllGlobalSearchDataScanStreams(task, notification)
          })
      }
    },
    initGlobalSearchDataScanStream (searchDataFile, index, notification, task) {
      return new Promise((resolve, reject) => {
        const driveIsMounted = this.drives.some(mountedDrive => mountedDrive.mount === searchDataFile.mount)
        if (driveIsMounted) {
          task.props.driveCount++
          task.props.scans[index] = {}
          task.props.scans[index].readStream = new Walk(
            searchDataFile.mount,
            this.globalSearchScanDepth,
            this.globalSearchDisallowedPaths
          )
          task.props.scans[index].writeStream = fs.createWriteStream(searchDataFile.path)
          if (this.globalSearchCompressSearchData) {
            task.props.scans[index].stream = task.props.scans[index].readStream.init()
              .pipe(zlib.createGzip())
              .pipe(task.props.scans[index].writeStream)
          }
          else {
            task.props.scans[index].stream = task.props.scans[index].readStream.init()
              .pipe(task.props.scans[index].writeStream)
          }
          // Setup listeners
          task.props.scans[index].stream.on('error', (error) => {
            console.log(error)
          })
          task.props.scans[index].stream.on('finish', () => {
            task.props.scannedDriveCount++
            // If all drives are scanned
            if (task.props.scannedDriveCount === task.props.driveCount) {
              clearInterval(task.props.updateInterval)
              // Reset values
              task.props.driveCount = 0
              task.props.scannedDriveCount = 0
              task.props.scannedDrives = []
              task.props.updateInterval = null
              // Update notification
              notification.timeout = 5000
              notification.title = 'Global search | drive scan is completed'
              notification.message = ''
              notification.icon = 'mdi-check-circle-outline'
              notification.actionButtons = []
              this.$eventHub.$emit('notification', notification)
              // Set scan status
              this.globalSearchScanInProgress = false
              this.globalSearchScanWasInterrupted = false
              this.setTimeLastSearchScan()
            }
          })
        }
        resolve()
      })
    },
    checkGlobalSearchScanIsDue () {
      const minutesElapsed = this.$utils.getTimeDiff(
        Date.now(),
        this.lastSearchScanTime,
        'minutes'
      )
      const scanIsDue = minutesElapsed >= this.globalSearchAutoScanIntervalTime
      if (scanIsDue) {
        this.initGlobalSearchDataScan()
      }
    },
    async setTimeLastSearchScan () {
      return await this.$store.dispatch('SET', {
        key: 'storageData.settings.time.lastSearchScan',
        value: Date.now()
      })
    },
    restoreRouteScrollPosition (params) {
      const { toRoute } = params
      const historyItems = this.history.itemsRaw
      const lastHistoryItem = historyItems[historyItems.length - 1]
      const secondFromEndHistoryItem = historyItems[historyItems.length - 2]
      const gotBackToSameNavigatorDir = toRoute.name === 'navigator' && (secondFromEndHistoryItem === this.currentDir.path)
      const shouldRestoreScroll = toRoute.name !== 'navigator' || !gotBackToSameNavigatorDir
      if (shouldRestoreScroll) {
        const scrollArea = this.$utils.getContentAreaNode(toRoute.name)
        const savedScrollPosition = this.routeScrollPosition[toRoute.name]
        if (savedScrollPosition) {
          scrollArea.scroll({
            top: savedScrollPosition,
            left: 0,
            behavior: 'auto'
          })
        }
      }
    },
    setRouteScrollPosition (params) {
      const { fromRoute } = params
      const scrollArea = this.$utils.getContentAreaNode(fromRoute.name)
      this.routeScrollPosition[fromRoute.name] = scrollArea?.scrollTop
    },
    importExpress () {
      // Lazy-import heavy module
      if (express === undefined) { express = require('express') }
      if (expressServer === undefined) { expressServer = express() }
    },
    initGlobalSearchWorker (params, workerObject) {
      return new Promise((resolve, reject) => {
        // Handle interrupted search scan
        if (this.globalSearchScanWasInterrupted) {
          // Re-scan search data
          this.$eventHub.$emit('app:method', {
            method: 'initGlobalSearchDataScan'
          })
          this.$eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'error:search-file-problem',
            timeout: 8000,
            closeButton: true,
            title: 'Drive scan initiated',
            message: 'One of the search files is damaged'
          })
          reject(new Error('One of the search files is damaged'))
        }
        else {
          // Init worker listeners
          workerObject.worker.onmessage = (event) => {
            if (event.data.action === 'results') {
              this.$eventHub.$emit('globalSearch:results', event.data)
            }
            else if (event.data.action === 'info-update') {
              this.$eventHub.$emit('globalSearch:info-update', event.data.update)
            }
          }
          workerObject.worker.onerror = (error) => {
            console.log('Error in "initglobalSearchWorker"', error)
            if (error.message === 'Uncaught Error: unexpected end of file') {
              this.$eventHub.$emit('app:method', {
                method: 'initGlobalSearchDataScan'
              })
              this.$eventHub.$emit('notification', {
                action: 'update-by-type',
                type: 'error:search-file-problem',
                timeout: 8000,
                closeButton: true,
                title: 'Drive scan initiated',
                message: 'One of the search files is damaged'
              })
            }
          }
          resolve()
        }
      })
    },
    initGlobalSearchWorkerAction (params) {
      const workerObject = this.$store.state.workers.globalSearchWorkers.find(item => item.mount === params.mount)
      if (params.action === 'cancel') {
        if (workerObject) {
          workerObject.worker.postMessage({ action: 'cancel' })
        }
      }
      else if (params.action === 'search') {
        // If an ongoing worker exist
        if (workerObject) {
          workerObject.worker.postMessage({ action: 'cancel' })
          setTimeout(() => {
            // Re-init worker
            workerObject.worker = new GlobalSearchWorker()
            this.execGlobalSearchWorkerAction(params, workerObject)
          }, 50)
        }
        // If worker does not exist
        else {
          // Add worker
          const workerObject = {
            mount: params.mount,
            worker: new GlobalSearchWorker()
          }
          this.$store.state.workers.globalSearchWorkers.push(workerObject)
          this.execGlobalSearchWorkerAction(params, workerObject)
        }
      }
    },
    execGlobalSearchWorkerAction (params, workerObject) {
      this.initGlobalSearchWorker(params, workerObject)
        .then(() => {
          workerObject.worker.postMessage(params)
        })
        .catch((error) => {
          console.log(error)
        })
    },
    async handleChokidarEvent (data) {
      // Remove outdated data from storage files
      await this.initAllStorageFiles()
      this.$store.dispatch('RELOAD_DIR', {
        scrollTop: false,
        selectCurrentDir: false
      })
    },
    initDirWatcherWorker () {
      this.$store.state.workers.dirWatcherWorker = new DirWatcherWorker()
      try {
        this.$store.state.workers.dirWatcherWorker.onmessage = (event) => {
          this.handleChokidarEvent(event.data.data)
        }
        this.$store.state.workers.dirWatcherWorker.onerror = (error) => {
          throw Error(error)
        }
      }
      catch (error) {
        throw Error(error)
      }
    },
    async startWatchingCurrentDir (path) {
      this.$store.state.workers.dirWatcherWorker.postMessage({ action: 'init-dir-watch', path })
    },
    handleFirstAppLaunch () {
      // TODO:
      // In production, some store properties resolve after this method
      // so this.isFirstAppLaunch is always true
      return
      if (this.isFirstAppLaunch) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.isFirstAppLaunch',
          value: false
        })
        this.$eventHub.$emit('notification', {
          action: 'add',
          closeButton: true,
          timeout: 0,
          title: 'Welcome',
          message: `
            "Sigma file manager" is a free, open-source file manager app, licensed under GNU GPLv3 or later.
          `
        })
      }
    },
    stopLocalDirectoryShareServer () {
      try {
        this.$store.state.childProcesses.localDirectoryShareServer.kill()
        clearInterval(this.$store.state.intervals.localDirectoryShareServerSelfDistruction)
      }
      catch (error) {}
    },
    stopLocalFileShareServer () {
      try {
        this.$store.state.childProcesses.localFileShareServer.kill()
        clearInterval(this.$store.state.intervals.localFileShareServerSelfDistruction)
      }
      catch (error) {}
    },
    scheduleLocalFileShareServerSelfDistruct () {
      try {
        this.$store.state.childProcesses.localFileShareServer.send({
          action: 'reset-signal::self-distruct'
        })
      }
      catch (error) {}
      clearInterval(this.$store.state.intervals.localFileShareServerSelfDistruction)
      this.$store.state.intervals.localFileShareServerSelfDistruction = setInterval(() => {
        try {
          this.$store.state.childProcesses.localFileShareServer.send({
            action: 'reset-signal::self-distruct'
          })
        }
        catch (error) {}
      }, 10000)
    },
    initLocalFileShareServerProcess (path) {
      console.log('initLocalFileShareServerProcess', path)
      this.$store.state.childProcesses.localFileShareServer = childProcess.fork('E:/Projects/Code/Apps/Desktop/Sigma file manager/Project/sigma-file-manager/src/workers/localFileShareServerWorker.js')
      this.$store.state.childProcesses.localFileShareServer.on('message', data => {
        console.log(data)
      })
      this.$store.state.childProcesses.localFileShareServer.send({
        action: 'start-server',
        path,
        fileShareType: this.fileShareType,
        fileSharePort: this.fileSharePort
      })
      this.scheduleLocalFileShareServerSelfDistruct()

      // const subprocess = childProcess.spawn(process.argv[0], ['E:/Projects/Code/Apps/Desktop/Sigma file manager/Project/sigma-file-manager/src/workers/localFileShareServerWorker.js'], {
      //   // detached: true,
      //   // stdio: 'ignore'
      // })

      // let subprocess = childProcess.exec(
      //   payload.command,
      //   (error, stdout, stderr) => {
      //     if (error) {
      //       progress.eta = 0
      //       notificationData.timeout = 5000
      //       notificationData.title = status.isCanceled ? 'Download canceled' : 'Download failed'
      //       notificationData.actionButtons = []
      //       eventHub.$emit('notification', notificationData)
      //       return
      //     }
      //   }
      // )

      // this.$store.state.childProcesses.localFileShareServer.stdout.on('data', (data) => {
      //   console.log('express', data)
      //   // const dataArray = data.split(' ')
      //   //   .filter(item => item !== '')
      //   // // Get only info from 'download' phase
      //   // if (dataArray[1].endsWith('%') && dataArray[5] !== 'unknown') {
      //   //   // Update progess data
      //   //   progress.started = true
      //   //   progress.percentDone = dataArray[1]?.replace(/\%/, '')
      //   //   progress.speed = dataArray[5]
      //   //   progress.eta = dataArray[7]?.replace(/\[download\]/, '')
      //   //   if (!status.isCanceled) {
      //   //     // Update notification
      //   //     const actionButtons = [
      //   //       {
      //   //         title: 'cancel',
      //   //         action: '',
      //   //         closesNotification: true,
      //   //         onClick: () => {
      //   //           status.isCanceled = true
      //   //           dispatch('TERMINATE_PROCESS', mainExecProcess)
      //   //         }
      //   //       }
      //   //     ]
      //   //     notificationData.message = ''
      //   //     notificationData.actionButtons = actionButtons
      //   //     eventHub.$emit('notification', notificationData)
      //   //   }
      //   // }
      // })
    },
    async initLocalDirectoryShare () {
      await this.stopLocalDirectoryShareServer()
      this.dialogs.localShareManagerDialog.value = true
      this.dialogs.localShareManagerDialog.data.shareType = 'directory'
      this.localServer.directoryShare.item = this.selectedDirItems.getLast()
      this.directoryShareIp = await this.getLocalIPv4()
      this.directorySharePort = await getPort({ port: getPort.makeRange(55000, 55999) })
      this.localServer.directoryShare.address = `${this.directoryShareIp}:${this.directorySharePort}/ftp`
      const path = this.selectedDirItems.getLast().path
      this.serveDirectoryLocally(path)
      this.$eventHub.$emit('notification', {
        action: 'update-by-type',
        type: 'directoryShare',
        actionButtons: [
          {
            title: 'stop server',
            onClick: () => {
              this.stopLocalDirectoryShareServer()
              this.dialogs.localShareManagerDialog.value = false
            },
            closesNotification: true
          },
          {
            title: 'copy address',
            onClick: () => {
              this.$store.dispatch(
                'COPY_TEXT_TO_CLIPBOARD',
                {text: `${this.directoryShareIp}:${this.directorySharePort}/ftp`}
              )
            },
            closesNotification: false
          }
        ],
        closeButton: false,
        timeout: 0,
        title: 'Directory is now accessible from local devices',
        message: `Address: ${this.directoryShareIp}:${this.directorySharePort}/ftp`
      })
    },
    async initLocalFileShare () {
      await this.stopLocalFileShareServer()
      this.dialogs.localShareManagerDialog.value = true
      this.dialogs.localShareManagerDialog.data.shareType = 'file'
      this.localServer.fileShare.item = this.targetItems.getLast()
      this.fileShareIp = await this.getLocalIPv4()
      this.fileSharePort = await getPort({ port: getPort.makeRange(56000, 56999) })
      this.localServer.fileShare.address = `${this.fileShareIp}:${this.fileSharePort}`
      const path = this.targetItems.getLast().path
      this.serveFilesLocally(path)
      this.$eventHub.$emit('notification', {
        action: 'update-by-type',
        type: 'fileShare',
        actionButtons: [
          {
            title: 'stop server',
            onClick: () => {
              this.stopLocalFileShareServer()
              this.dialogs.localShareManagerDialog.value = false
            },
            closesNotification: true
          },
          {
            title: 'copy address',
            onClick: () => {
              this.$store.dispatch(
                'COPY_TEXT_TO_CLIPBOARD',
                {text: `${this.fileShareIp}:${this.fileSharePort}`}
              )
            },
            closesNotification: false
          }
        ],
        closeButton: false,
        timeout: 0,
        title: 'Local file share is active',
        message: `Address: ${this.fileShareIp}:${this.fileSharePort}`
      })
    },
    getLocalIPv4 () {
      // TODO:
      // - When offline, will throw:
      //   "Error: getaddrinfo ENOTFOUND www.google.com"
      //   And local file share will not be accessible.
      //   To fix use another method for detecting ipv4 address.
      return new Promise((resolve, reject) => {
        const socket = net.createConnection(80, 'www.google.com')
        socket.on('connect', () => {
          resolve(socket.address().address)
          socket.end()
        })
        socket.on('error', (error) => {
          reject(error)
        })
      })
    },
    serveDirectoryLocally (path) {
      this.generateQrCode({
        container: document.querySelector('#qr-code'),
        content: this.localServer.directoryShare.address
      })
      this.importExpress()
      this.initFTPserver(path)
      this.initFTPclientFileUpload(path)
      this.directoryShareServer = expressServer.listen(this.directorySharePort)
    },
    serveFilesLocally (path) {
      this.generateQrCode({
        container: document.querySelector('#qr-code'),
        content: `${this.fileShareIp}:${this.fileSharePort}`
      })
      this.importExpress()
      // this.serveFile(path)
      this.initLocalFileShareServerProcess(path)
    },
    // serveFile (path) {
    //   expressServer.get('/', (request, response, next) => {
    //     // Stream (display) file
    //     if (this.fileShareType === 'stream') {
    //       response.sendFile(path)
    //     }
    //     // Push download
    //     else if (this.fileShareType === 'download') {
    //       response.download(path, (error) => {
    //         if (error) { throw error }
    //       })
    //     }
    //   })
    //   this.fileShareServer = expressServer.listen(this.fileSharePort)
    // },
    async initFTPserver (path) {
      // TODO:
      // Use https://www.npmjs.com/package/express-state
      // To pass dirItems data and generate dirItem nodes freely,
      // instead of using built-in {files} literal provided by serve-index
      // Or use Vue SSR https://ssr.vuejs.org/guide/#using-a-page-template
      // And send rendered on the server side HTML to the client side.
      // const processedHTML = fs.readFileSync(PATH.join(__static, 'server', '/ftp.html'))
      //  .replace('EXPRESS_REPLACE_SERVER_DATA', JSON.stringify(dirItemsData))
      expressServer.use(express.static(PATH.join(__static, 'server', 'public')))
      expressServer.use(
        '/ftp',
        express.static(path, {
          setHeaders: (res, path, stat) => {
            res.set('Content-Disposition', 'inline')
          }
        }),
        serveIndex(path, {
          icons: true,
          template: PATH.join(__static, 'server', '/ftp.html')
          // template: processedHTML
        })
      )
    },
    initFTPclientFileUpload (path) {
      expressServer.use(fileUpload({
        useTempFiles: true,
        tempFileDir: path
      }))

      expressServer.post('/uploaded', (req, res) => {
        if (!req.files || Object.keys(req.files).length === 0) {
          return res.status(400).send('No files were uploaded')
        }
        // If only 1 file is uploaded, put it into an array
        const uploadedItems = Array.isArray(req.files.items)
          ? req.files.items
          : [req.files.items]

        // Write each uploaded file to storage
        uploadedItems.forEach(item => {
          // Get available names for each item
          item.path = this.$utils.getUniquePath(PATH.join(path, item.name))
          // Write files to storage
          item.mv(item.path, (error) => {
            if (error) {
              return res.status(500).send(error)
            }
            else {
              res.send(
                `
                  <style>
                    body {
                      margin: 0
                    }
                    
                    button {
                      cursor: pointer;
                      padding: 8px 18px;
                      margin-top: 12px;
                      font-size: 12px;
                      font-weight: 600;
                      letter-spacing: 1px;
                      border-radius: 4px;
                      text-transform: uppercase;
                      color: #bdbdbd;
                      border: 2px solid #bdbdbd;
                      background: transparent;
                    }

                    .container {
                      display: flex;
                      flex-direction: column;
                      align-items: center;
                      justify-content: center;
                      height: 100%;
                      width: 100%;
                      background-color: #37474f;
                      color: #bdbdbd;
                      font-size: 36px;
                    }
                  </style>
                  <div class="container">
                    <div>Files were uploaded</div>
                    <button onclick="window.location.pathname = '/ftp'">Go back</button>
                  </div>
                `
              )
            }
          })
        })
      })
    },
    generateQrCode (options) {
      const defaultOptions = {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 96,
        height: 96
      }
      options = { ...defaultOptions, ...options }
      qrCode.toCanvas(options.content, options, (error, canvas) => {
        if (error) { throw error }
        // Remove previous qr element
        while (options.container.firstChild) {
          options.container.removeChild(options.container.firstChild)
        }
        // Create qr element
        options.container.appendChild(canvas)
      })
    },
    openWithExternalProgram (app) {
      this.$store.commit('OPEN_WITH_CUSTOM_APP', app)
    },
    initAllStorageFiles () {
      return new Promise((resolve, reject) => {
        const promises = []
        for (const [key, value] of Object.entries(this.storageData)) {
          promises.push(this.initStorageFile(value))
        }
        Promise.allSettled(promises)
          .then(() => {
            this.$store.dispatch('ADD_ACTION_TO_HISTORY', { action: 'App.vue::initAllStorageFiles()' })
            resolve()
          })
          .catch((error) => {
            throw Error(error)
          })
      })
    },
    initStorageFile (payload) {
      return new Promise((resolve, reject) => {
        const filePath = PATH.join(this.appPaths.storageDirectories.appStorage, payload.fileName)
        const fileExists = fs.existsSync(filePath)
        // If file doesn't exist, initizlize it and set data from store
        if (!fileExists) {
          this.writeDefaultStorageData(payload)
            .then(() => resolve())
            .catch((error) => reject(error))
        }
        // If file exists, get it and override each property in the store
        else if (fileExists) {
          this.fetchAppStorageData(payload)
            .then(() => resolve())
            .catch((error) => reject(error))
        }
      })
    },
    async fetchAppStorageData (payload) {
      try {
        let data = await this.$store.dispatch('READ_STORAGE_FILE', payload.fileName)
        data = this.processAppStorageData(payload, data)
        await this.writeStorageDataToStore(payload, data)
      }
      catch (error) {
        throw Error(error)
      }
    },
    /**
    * @param {object} params.payload
    * @param {object} params.data
    */
    async writeStorageDataToStore (payload, data) {
      try {
        for (let [key, value] of Object.entries(data)) {
          const propertyInStore = this.$utils.getDeepProperty(this.$store.state, key)
          if (propertyInStore !== undefined) {
            // Merge storage value with store value if it's an object,
            // otherwise overwrite the value in store.
            // This will prevent errors, when new object properties are added with updates
            if (this.$utils.getDataType(value) === 'object' && this.$utils.getDataType(propertyInStore) === 'object') {
              value = Object.assign({}, propertyInStore, value)
            }
            // Update store. Write updated settings back to the storage file
            await this.$store.dispatch('SET', {
              key,
              value,
              options: {
                updateStorage: payload.fileName === 'settings.json'
              }
            })
          }
        }
      }
      catch (error) {
        throw Error(error)
      }
    },
    /**
    * Remove outdated info from the file and convert data to
    * specific formats if needed
    * @param {object} payload
    * @param {object} data
    * @return {object} data
    */
    processAppStorageData (payload, data) {
      try {
        data = this.processStorageData(payload, data)
        data = this.formatAppStorageData(payload, data)
        return data
      }
      catch (error) {
        throw Error(error)
      }
    },
    formatAppStorageData (payload, data) {
      // if (payload.fileName === 'settings.json') {
      //   let shortcutProperties = Object.keys(data)
      //     .filter(propertyName => propertyName.startsWith('storageData.settings.shortcuts.'))
      //   shortcutProperties.forEach(key => {
      //     data[key] = this.$sharedUtils.shortcutRawToReadable(data[key])
      //   })
      // }
      // console.log('formatAppStorageData', data)
      return data
    },
    removeOutdatedDirItems (items) {
      return items.filter(item => fs.existsSync(item.path))
    },
    processStorageData (payload, data) {
      if (payload.fileName === 'notes.json') {
        if (data['storageData.notes.items'] !== undefined) {
          // Delete trashed notes that exceeded "delete forever" timer
          data['storageData.notes.items'].forEach((note, index) => {
            if (note.isTrashed) {
              const shouldBeDeleted = (new Date().getTime() - note.dateWillBeDeleted) > 0
              if (shouldBeDeleted) {
                data['storageData.notes.items'].splice(index, 1)
              }
            }
          })
        }
      }
      else if (payload.fileName === 'workspaces.json') {
        if (data['storageData.workspaces.items'] !== undefined) {
          data['storageData.workspaces.items'].forEach(workspace => {
            workspace.tabs = workspace.tabs
              .filter(tab => fs.existsSync(tab.path))
          })
        }
      }
      else if (payload.fileName === 'pinned.json') {
        let dataArray = data['storageData.pinned.items']
        if (dataArray !== undefined) {
          dataArray = this.removeOutdatedDirItems(dataArray)
          data['storageData.pinned.items'] = dataArray
        }
      }
      else if (payload.fileName === 'protected.json') {
        let dataArray = data['storageData.protected.items']
        if (dataArray !== undefined) {
          dataArray = this.removeOutdatedDirItems(dataArray)
          data['storageData.protected.items'] = dataArray
        }
      }
      else if (payload.fileName === 'stats.json') {
        let dataArray = data['storageData.stats.dirItemsTimeline']
        if (dataArray !== undefined) {
          dataArray = this.removeOutdatedDirItems(dataArray)
          data['storageData.stats.dirItemsTimeline'] = dataArray
        }
      }
      return data
    },
    async writeDefaultStorageData (payload) {
      try {
        this.$store.dispatch('WRITE_DEFAULT_STORAGE_FILE', {
          fileName: payload.fileName
        })
      }
      catch (error) {
        throw Error(error)
      }
    },
    transitionOutLoadingScreen () {
      const loadingScreenContainerNode = document.querySelector('#loading-animation__container')
      // Reset opacity to 0, before fading out
      if (loadingScreenContainerNode) {
        loadingScreenContainerNode.style.opacity = '0'
        loadingScreenContainerNode.animate(
          [
            { opacity: 1, transform: 'scale(1)' },
            { opacity: 0, transform: 'scale(0.8)' }
          ],
          {
            easing: 'ease',
            duration: 500,
            fill: 'forwards'
          }
        )
        this.animateHomeBanner()
      }
    },
    removeLoadingScreen () {
      // Fade out the loading screen and then remove it
      const fadeOutTimeout = 2000
      const loadingScreenContainerNode = document.querySelector('#loading-screen__container')
      if (loadingScreenContainerNode) {
        loadingScreenContainerNode.style.transition = `all ${fadeOutTimeout}ms`
        loadingScreenContainerNode.style.opacity = '0'
        setTimeout(() => {
          loadingScreenContainerNode.remove()
          this.appIsLoaded = true
        }, fadeOutTimeout)
      }
    },
    animateHomeBanner (options = {}) {
      setTimeout(() => {
        animate()
      }, options.delay ? 400 : 0)

      function animate () {
        try {
          const homeBannerImgNode = document.querySelector('.media-banner img')
          const homeBannerVideoNode = document.querySelector('.media-banner video')
          let targetNode
          if (homeBannerImgNode) {
            targetNode = homeBannerImgNode
          }
          else if (homeBannerVideoNode) {
            targetNode = homeBannerVideoNode
          }
          targetNode.animate(
            [
              { transform: 'scale(1.1)' },
              { transform: 'scale(1)' }
            ],
            {
              easing: 'cubic-bezier(.07,1.04,.74,1)',
              duration: 2000,
              fill: 'forwards'
            }
          )
        }
        catch (error) {}
      }
    },
    initGlobalShortcuts () {
      for (const [key, value] of Object.entries(this.computedShortcuts)) {
        if (value.isGlobal) {
          // Update global shortcut and set it to tray
          electron.ipcRenderer.send('set-global-shortcut', {
            name: key,
            shortcut: this.shortcuts[key].shortcut,
            previousShortcut: this.shortcuts[key].shortcut
          })
        }
      }
    },
    setUIzoom () {
      electron.webFrame.setZoomFactor(this.UIZoomLevel)
    },
    initAppStatusWatcher () {
      this.$store.state.appStatus.instance = new idleJs({
        idle: this.$store.state.appStatus.idleTreshold,
        events: ['mousemove', 'keydown', 'mousedown', 'touchstart'],
        onIdle: () => this.handleAppIdleState(),
        onActive: () => this.handleAppActiveState(),
        onHide: () => {},
        onShow: () => {},
        keepTracking: true,
        startAtIdle: false
      }).start()
    },
    handleAppIdleState () {
      console.log('APP STATUS: IDLE')
      this.appStatus.state = 'idle'
      // Do not stop drive list watcher when "focusMainWindowOnDriveConnected" is true
      // it will stop working when the drive watcher is stopped
      if (!this.focusMainWindowOnDriveConnected) {
        this.stopStorageDevicesWatcher()
      }
      this.handleThumbCacheRemoval()
    },
    handleAppActiveState () {
      console.log('APP STATUS: ACTIVE')
      this.appStatus.state = 'active'
      this.initStorageDevicesWatcher()
    },
    handleThumbCacheRemoval () {
      this.getDirItemTotalSize([this.appPaths.storageDirectories.appStorageNavigatorThumbs])
        .then((thumbDirSizeInBytes) => {
          const sizeLimitInBytes = this.thumbnailStorageLimit * 1000 * 1000
          if (thumbDirSizeInBytes > sizeLimitInBytes) {
            this.$store.dispatch('FETCH_DIR_ITEM_INFO', this.appPaths.storageDirectories.appStorageNavigatorThumbs)
              .then((item) => {
                this.$store.dispatch('DELETE_DIR_ITEMS', {
                  items: [item],
                  options: {
                    skipSafeCheck: true,
                    silent: true
                  }
                })
              })
          }
        })
        .catch((error) => {
          console.log('error::App.vue::handleThumbCacheRemoval', error)
        })
    },
    async getDirItemTotalSize (paths) {
      let totalSize = 0
      for (let index = 0; index < paths.length; index++) {
        const path = paths[index]
        const pathStat = fs.statSync(path)
        if (pathStat.isFile()) {
          totalSize += pathStat.size
        }
        else {
          const dirSize = await this.getDirectorySize(path)
          totalSize += dirSize
        }
      }
      return totalSize
    },
    async getDirectorySize (path) {
      return new Promise((resolve, reject) => {
        getDirSize(path, { type: 'raw', stopOnError: false }, (error, size) => {
          if (error) { reject(error) }
          resolve(size)
        })
      })
    },
    initGlobalSearchDataWatcher () {
      if (process.env.NODE_ENV !== 'development') {
        this.stopGlobalSearchDataWatcher()
        this.$store.state.intervals.globalSearchDataWatcher = setInterval(() => {
          this.checkGlobalSearchScanIsDue()
        }, this.globalSearchAutoScanIntervalTime * 1000)
      }
    },
    initStorageDevicesWatcher () {
      this.stopStorageDevicesWatcher()
      this.$store.state.intervals.driveListFetchInterval = setInterval(() => {
        this.fetchStorageDevices()
      }, this.$store.state.intervals.driveListFetchIntervalTime)
    },
    stopGlobalSearchDataWatcher () {
      clearInterval(this.$store.state.intervals.globalSearchDataWatcher)
    },
    stopStorageDevicesWatcher () {
      clearInterval(this.$store.state.intervals.driveListFetchInterval)
    },
    async fetchStorageDevices () {
      try {
        this.drivesPreviousData = this.$utils.cloneDeep(this.drives)
        this.drives = await getStorageDevices()
      }
      catch (error) {
        throw Error(error)
      }
    },
    bindGeneralKeyEvents () {
      document.addEventListener('keydown', (event) => {
        this.setKeyboardInputState(event)
      })
      document.addEventListener('keyup', (event) => {
        this.setKeyboardInputState(event)
      })
    },
    bindGeneralMousetrapEvents () {
      // Disabling feature that prevents shortcuts for focused input fields
      // Can also be done for a single element by adding class="mousetrap"
      mousetrap.prototype.stopCallback = () => false

      // Prevent default Chromium shortcuts
      const shortcutsToDisable = ['ctrl+w', 'ctrl+shift+=']
      mousetrap.bind(shortcutsToDisable, (event) => {
        event.preventDefault()
      }, 'keydown')

      // Bind all shortcuts to their action automatically
      for (const [key, value] of Object.entries(this.computedShortcuts)) {
        if (!value.isGlobal) {
          if (['switchTab'].includes(key)) {
            // Bind "switch tabs" shortcuts
            const shortcutStaticPart = value.shortcut.replace('[1-9]', '')
            const tabShortcuts = [...Array(9)].map((_, index) => `${shortcutStaticPart}${index + 1}`)
            mousetrap.bind(tabShortcuts, (event) => {
              this.$store.dispatch('SWITCH_TAB', event.key)
            }, 'keydown')
          }
          else if (['switchWorkspace'].includes(key)) {
            // Bind "switch workspace" shortcuts
            const shortcutStaticPart = value.shortcut.replace('[1-9]', '')
            const workspaceShortcuts = [...Array(9)].map((_, index) => `${shortcutStaticPart}${index + 1}`)
            mousetrap.bind(workspaceShortcuts, (event) => {
              const index = parseInt(event.code.replace('Digit', ''))
              const workspaceItem = this.storageDataWorkspaces.items[index - 1]
              if (workspaceItem !== undefined) {
                this.$store.dispatch('SWITCH_WORKSPACE', workspaceItem)
              }
            }, 'keydown')
          }
          else if (['switchView'].includes(key)) {
            // Bind "switch view" shortcuts
            const shortcutStaticPart = value.shortcut.replace('[1-9]', '')
            const routeShortcuts = [...Array(this.navigationPanel.items.length)]
              .map((_, index) => `${shortcutStaticPart}${index + 1}`)
            mousetrap.bind(routeShortcuts, (event) => {
              const index = parseInt(event.code.replace('Digit', ''))
              value.action.props = this.navigationPanel.items[index - 1]
              this.$store.dispatch('SHORTCUT_ACTION', { event, value })
            }, 'keydown')
          }
          else {
            // Bind specified action to shortcuts
            if (!value.isReadOnly) {
              mousetrap.bind(value.shortcut, (event) => {
                this.$store.dispatch('SHORTCUT_ACTION', { event, value })
              }, 'keydown')
            }
          }
        }
      }
    }
  }
}
</script>

<style>
@font-face {
  font-family: 'Roboto-Light';
  src: url('./assets/fonts/Roboto/Roboto-Light.ttf') format('truetype')
}

@font-face {
  font-family: 'Roboto-Regular';
  src: url('./assets/fonts/Roboto/Roboto-Regular.ttf') format('truetype')
}

@font-face {
  font-family: 'Roboto-Bold';
  src: url('./assets/fonts/Roboto/Roboto-Bold.ttf') format('truetype')
}

#app {
  --nav-panel-width: 64px;
  --nav-panel-active-indicator-width: 4px;
  --nav-panel-icon-width: calc(
    var(--nav-panel-width) -
    (var(--nav-panel-active-indicator-width) * 2)
  );
  --scrollbar-width: 14px;
  --window-toolbar-height: 32px;
  --action-toolbar-height: 42px;
  --workspace-area-toolbar-height: 48px;
  --header-height: calc(
    var(--window-toolbar-height) +
    var(--action-toolbar-height)
  );
}

#app[data-theme-type="light"] {}

#app[data-theme-type="dark"] {
  --main-color-1: rgba(47, 52, 68);
  --key-color-1: #607d8b;
  --key-color-1-darker-1: rgb(55, 68, 88);
  --highlight-color-1: rgba(255, 255, 255, 0.3);
  --highlight-color-2: rgba(255, 255, 255, 0.2);
  --highlight-color-3: rgba(255, 255, 255, 0.1);
  --highlight-color-4: rgba(255, 255, 255, 0.05);
  --highlight-color-5: rgba(255, 255, 255, 0.01);
  --bg-color-1-value: 36, 38, 44;
  --bg-color-2-value: 29, 31, 37;
  --bg-color-3-value: 47, 52, 68;
  --bg-color-1: rgb(var(--bg-color-1-value));
  --bg-color-2: rgb(var(--bg-color-2-value));
  --bg-color-3: rgb(var(--bg-color-3-value));
  --color-1: #fafafa;
  --color-2: #f5f5f5;
  --color-3: #eeeeee;
  --color-4: #e0e0e0;
  --color-5: #bdbdbd;
  --color-6: #9e9e9e;
  --color-7: #757575;
  --color-8: #616161;
  --color-1-alt-1: rgb(96, 125, 139, 0.5);
  --code-bg-color: rgb(0, 0, 0, 0.1);
  --table-color: #616161;
  --icon-color-1: #546e7a;
  --icon-color-2: #9e9e9e;
  --icon-color-3: #607d8b;
  --icon_active-color-1: rgb(96, 125, 139, 0.2);
  --title-color-1: #9e9e9e;
  --sub-title-color-1: #757575;
  --sub-title-color-2: #9e9e9e;
  --button-bg-color-1: rgb(255, 255, 255, 0.05);
  --button-color-1: rgb(255, 255, 255, 0.4);
  --button-bg-color-2: rgb(96, 125, 139, 0.4);
  --button-color-2: rgb(255, 255, 255, 0.7);
  --radio-bg-color-1: rgb(255, 255, 255, 0.4);
  --radio-text-color-1: rgb(255, 255, 255, 0.4);
  --input-bg-color-1: rgb(255, 255, 255, 0.4);
  --input_active-track-color-1: var(--key-color-1-darker-1);
  --input_active-thumb-color-1: var(--key-color-1);
  --input-track-color-1: rgba(24, 26, 32);
  --input-thumb-color-1: var(--color-6);
  --divider-color-1: #202020;
  --divider-color-2: #333;
  --shadow-1: -6px 8px 24px rgb(0, 0, 0, 0.2),
              -1px 1px 4px rgb(0,0,0,0.05);
  --shadow-2: 6px 8px 24px rgb(0, 0, 0, 0.1),
              1px 1px 4px rgb(0,0,0,0.05);
  --shadow-2__hover: 8px 12px 36px rgb(0, 0, 0, 0.2),
              1px 1px 4px rgb(0,0,0,0.05);
  --shadow-x3: -6px 8px 24px rgb(0, 0, 0, 0.2),
              -1px 1px 4px rgb(0,0,0,0.05);
  --shadow-x4: -6px 8px 24px rgb(0, 0, 0, 0.2),
              -1px 1px 4px rgb(0,0,0,0.05);
  --shadow-x4_hover: -16px 20px 48px rgb(0,0,0,0.3);
  --scrollbar-color: rgb(56, 58, 64, 0.5);
  --app-content-bg-color: var(--bg-color-2);
  --info-panel-preview-container-bg-color: #37474f;
  --info-panel-preview-container-color: #607d8b;
  --nav-panel-color-1: #9e9e9e;
  --nav-panel-color_hover: rgb(120, 144, 156, 0.15);
  --nav-panel-icon-color-1: #78909c;
  --nav-panel-indicator-color: #455a64;
  --nav-panel-item-bg-color_active:rgb(120, 144, 156, 0.05);
  --info-panel-bg-color: var(--bg-color-2);
  --info-panel-shadow: 0px 4px 48px rgb(0,0,0,0.05),
                      0px 4px 2px rgb(0,0,0,0.3);
  --info-panel-title-bg-color: #bdbdbd;
  --note-color-bar-opacity: 0.5;
  --context-menu-shadow: -4px 8px 12px rgb(0,0,0,0.05),
                        -10px 20px 76px rgb(0,0,0,0.4);
  --context-menu-bg-color: var(--bg-color-1);
  --context-menu-bg-color_hover: rgb(255, 255, 255, 0.03);
  --list-menu-bg-color_active: rgb(69, 90, 100, 0.2);
  --dir-item-card-bg: transparent;
  --dir-item-card-border: #111;
  --dir-item-card-border-2: rgb(255, 255, 255, 0.4);
  --dir-item-card-border-3: rgb(255, 255, 255, 0.08);
  --dir-item-card-checkbox-color: rgb(159, 168, 218, 0.6);
  --dir-item-card-icon-color: #9e9e9e;
  --toggle-btn-bg-color: #333;
  --list-item-mask-color: rgb(255, 255, 255, 0.6);
  --blockquote-bg: rgb(232, 234, 246, 0.05);
  --blockquote-border: rgba(56, 124, 170, 0.384);
}

/* STYLES */
#app,
.v-application,
.theme--light.v-card {
  color: var(--color-6) !important;
  font-family: 'Roboto-Regular',
                /* Fix for: some emoji not
                being displayed properly */
                'Segoe UI Emoji',
                'Apple Color Emoji',
                'Droid Sans Fallback',
                'Noto Color Emoji';
}

*:not(.v-icon) {
  /* letter-spacing: 0.5px; */
}

code,
pre {
  font-family: "Lucida Console", Monaco, monospace !important;
  font-size: 18px;
}

html {
  overflow: hidden !important;
}

.app-content {
  background-color: var(--bg-color-1);
  padding-top: var(--header-height) !important;
}

.app-content .v-icon {
  color: var(--icon-color-2);
}

/* Helpers */
.fade-mask--top-and-bottom {
  mask: linear-gradient(transparent, black 10%, black 90%, transparent 100%);
}

.fade-mask--top {
  mask: linear-gradient(to bottom, transparent 0%, black var(--fade-mask-top));
}

.fade-mask--bottom {
  mask: linear-gradient(to top, transparent 0%, black var(--fade-mask-bottom));
}

.fade-mask--bottom--10 {
  mask-image: linear-gradient(to top, transparent 0%, black 10%);
}

.fade-mask--bottom--15 {
  mask-image: linear-gradient(to top, transparent 0%, black 15%);
}

.fade-mask--bottom--25 {
  mask-image: linear-gradient(to top, transparent 0%, black 25%);
}

.fade-mask--bottom--35 {
  mask-image: linear-gradient(to top, transparent 0%, black 35%);
}

.cursor-pointer {
  cursor: pointer;
  user-select: none;
}

.unselectable {
  user-select: none;
}

.opacity-1 {
  opacity: 1;
}

.opacity-0 {
  opacity: 0;
}

.is-hidden {
  display: none !important;
}

/* VUETIFY OVERWRITES */
.v-navigation-drawer,
.window-toolbar__header-container,
.v-toolbar,
.v-footer,
.v-main {
  transition: 0.5s ease !important;
}

button.v-btn.v-btn--disabled
  .v-btn__content,
button.v-btn.v-btn--disabled
  .v-btn__content
    i.v-icon {
      color: var(--color-7) !important;
    }

.v-btn.v-btn--icon {
  color: var(--color-6) !important;
}

.v-badge__badge[size="16"] {
  border-radius: 16px !important;
  font-size: 12px !important;
  height: 16px !important;
  width: 16px !important;
  min-width: 16px !important;
  padding-top: 0px !important;
}

.v-list {
  color: var(--color-6) !important;
}

.v-list-item.v-list-item--active {
  color: var(--color-5) !important;
  background-color: var(--highlight-color-6) !important;
}

.v-list-item:not(.v-list-item--active):not(.v-list-item--disabled) {
  color: var(--color-5) !important;
}

.v-list-item__mask {
  background: var(--list-item-mask-color) !important;
  padding: 4px 2px;
}

.v-messages {
  color: var(--color-7) !important;
}

.v-badge__badge[size="16"] .v-icon {
  height: 0 !important;
}

.inline-code--light {
  border-radius: 4px;
  background: rgb(255, 255, 255, 0.1);
  padding: 3px 6px;
}

.code-block {
  width: 100%;
  overflow-y: auto;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
}

*[shadow~="left"][shadow~="x4"] {
  box-shadow: var(--shadow-x4);
}

*[shadow~="left"][shadow~="x4"]:hover {
  box-shadow: var(--shadow-x4_hover);
}

*[shadow="x3"] {
  box-shadow: var(--shadow-x3) !important;
}

.v-overlay--active,
.v-overlay__scrim {
  backdrop-filter: blur(8px) !important;
}

.v-dialog__content
  .v-icon {
    color: var(--color-6) !important;
  }

.v-tooltip__content {
  color: var(--color-5) !important;
  background: rgba(41, 43, 51, 0.95) !important;
  box-shadow: 0 8px 32px rgb(0,0,0,0.5);
  user-select: none;
}

.v-tooltip__content
  .v-icon {
    color: var(--color-5) !important;
  }

.tooltip__description {
  color: var(--color-5);
  font-size: 15px;
}

.tooltip__shortcut {
  font-size: 14px;
  color: var(--color-6);
}

/* Note: this method doesn't break alignment inside grid */
.truncate-line {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Note: this method breaks alignment inside grid */
.line-clamp-1 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
}

.line-clamp-3 {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  overflow: hidden;
}

/* Scrollbars */
body::-webkit-scrollbar,
html::-webkit-scrollbar,
.custom-scrollbar::-webkit-scrollbar {
  display: none !important;
}

.custom-scrollbar {
  overflow: overlay !important;
}

.custom-scrollbar:hover::-webkit-scrollbar {
  width: 16px;
  display: block !important;
}

#home-route .custom-scrollbar:hover::-webkit-scrollbar {
  display: none !important;
}

.custom-scrollbar::-webkit-scrollbar-thumb:vertical,
.custom-scrollbar::-webkit-scrollbar-thumb:horizontal {
  background-color: var(--scrollbar-color);
  overflow: overlay;
  min-height: 50px;
  background-clip: padding-box;
  border: 6px solid transparent;
}

.custom-scrollbar::-webkit-scrollbar-track:vertical,
.custom-scrollbar::-webkit-scrollbar-track:horizontal {
  background-color: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb:vertical,
.custom-scrollbar::-webkit-scrollbar-thumb:horizontal {
  background-color: transparent;
}

.custom-scrollbar:hover::-webkit-scrollbar-thumb:vertical,
.custom-scrollbar:hover::-webkit-scrollbar-thumb:horizontal {
  background-color: var(--scrollbar-color);
  /* border: 2px solid transparent */
}

.custom-scrollbar::-webkit-scrollbar-thumb:vertical:hover,
.custom-scrollbar::-webkit-scrollbar-thumb:horizontal:hover {
  background-color: var(--scrollbar-color);
  border: 1px solid transparent
}

.custom-scrollbar::-webkit-scrollbar-thumb:vertical:active,
.custom-scrollbar::-webkit-scrollbar-thumb:horizontal:active {
  background-color: var(--scrollbar-color);
  border: 1px solid transparent
}

/* Override scome scrollbar styles */
.v-list-item__action:last-of-type:not(:only-child) {
  margin-left: 4px !important;
}

.v-list-item__action {
  margin: 8px 0px !important;
}

.v-navigation-drawer__content {
  overflow: hidden !important;
}

.v-navigation-drawer--fixed {
  z-index: 0 !important;
}

/* General list menues */
.list-menu__title {
  display: flex;
  justify-content: space-between;
  align-content: center;
  padding: 8px 8px;
}

/* Menu & menu > list */
.context-menu__container {
  background: var(--context-menu-bg-color) !important;
}

.v-menu__content {
  box-shadow: var(--context-menu-shadow) !important;
  z-index: 10;
}

.v-menu__content .v-list {
  background: var(--context-menu-bg-color) !important;
  border-radius: 0 !important;
}

.v-list-item__action:first-child,
.v-list-item__icon:first-child {
  margin-right: 16px !important;
}

.v-list-item__title {
  font-size: 14px !important;
  color: var(--color-6) !important;
}

.v-list-item .v-icon {
  color: var(--color-6) !important;
}

.v-menu__content .v-list-item:not(.inactive) .v-list-item__content,
.v-menu__content .v-list-item:not(.inactive) .v-list-item__title,
.v-menu__content .v-list-item:not(.inactive) .v-icon {
  color: var(--color-6) !important;
}

.v-menu__content .v-list-item:not(.inactive):hover {
  background-color: var(--context-menu-bg-color_hover);
}

.v-menu__content .v-divider {
  border-color: var(--divider-color-1) !important;
}

.v-menu__content .v-list-item[is-active='true'] {
  background-color: var(--list-menu-bg-color_active) !important;
}

/* .v-menu__content .v-list-item .v-list-item__content {
  color: var(--color-5) !important;
} */

.v-list-item .v-list-item__subtitle {
  color: var(--color-7) !important;
}

.v-input--radio-group--column .v-input--radio-group__input {
  /* FIX: tooltips are centered to the container because input items
    stretch to the whole width of the container */
  align-items: flex-start;
}

/* Misc components */
.divider-color-1 {
  border-color: var(--divider-color-1) !important;
}

.divider-color-2 {
  border-color: var(--divider-color-2) !important;
}

/* Cards */
.v-card {
  background-color: var(--bg-color-1) !important
}

/* Nav panel */
.nav-panel__main-content {
  overflow-y: overlay !important;
  overflow-x: hidden !important;
}

.nav-panel__main-content::-webkit-scrollbar-track:vertical,
.nav-panel__main-content::-webkit-scrollbar-track:horizontal {
  background-color: transparent;
}

.nav-panel__main-content::-webkit-scrollbar-thumb:vertical,
.nav-panel__main-content::-webkit-scrollbar-thumb:vertical:hover,
.nav-panel__main-content::-webkit-scrollbar-thumb:vertical:active {
  background-color: var(--scrollbar-color);
  border: none;
}

.nav-panel__main-content::-webkit-scrollbar:vertical {
  width: 6px !important
}

.qr-code {
  height: 96px;
  width: 96px;
  flex-shrink: 0;
}

/* Fix for jumping content */
/* .custom-scrollbar {
}
.custom-scrollbar:hover {
  padding-right: 10px !important;
} */

/* Simplebar scrollbars */
/* .simplebar-scrollbar:before {
  background: var(--scrollbar-color) !important;
  border-radius: 1px !important;
}

.simplebar-track.simplebar-vertical.simplebar-hover .simplebar-scrollbar:before {
  border-radius: 4px !important;
}

.simplebar-track.simplebar-vertical {
  width: 5px !important;
  margin-right: 4px;
  transition: all 0.2s;
  overflow: auto;
}

.simplebar-track.simplebar-vertical.simplebar-hover {
  width: 12px !important;
  margin-right: 2px;
  transition: all 0.2s;
} */

/* THEMES | overlay-scrollbars */
/* os-theme-minimal-light */
.os-theme-minimal-light
   > .os-scrollbar {
    padding: 0px;
  }

.os-theme-minimal-light
   > .os-scrollbar-horizontal {
    right: 16px;
    height: 16px;
  }

.os-theme-minimal-light
   > .os-scrollbar-vertical {
    bottom: 16px;
    width: 16px;
  }

.os-theme-minimal-light.os-host-rtl
   > .os-scrollbar-horizontal {
    left: 16px;
    right: 0;
  }

.os-theme-minimal-light
   > .os-scrollbar-corner {
    height: 16px;
    width: 16px;
    background-color: transparent;
  }

.os-theme-minimal-light
   > .os-scrollbar
   > .os-scrollbar-track,
.os-theme-minimal-light
   > .os-scrollbar
   > .os-scrollbar-track
   > .os-scrollbar-handle {
    background: transparent;
  }

.os-theme-minimal-light
   > .os-scrollbar
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    content: '';
    display: block;
    position: absolute;
    width: 100%;
    height: 100%;
    left: 0;
    top: 0;
    background: rgb(56, 58, 64);
    opacity: 0.6;
  }

.os-theme-minimal-light
   > .os-scrollbar
   > .os-scrollbar-track
   > .os-scrollbar-handle:hover:before {
    opacity: 0.7;
  }

.os-theme-minimal-light
   > .os-scrollbar
   > .os-scrollbar-track
   > .os-scrollbar-handle.active:before {
    opacity: 0.8;
  }

.os-theme-minimal-light
   > .os-scrollbar-horizontal
   > .os-scrollbar-track
   > .os-scrollbar-handle {
    min-width: 32px;
  }

.os-theme-minimal-light
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle {
    min-height: 32px;
  }

.os-theme-minimal-light
   > .os-scrollbar-horizontal
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    height: 6px;
    bottom: 0;
    top: auto;
  }

.os-theme-minimal-light
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    margin-right: 4px;
    width: 6px;
    right: 0;
    left: auto;
  }

.os-theme-minimal-light.os-host-rtl
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    left: 0;
    right: auto;
  }

.os-theme-minimal-light
   > .os-scrollbar-horizontal
   > .os-scrollbar-track
   > .os-scrollbar-handle:hover:before,
.os-theme-minimal-light
   > .os-scrollbar-horizontal
   > .os-scrollbar-track
   > .os-scrollbar-handle.active:before {
    height: 100%;
  }

.os-theme-minimal-light
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle:hover:before,
.os-theme-minimal-light
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle.active:before {
    width: 100%;
  }

.os-theme-minimal-light.os-host-transition
   > .os-scrollbar-horizontal
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    transition: opacity 0.3s, height 0.3s;
  }

.os-theme-minimal-light.os-host-transition
   > .os-scrollbar-vertical
   > .os-scrollbar-track
   > .os-scrollbar-handle:before {
    transition: opacity 0.3s, width 0.3s;
  }

/* Style overrides */
i {
  font-style: unset;
}
.v-list {
  padding: 0px !important;
}

.v-card__text {
  color: unset !important;
}

.v-toolbar__content {
  padding: 0px !important;
}

/* .v-toolbar__content .v-btn.v-btn--icon.v-size--default { */
.v-btn.v-btn--icon.v-size--default {
  width: var(--window-toolbar-height) !important;
  height: var(--window-toolbar-height) !important;
}

#window-toolbar
  .window-toolbar__content--main,
#action-toolbar
  .v-toolbar__content {
    padding: 0px 8px 0px 8px !important;
  }

/* .remove-padding-top {
  padding-top: 0 !important;
} */

.v-btn.button-1 {
  background: var(--button-bg-color-1) !important;
  color: var(--button-color-1) !important;
  box-shadow: none;
}

.v-btn.button-2 {
  background: var(--button-bg-color-2) !important;
  color: var(--button-color-2) !important;
  box-shadow: none;
}

.text--title-1 {
  font-size: 28px;
  color: var(--title-color-1);
}

.text--title-2 {
  font-size: 20px;
  color: var(--title-color-1);
}

.text--sub-title-1 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--sub-title-color-1);
  text-transform: uppercase;
  user-select: none;
}

.text--sub-title-2 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--color-5);
}

.content__description {
  font-size: 16px;
  margin-bottom: 8px;
  line-height: 1.5;
  word-break: break-word;
  color: var(--sub-title-color-1);
}

/* ==== GENERAL COMPONENTS ==== */
.overlay--drag-over {
  position: absolute;
  width: 100%;
  height: 100%;
  z-index: 1;
  border: 2px dashed rgb(255, 255, 255, 0.5);
  border-radius: inherit;
  opacity: 0;
  transition: all 1s;
}

.overlay--drag-over.is-visible {
  opacity: 1;
  transition: all 0.1s;
}

.app-content {
  background-color: var(--app-content-bg-color);
  padding-top: var(--header-height) !important;
}

.list-item__checkbox {
  z-index: 3;
  right: 0;
  opacity: 0;
  transition: all 0.5s;
}

.list-item__checkbox[data-selected="true"] {
  opacity: 1;
}

/* Dir-item */
.dir-item__checkbox {
  z-index: 3;
  opacity: 0;
  pointer-events: none;
  transition: all 0.5s;
}

.dir-item__checkbox[data-selected="true"] {
  pointer-events: unset;
  opacity: 1;
}

.custom-divider {
  padding: 18px 0px;
  border-top: 1px solid;
  width: 100%;
  border-width: thin;
  border-color: var(--highlight-color-2)
}

.custom-divider[vertical] {
  margin: 0px 4px;
  height: 20px;
  width: 2px;
  background-color: var(--highlight-color-2)
}

/* Content area */
.content-area {
  padding: 8px 24px;
  height: calc(100vh - var(--window-toolbar-height) - var(--action-toolbar-height));
  overflow-y: overlay;
  user-select: none;
}

.content-area__title {
  font-size: 28px;
  color: var(--title-color-1);
}

/* Content card */
.content-card {
  padding: 20px 24px;
  margin: 16px 0px;
  background-color: var(--bg-color-1);
  box-shadow: 0px 8px 32px rgb(0, 0, 0, 0.1);
}

.theme--light.v-btn.v-btn--disabled {
  opacity: 0.5;
}

.theme--light.v-btn.v-btn--disabled
  .v-icon.css-override {
    color: var(--icon-color-2) !important;
}

/* inputs */
.v-input .v-messages {
  font-size: 14px;
}

.v-input:not(.v-input--is-disabled)
  input,
.v-input:not(.v-input--is-disabled)
  textarea {
    color: var(--color-5) !important;
  }

/* .v-input:not(.v-input--is-disabled) input,
.v-input:not(.v-input--is-disabled) textarea {
  color: var(--color-6) !important;
} */

.v-input
  .v-label {
    color: var(--radio-text-color-1) !important;
}

.v-input--is-label-active
  .v-input--switch__track {
    background: var(--input_active-track-color-1) !important;
}

.v-input--is-label-active
  .v-input--switch__thumb {
    background: var(--input_active-thumb-color-1) !important;
  }

.v-input--switch__track {
  background: var(--input-track-color-1) !important;
}

.v-input--switch__thumb {
  background: var(--input-thumb-color-1) !important;
}

.v-text-field__slot
  label.v-label--active {
    color: var(--color-1) !important;
  }

.v-text-field__slot {
  caret-color: var(--color-1) !important
}

.theme--light.v-text-field >
  .v-input__control >
    .v-input__slot:before {
        border-color: var(--color-8) !important;
    }

.v-input.v-input--is-focused
  * {
    color: var(--color-5) !important;
  }

.v-input.v-input--is-focused
  .v-messages__message {
    color: var(--color-5) !important;
  }

.v-input.error--text
  .v-messages__message {
    color: #ef5350 !important;
  }

.v-input.v-input--is-disabled
  input {
    color: var(--color-7) !important;
  }

.v-chip--select.v-chip
  * {
    color: var(--color-5) !important;
  }

.v-chip.v-chip--active {
    background: var(--highlight-color-2) !important;
}

.v-chip:not(.v-chip--active) {
    background: var(--highlight-color-3) !important;
}

/* v-text-field */
.v-input.v-input--is-label-active.v-text-field.v-select
  * {
    color: var(--color-6) !important;
  }

.v-input.v-text-field
  .v-label {
    color: var(--color-7) !important;
  }

.v-input.v-text-field.v-input--is-focused
  .v-label {
    color: var(--color-5) !important;
  }

.workspace-action__card {
  padding: 12px 0px;
  margin: 12px 0px;
}

.v-input.theme--light.v-input--selection-controls
  .v-input--selection-controls__input
    * {
      color: var(--key-color-1) !important;
    }

.v-input.theme--light.v-input--selection-controls
  .v-input--selection-controls__input
    i.mdi-radiobox-blank {
      color: var(--color-7) !important;
    }

.v-application--is-ltr
  .v-input--selection-controls__input {
    margin-right: 12px !important;
  }

.v-input__slider .v-slider__thumb,
.v-input__slider .v-slider__thumb-container-fill {
  color: var(--key-color-1) !important;
  background: var(--key-color-1) !important;
  background-color: var(--key-color-1) !important
}

.v-input__slider .v-slider__track-background,
.v-input__slider .v-slider__track-fill {
  color: var(--highlight-color-2) !important;
  background: var(--highlight-color-2) !important;
  background-color: var(--highlight-color-2) !important
}

.button-container {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.tab-view {
  display: grid;
  grid-template-columns: 230px 1fr;
  background-color: var(--bg-color-1);
}
@media (max-width: 700px) {
  .tab-view {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background-color: var(--bg-color-1);
  }
}

.tab-view
  .tab-view__header {
    position: sticky;
    top: 0px;
    height: fit-content;
    z-index: 2;
    background-color: var(--bg-color-1);
  }

.tab-view
  .tab-view__header {
    position: sticky;
    height: fit-content;
    top: -8px;
    background-color: var(--bg-color-1);
    z-index: 2;
  }
  @media (min-width: 700px) {
    .tab-view
      .tab-view__header
        .v-tab {
          width: 100%;
          justify-content: flex-start;
          padding-left: 24px;
        }
  }

.tab-view
  .tab-view__header
    .v-tabs--vertical >
      .v-tabs-bar
        .v-tabs-bar__content {
          align-items: flex-start;
        }

.tab-view
  .tab-view__header__content {
    padding: 0px 24px;
    border-left: 1px solid #2F3137;
  }
  @media (max-width: 700px) {
    .tab-view
      .tab-view__header__content {
        padding: 0px 12px;
        border-left: none;
      }
  }

.tab-view h3 {
  margin-top: 16px;
  margin-bottom: 4px;
}

.tab-view img {
  object-fit: contain;
  max-width: 100%;
  border: 2px solid var(--highlight-color-3);
  box-shadow: 0px 8px 48px rgb(0, 0, 0, 0.3);
  margin: 16px 0;
  display: block;
}

.v-window.v-item-group.v-tabs-items {
  overflow: visible;
}

.v-tabs >
  .v-tabs-bar {
    background-color: rgb(96, 125, 139, 0.0) !important
  }

.v-tabs-items {
  background-color: transparent !important;
}

.v-tabs > .v-tabs-bar .v-tab.v-tab--active {
  color: rgb(255, 255, 255, 0.6) !important;
  background-color: rgb(255, 255, 255, 0.05) !important
}

.v-tabs > .v-tabs-bar .v-tab:not(.v-tab--active),
.v-tabs > .v-tabs-bar .v-tab:not(.v-tab--active) .v-icon,
.v-tabs .v-slide-group__next .v-icon,
.v-tabs .v-slide-group__prev .v-icon {
  color: rgb(255, 255, 255, 0.3) !important
}

/* Transitions */
@keyframes fade-in-slide-up {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; }
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scale-in {
  from { transform: scale(0.95) }
  to { transform: scale(1) }
}

@keyframes scale-120-percent-to-initial {
  from { transform: scale(1.2) }
  to { transform: scale(1) }
}

.fade-in-slide-up-500ms {
  animation: fade-in-slide-up 500ms;
}

.fade-in-200ms {
  animation: fade-in 200ms;
}

.fade-in-500ms {
  animation: fade-in 500ms;
}

.fade-in-1s {
  animation: fade-in 1s;
}

.fade-in-2s {
  animation: fade-in 2s;
}

.fade-scale-in-500ms {
  animation: fade-in 500ms, scale-in 500ms;
}

.fade-in-2s-scale-in-500ms {
  animation: fade-in 2s, scale-in 500ms;
}

.fade-in-2000ms-scale-120-percent-to-initial-2000ms {
  animation: fade-in 2000ms, scale-120-percent-to-initial 2000ms;
}

.route-transition-enter-active {
  transition: all 0.3s ease;
}

.route-transition-leave-active {
  transition: all 0.3s ease;
}

.route-transition-enter,
.route-transition-leave-to {
  opacity: 0;
}

.context-menu-transition-enter-active {
  transition: all 0.2s ease;
}

.context-menu-transition-leave-active {
  transition: all 0s;
}

.context-menu-transition-enter,
.context-menu-transition-leave-to {
  opacity: 0;
  transform:
    scale(0.1)
    /* Prevent tooltip showing up during animation*/
    translateX(16px);
}

.context-sub-menu-transition-enter-active {
  transition: all 0.2s ease;
}

.context-sub-menu-transition-leave-active {
  transition: all 0.2s ease;
}

.context-sub-menu-transition-enter {
  transform: translateX(20px);
  opacity: 0;
}

.context-sub-menu-transition-leave-to {
  transform: translateX(-20px);
  opacity: 0;
}

.context-sub-menu-transition-reversed-enter-active {
  transition: all 0.2s ease;
}

.context-sub-menu-transition-reversed-leave-active {
  transition: all 0.2s ease;
}

.context-sub-menu-transition-reversed-enter {
  transform: translateX(-20px);
  opacity: 0;
}

.context-sub-menu-transition-reversed-leave-to {
  transform: translateX(20px);
  opacity: 0;
}

.fade-in-enter-active {
  transition: all 0.2s ease;
}

.fade-in-leave-active {
  transition: all 0.2s ease;
}

.fade-in-enter,
.fade-in-leave-to {
  transition: all 0.2s ease;
  opacity: 0;
}

.fade-in-1s-enter-active {
  transition: all 1s ease;
}

.fade-in-1s-leave-active {
  transition: all 1s ease;
}

.fade-in-1s-enter,
.fade-in-1s-leave-to {
  opacity: 0;
}

.slide-fade-left-enter-active {
  transition: all 0.2s ease;
}

.slide-fade-left-leave-active {
  transition: all 0.2s ease;
}

.slide-fade-left-enter,
.slide-fade-left-leave-to {
  transform: translateX(-10px);
  opacity: 0;
}

.group-fade-in-enter-active,
.group-fade-in-leave-active {
  transition: all 0.5s;
}

.group-fade-in-enter,
.group-fade-in-leave-to {
  position: absolute;
  opacity: 0;
}

.group-slide-fade-left-enter-active,
.group-slide-fade-left-leave-active {
  transition: all 0.5s;
}

.group-slide-fade-left-enter,
.group-slide-fade-left-leave-to {
  position: absolute;
  transform: translateX(-10px);
  opacity: 0;
}

.slide-fade-up-enter-active,
.slide-fade-up-leave-active {
  transition: all 1.5s;
}

.slide-fade-up-enter,
.slide-fade-up-leave-to {
  transition: all 1.5s;
  transform: translateY(16px);
  opacity: 0;
}

.slide-fade-up-300ms-enter-active,
.slide-fade-up-300ms-leave-active {
  transition: all 0.3s;
}

.slide-fade-up-300ms-enter,
.slide-fade-up-300ms-leave-to {
  transition: all 0.3s;
  transform: translateY(16px);
  opacity: 0;
}

.slide-fade-down-500ms-enter-active,
.slide-fade-down-500ms-leave-active {
  transition: all 0.5s;
}

.slide-fade-down-500ms-enter,
.slide-fade-down-500ms-leave-to {
  transition: all 0.5s;
  transform: translateY(-16px);
  opacity: 0;
}

.slide-fade-down-300ms-enter-active,
.slide-fade-down-300ms-leave-active {
  transition: all 0.3s;
}

.slide-fade-down-300ms-enter,
.slide-fade-down-300ms-leave-to {
  transition: all 0.3s;
  transform: translateY(-36px);
  opacity: 0;
}

.overlay--item-drag__transition-enter-active {
  /* Remove enter animation to
  prevent position change lag */
  transition: all 0s;
}

.overlay--item-drag__transition-leave-active {
  transition: all 0.3s;
}

.overlay--item-drag__transition-enter {
  transition: all 0.3s ease;
  transform: scale(0.6);
  opacity: 0;
}

.overlay--item-drag__transition-leave-to {
  transition: all 0.3s ease;
  transform: scale(0.6) translateX(-64px) translateY(-32px);
  opacity: 0;
}
</style>
