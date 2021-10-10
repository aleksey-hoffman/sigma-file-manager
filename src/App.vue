<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <v-app 
    :data-theme-type="themeType" 
    :route-name="$route.name" 
    :display-accent-color-backgrounds="displayAccentColorBackgrounds" 
  >
    <window-toolbar/>
    <action-toolbar/>
    <navigation-panel/>
    <notification-manager/>
    <overlays/>
    <clipboard-toolbar/>
    <dialogs v-if="appIsLoaded"/>
    <window-effects/>
    <fs-local-server-manager/>

    <!-- app-content-area -->
    <v-main class="app-content">
      <keep-alive 
        :include="['home', 'settings']"
      >
        <router-view/>
      </keep-alive>
    </v-main>
  </v-app>
</template>

<script>
console.time('time::App.vue::Imports')
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import {DriveWalker} from './utils/driveWalker.js'
import GlobalSearchWorker from 'worker-loader!./workers/globalSearchWorker.js'
import DirWatcherWorker from 'worker-loader!./workers/dirWatcherWorker.js'
import TimeUtils from './utils/timeUtils.js'
import {getStorageDevices} from './utils/storageInfo.js'
import idleJs from 'idle-js'
import * as notifications from './utils/notifications.js'

const electron = require('electron')
const PATH = require('path')
const fs = require('fs')
const fsExtra = require('fs-extra')
const fsInfo = require('./utils/fsInfo.js')
const mousetrap = require('mousetrap')
const childProcess = require('child_process')
const zlib = require('zlib')
console.timeEnd('time::App.vue::Imports')

export default {
  name: 'App',
  watch: {
    $route (to, from) {
      this.contextMenus.dirItem.value = false
      this.$store.dispatch('TERMINATE_ALL_FETCH_DIR_SIZE')
      if (to.name === 'home') {
        this.preventHomeViewLayoutTransition()
        this.animateHomeBannerIn()
      }
      if (from.name === 'home') {
        this.animateHomeBannerOut()
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
      if (value) {
        if (this.inputState.pointer.hover.itemType = 'dirItem') {
          this.$store.dispatch('HANDLE_HIGHLIGHT_DIR_ITEM_RANGE', {
            hoveredItem: this.inputState.pointer.hover.item
          })
        }  
      }
      else {
        this.$store.dispatch('DEHIGHLIGHT_ALL_DIR_ITEMS')
      }
    },
    themeType () {
      this.setCSSAttributes('visual-filters')
    },
    visualFiltersApplyFiltersToMediaElements () {
      this.setCSSAttributes('visual-filters')
    },
    visualFiltersContrastValue () {
      this.setCSSAttributes('visual-filters')
    },
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
      electron.ipcRenderer.invoke('main-window-loaded')
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
      firstTimeActions: 'storageData.settings.firstTimeActions',
      lastSearchScanTime: 'storageData.settings.time.lastSearchScan',
      globalSearchAutoScanIntervalTime: 'storageData.settings.globalSearchAutoScanIntervalTime',
      UIZoomLevel: 'storageData.settings.UIZoomLevel',
      thumbnailStorageLimit: 'storageData.settings.thumbnailStorageLimit',
      focusMainWindowOnDriveConnected: 'storageData.settings.focusMainWindowOnDriveConnected',
      pointerButton3: 'storageData.settings.input.pointerButtons.button3',
      pointerButton4: 'storageData.settings.input.pointerButtons.button4',
      animations: 'storageData.settings.animations',
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
      displayAccentColorBackgrounds: 'storageData.settings.displayAccentColorBackgrounds',
      visualFiltersApplyFiltersToMediaElements: 'storageData.settings.visualFilters.applyFiltersToMediaElements',
      visualFiltersContrastValue: 'storageData.settings.visualFilters.contrast.value',
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
    },
  },
  methods: {
    setCSSAttributes (name) {
      if (name === 'visual-filters') {
        let htmlNode = document.querySelector('html')
        let invertInverse = this.themeType === 'light-filter' ? 1 : 0
        let hueRotateInverse = this.themeType === 'light-filter' ? '180deg' : '0deg'
        let contrastInverse = this.visualFiltersApplyFiltersToMediaElements
          ? this.visualFiltersContrastValue
          : 1 + (1 - this.visualFiltersContrastValue)

        htmlNode.style.setProperty('--visual-filter-invert', this.themeType === 'light-filter' ? 1 : 0)
        htmlNode.style.setProperty('--visual-filter-hue-rotate', this.themeType === 'light-filter' ? '180deg' : '0deg')
        htmlNode.style.setProperty('--visual-filter-contrast', this.visualFiltersContrastValue)

        htmlNode.style.setProperty('--visual-filter-invert-inverse', invertInverse)
        htmlNode.style.setProperty('--visual-filter-hue-rotate-inverse', hueRotateInverse)
        htmlNode.style.setProperty('--visual-filter-contrast-inverse', contrastInverse)
      }
    },
    initEventHubListeners () {
      this.$eventHub.$on('app:method', payload => {
        this[payload.method](payload.params)
      })
    },
    initIPCListeners () {
      electron.ipcRenderer.on('open-global-search', (event, data) => {
        this.$store.dispatch('TOGGLE_GLOBAL_SEARCH')
      })

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
        notifications.emit({
          name: 'quickViewFileIsNotSupported',
          props: {
            data
          }
        })
      })

      electron.ipcRenderer.on('download-file-progress', (event, data) => {
        const isDone = data.receivedBytes === data.totalBytes
        data.isDone = isDone
        data.started = data.percentDone > 0
        if (isDone) {
          notifications.emit({
            name: 'fileDownloadIsDone',
            props: {
              data,
              electron,
              store: this.$store
            }
          })
        }
        else {
          if (data.isPaused) {
            notifications.emit({
              name: 'fileDownloadIsPaused',
              props: {
                data,
                electron,
                store: this.$store
              }
            })
          }
          else {
            notifications.emit({
              name: 'fileDownloadIsInProgress',
              props: {
                data,
                electron,
                store: this.$store
              }
            })
          }
        }
      })
    },
    checkForAppUpdateInstalled () {
      this.$store.dispatch('CHECK_IF_UPDATE_INSTALLED')
    },
    bindKeyEvents () {
      this.bindMouseKeyEvents()
      this.bindGeneralKeyEvents()
      this.bindGeneralMousetrapEvents()
    },
    initWindowErrorHandler () {
      window.addEventListener('error', (event) => {
        const disallowedErrors = [
          'ResizeObserver loop limit exceeded'
        ]
        if (!disallowedErrors.includes(event.message)) {
          const hashID = this.$utils.getHash()
          this.$eventHub.$emit('notification', {
            action: 'add',
            hashID,
            colorStatus: 'red',
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
        notifications.emit({name: 'driveWasConnected'})
      }
    },
    async extractAppBinaries () {
      // Moving binaries to app storage because fs.childProcess.spawn
      // and other modules cannot access it from within app.asar
      const isEnvProduction = process.env.NODE_ENV === 'production'
      if (isEnvProduction) {
        try {
          await fs.promises.access(this.appPaths.bin7Zip, fs.constants.F_OK)
          await fs.promises.access(this.appPaths.binFFMPEG, fs.constants.F_OK)
          await fs.promises.access(this.appPaths.binYoutubeDl, fs.constants.F_OK)
        }
        catch (error) {
          await fsExtra.copy(
            this.appPaths.resourcesBin, 
            this.appPaths.storageDirectories.appStorageBin
          )
          if (process.platform !== 'win32') {
            this.getAppStorageBinDirPermissions()
          }
        }
      }
    },
    getAppStorageBinDirPermissions () {
      const commandGetBinDirPermissionsRecursive = `chmod -R u+rwx "${this.appPaths.storageDirectories.appStorageBin}"`
      childProcess.exec(commandGetBinDirPermissionsRecursive, (error) => {
        if (error) {
          notifications.emit({
            name: 'getAppStorageBinDirPermissionsError',
            props: {
              error
            }
          })
        }
      })
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
          task.props.scans[index].readStream = new DriveWalker(
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
    preventHomeViewLayoutTransition () {
      // This function prevents home banner layout shifting
      // when transitioning from a view with an opened info panel
      let appNode = document.querySelector('#app')
      appNode.classList.add('layout-no-transition')
      setTimeout(() => {
        appNode.classList.remove('layout-no-transition')
      }, 500)
    },
    initGlobalSearchWorker (params, workerObject) {
      return new Promise((resolve, reject) => {
        // Handle interrupted search scan
        if (this.globalSearchScanWasInterrupted) {
          // Re-scan search data
          this.$eventHub.$emit('app:method', {
            method: 'initGlobalSearchDataScan'
          })
          noЯtifications.emit({name: 'searchFileIsDamaged'})
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
            if (error.message === 'Uncaught Error: unexpected end of file') {
              this.$eventHub.$emit('app:method', {
                method: 'initGlobalSearchDataScan'
              })
              notifications.emit({name: 'searchFileIsDamaged'})
            }
          }
          resolve()
        }
      })
    },
    initGlobalSearchWorkerAction (params) {
      let workerObject = this.$store.state.workers.globalSearchWorkers.find(item => item.mount === params.mount)
      if (params.action === 'cancel') {
        if (workerObject) {
          workerObject.worker.postMessage({action: 'cancel'})
        }
      }
      else if (params.action === 'search') {
        // If an ongoing worker exist
        if (workerObject) {
          workerObject.worker.postMessage({action: 'cancel'})
          setTimeout(() => {
            // Re-init worker
            workerObject.worker = new GlobalSearchWorker()
            this.execGlobalSearchWorkerAction(params, workerObject)
          }, 50)
        }
        // If worker does not exist
        else {
          let newWorkerObject = {
            mount: params.mount,
            worker: new GlobalSearchWorker()
          }
          this.$store.state.workers.globalSearchWorkers.push(newWorkerObject)
          this.execGlobalSearchWorkerAction(params, newWorkerObject)
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
      // so this.firstTimeActions.appLaunch is always true
      return
      if (this.firstTimeActions.appLaunch) {
        this.$store.dispatch('SET', {
          key: 'storageData.settings.firstTimeActions.appLaunch',
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
            let updatedValue = {}
            if (this.$utils.getDataType(value) === 'object' && this.$utils.getDataType(propertyInStore) === 'object') {
              updatedValue = Object.assign({}, propertyInStore, value)
            }
            else {
              updatedValue = value
            }
            // Update store. Write updated settings back to the storage file
            await this.$store.dispatch('SET', {
              key,
              value: updatedValue,
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
        this.animateHomeBannerIn()
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
    animateHomeBanner (params) {
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
        targetNode.style.transform = params.transform
      }
      catch (error) {}
    },
    animateHomeBannerIn () {
      this.$nextTick(() => {
        this.animateHomeBanner({transform: 'scale(1)'})
      })
    },
    animateHomeBannerOut () {
      if (this.animations.onRouteChangeMediaBannerIn) {
        this.animateHomeBanner({transform: 'scale(1.2)'})
      }
      else {
        this.animateHomeBanner({transform: 'scale(1)'})
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
    async handleThumbCacheRemoval () {
      let appStorageNavigatorThumbsDirPath = this.appPaths.storageDirectories.appStorageNavigatorThumbs
      try {
        let appThumbDirSizeInBytes = await fsInfo.getDirItemTotalSize([appStorageNavigatorThumbsDirPath])
        let appThumbDirSizeLimitInBytes = this.thumbnailStorageLimit * 1024 * 1024
        let appThumbDirSizeLimitReadable = this.$utils.prettyBytes(appThumbDirSizeLimitInBytes)
        let appThumbDirSizeLimitExceeded = appThumbDirSizeInBytes > appThumbDirSizeLimitInBytes
        if (appThumbDirSizeLimitExceeded) {
          let dirent = await this.$store.dispatch('FETCH_DIR_ITEM_INFO', appStorageNavigatorThumbsDirPath)
          await this.$store.dispatch('DELETE_DIR_ITEMS', {
            items: [dirent],
            options: {
              skipSafeCheck: true,
              silent: true
            }
          })
          notifications.emit({
            name: 'removeAppThumbsDirSuccess',
            props: {
              thumbDirSizeLimit: appThumbDirSizeLimitReadable
            }
          })
        }
      }
      catch (error) {
        if (error.code === 'ENOENT') {return}
        notifications.emit({
          name: 'removeAppThumbsDirError',
          props: {
            thumbDirPath: appStorageNavigatorThumbsDirPath,
            error
          }
        })
      }
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
    bindMouseKeyEvents () {
      window.addEventListener('mouseup', this.mouseupHandler)
    },
    mouseupHandler (mouseupEvent) {
      if (mouseupEvent.button === 3) {
        if (this.pointerButton3.onMouseUpEvent.action !== 'default') {
          mouseupEvent.preventDefault()
          this.$store.dispatch(this.pointerButton3.onMouseUpEvent.action)
        }
      }
      else if (mouseupEvent.button === 4) {
        if (this.pointerButton4.onMouseUpEvent.action !== 'default') {
          mouseupEvent.preventDefault()
          this.$store.dispatch(this.pointerButton4.onMouseUpEvent.action)
        }
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
              value.action.options = this.navigationPanel.items[index - 1]
              this.$store.dispatch('SHORTCUT_ACTION', { event, value })
            }, 'keydown')
          }
          else {
            // Bind specified action to shortcuts
            if (!value.isReadOnly) {
              // Add additional (duplicate) listeners
              let shortcut = value.shortcut
              if (value.shortcut === 'ctrl++') {
                shortcut = ['ctrl++', 'ctrl+=']
              }
              mousetrap.bind(shortcut, (event) => {
                this.$store.dispatch('SHORTCUT_ACTION', { event, value })
              }, value.eventName ?? 'keydown')
            }
          }
        }
      }
    }
  }
}
</script>

<style>
@import url('./styles/globalFonts.css');
@import url('./styles/globalVariables.css');
@import url('./styles/globalVuetifyOverrides.css');
@import url('./styles/globalHelpers.css');
@import url('./styles/globalTransitions.css');
@import url('./styles/scrollbars.css');

html {
  overflow: hidden !important;
  filter:
    invert(var(--visual-filter-invert)) 
    hue-rotate(var(--visual-filter-hue-rotate)) 
    contrast(var(--visual-filter-contrast)) 
}

img,
picture,
video,
.media-banner__inner__container--left,
.overlay--window-transparency-effect__media,
#loading-screen__container,
#app[route-name='home'] 
  .window-toolbar__item {
    filter: 
      invert(var(--visual-filter-invert-inverse)) 
      hue-rotate(var(--visual-filter-hue-rotate-inverse)) 
      contrast(var(--visual-filter-contrast-inverse)) 
  }

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

code,
pre {
  font-family: "Lucida Console", Monaco, monospace !important;
  font-size: 18px;
}

.app-content {
  padding-top: var(--header-height) !important;
  background-color: var(--app-content-bg-color);
}

.app-content 
  .v-icon {
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

.tooltip__shortcut-list-item {
  margin-bottom: 8px;
}

.tooltip__modifier-list-item {
  margin-bottom: 8px;
}

.tooltip__modifier-list__title {
  margin-top: 8px;
  font-size: 12px;
  text-transform: uppercase;
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

.list-menu__title {
  display: flex;
  justify-content: space-between;
  align-content: center;
  padding: 8px 8px;
}

.context-menu__container {
  background: var(--context-menu-bg-color) !important;
}

.divider-color-1 {
  border-color: var(--divider-color-1) !important;
}

.divider-color-2 {
  border-color: var(--divider-color-2) !important;
}

.qr-code {
  height: 96px;
  width: 96px;
  flex-shrink: 0;
}

i {
  font-style: unset;
}

#window-toolbar
  .window-toolbar__content--main,
#action-toolbar
  .v-toolbar__content {
    padding: 0px 8px 0px 8px !important;
  }

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

.list-item__checkbox {
  z-index: 3;
  right: 0;
  opacity: 0;
  transition: all 0.5s;
}

.list-item__checkbox[data-selected="true"] {
  opacity: 1;
}

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

.content-card {
  padding: 20px 24px;
  margin: 16px 0px;
  background-color: var(--bg-color-1);
  box-shadow: 0px 8px 32px rgb(0, 0, 0, 0.1);
}

.workspace-action__card {
  padding: 12px 0px;
  margin: 12px 0px;
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
    z-index: 2;
    position: sticky;
    height: fit-content;
    top: -8px;
    background-color: var(--bg-color-1);
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
</style>
