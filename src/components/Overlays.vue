<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <dir-item-drag-overlay :overlapped-drop-target="overlappedDropTarget" />
    <inbound-drag-overlay :overlapped-drop-target="overlappedDropTarget" />
  </div>
</template>

<script>
import {mapFields} from 'vuex-map-fields'
import {mapGetters} from 'vuex'
import InboundDragOverlay from '@/components/Overlays/Drag/Inbound/index.vue'
import DirItemDragOverlay from '@/components/Overlays/Drag/DirItem/index.vue'
import * as notifications from '@/utils/notifications.js'
import TimeUtils from '@/utils/timeUtils.js'

const electron = require('electron')
const electronRemote = require('@electron/remote')
const request = require('request')
const supportedFormats = require('@/utils/supportedFormats.js')

export default {
  components: {
    InboundDragOverlay,
    DirItemDragOverlay,
  },
  data () {
    return {
      dragIsCanceledOrOutsideWindow: false,
      dragOverEventThrottle: null,
      allowedInboundDragDropTargets: [
        'navigator::currentDir',
        'homePageBanner::customMedia',
      ],
    }
  },
  mounted () {
    this.dragOverEventThrottle = new TimeUtils()
    this.$eventHub.$on('cancel:drag', this.resetValues)
    this.initEventListeners()
  },
  watch: {
    $route () {
      this.fetchDropTargetItems()
    },
    'inputState.drag.isInsideWindow' (value) {
      if (!value) {
        this.showDirItemDragOverlay = false
      }
    },
    'inputState.drag.moveActivationTresholdReached' (value) {
      this.showDirItemDragOverlay = value
    },
  },
  computed: {
    ...mapFields({
      defaultData: 'defaultData',
      inputState: 'inputState',
      currentDir: 'navigatorView.currentDir',
      dialogs: 'dialogs',
      showInboundDragOverlay: 'overlays.inboundDrag',
      showDirItemDragOverlay: 'overlays.dirItemDrag',
    }),
    ...mapGetters([
      'selectedDirItems',
      'selectedDirItemsPaths',
      'someDialogIsOpened',
    ]),
    overlappedDropTarget () {
      const targetMap = [
        {
          targetName: 'navigator::currentDir',
          if: this.$route.name === 'navigator' &&
            !this.inputState.ctrl &&
            this.inputState.drag.type === 'inbound',
        },
        {
          targetName: 'navigator::dir',
          if: this.$route.name === 'navigator' &&
            ((this.inputState.drag.type === 'inbound' &&
            this.inputState.ctrl) || this.inputState.drag.type === 'local'),
        },
        {
          targetName: 'homePage::dir',
          if: this.$route.name === 'home' &&
            !this.dialogs.homeBannerPickerDialog.value,
        },
        {
          targetName: 'homePageBanner::customMedia',
          if: this.$route.name === 'home' &&
            this.dialogs.homeBannerPickerDialog.value,
        },
      ]
      return targetMap.find(target => target.if)?.targetName || ''
    },
  },
  methods: {
    resetValues () {
      this.dragIsCanceledOrOutsideWindow = true
      this.inputState.drag.type = ''
      this.inputState.drag.targetType = ''
      this.inputState.drag.startedInsideWindow = false
      window.removeEventListener('mousemove', this.handleMouseMove)
      window.removeEventListener('mouseup', this.handleMouseUp)
      this.setShowInboundDragOverlay()
    },
    initEventListeners () {
      // NOTE: 'dragover' event is required for 'drop' event to work
      window.addEventListener('dragover', this.handleDragOver)
      window.addEventListener('dragenter', this.handleDragEnter)
      window.addEventListener('dragleave', this.handleDragLeave)
      window.addEventListener('drop', this.handleDrop)
      window.addEventListener('mouseup', this.handleMouseUp)
      window.addEventListener('mousedown', this.handleMouseDown)
      window.addEventListener('mouseover', this.handleMouseOver)
    },
    handleMouseUp () {
      this.resetValues()
    },
    handleMouseDown (mousedownEvent) {
      this.fetchDropTargetItems()
      this.inputState.pointer.button1 = mousedownEvent.which === 1
      this.inputState.pointer.button2 = mousedownEvent.which === 2
      this.inputState.pointer.button3 = mousedownEvent.which === 3
      this.inputState.pointer.lastMousedownEvent = mousedownEvent
      this.inputState.drag.startedInsideWindow = true
      window.addEventListener('mousemove', this.handleMouseMove)
      window.addEventListener('mouseup', this.handleMouseUp)
    },
    handleMouseMove (mousemoveEvent) {
      this.fetchDropTargetItems()
      this.setShowInboundDragOverlay()
      this.inputState.drag.dirItems = this.selectedDirItems
      const dropTargetExist = this.inputState.drag.dropTargetItems.length > 0 || this.showInboundDragOverlay
      const hasDragItems = this.inputState.drag.dirItems.length > 0 || this.inputState.drag.type === 'inbound'
      if (dropTargetExist && hasDragItems) {
        this.setOverlappedDropTargetItem(
          this.inputState.drag.dropTargetItems,
          mousemoveEvent,
        )
      }
    },
    async handleDrop (dropEvent) {
      dropEvent.preventDefault()
      if (this.overlappedDropTarget === 'homePageBanner::customMedia') {
        this.resetValues()
        await this.$store.dispatch('homePageBackgroundDrop', dropEvent)
      }
      else if (['homePage::dir', 'navigator::dir', 'navigator::currentDir'].includes(this.overlappedDropTarget)) {
        await this.handleDirTargetDrop(dropEvent)
        this.setShowInboundDragOverlay()
      }
    },
    handleDragEnter (dragEvent) {
      this.setShowInboundDragOverlay()
      this.setTargetType(dragEvent)
    },
    handleDragOver (dragEvent) {
      dragEvent.preventDefault()
      dragEvent.dataTransfer.dropEffect = this.inputState.shift ? 'copy' : 'move'
      if (!this.inputState.drag.startedInsideWindow) {
        this.dragOverEventThrottle.throttle(() => {
          electronRemote.getCurrentWindow().focus()
          if (!this.dragIsCanceledOrOutsideWindow) {
            this.fetchDropTargetItems()
            this.setShowInboundDragOverlay()
            this.inputState.drag.type = 'inbound'
            this.setOverlappedDropTargetItem(
              this.inputState.drag.dropTargetItems,
              dragEvent,
            )
          }
        }, {time: 50})
      }
    },
    handleDragLeave (dragLeaveEvent) {
      this.dragIsCanceledOrOutsideWindow = dragLeaveEvent.screenX === 0 && dragLeaveEvent.screenY === 0
      if (this.dragIsCanceledOrOutsideWindow) {
        this.resetValues()
      }
    },
    setShowInboundDragOverlay () {
      const isValidDropTarget = this.allowedInboundDragDropTargets.includes(this.overlappedDropTarget)
      this.showInboundDragOverlay = this.inputState.drag.type === 'inbound' && isValidDropTarget
    },
    setTargetType (event) {
      if (this.inputState.drag.targetType === '') {
        const dragTargetKind = event.dataTransfer.items[0].kind
        if (dragTargetKind === 'file') {
          this.inputState.drag.targetType = 'existing-path'
        }
      }
    },
    fetchDropTargetItems () {
      const dropTargetItems = []
      document.querySelectorAll('.drop-target').forEach(element => {
        dropTargetItems.push({
          path: element.dataset.itemPath,
          element,
        })
      })
      this.inputState.drag.dropTargetItems = dropTargetItems
    },
    /** Returns drop target item, overlapped by pointer.
    * Checks only items with 'drop-target' class and the inbound drag overlay.
    * Ensures the item can accept the drop.
    * @param {array} dropTargetItems
    * @param {object} mouseMoveEvent
    * @returns {object} {path: string}
    */
    getOverlappedDropTargetItem (dropTargetItems, mousemoveEvent) {
      const overlappedDropTargetItem = {path: ''}
      if (['navigator::dir', 'homePage::dir'].includes(this.overlappedDropTarget)) {
        dropTargetItems?.forEach(dropTargetItem => {
          const isPointerInsideElement = this.isPointerInsideElement(dropTargetItem, mousemoveEvent)
          // Prevent circular copy / move operation by ignoring dragged items that are selected
          const draggedItemsIncludesSelected = this.inputState.drag.dirItems.some(item => {
            return item.path === dropTargetItem.path
          })

          if (isPointerInsideElement && !draggedItemsIncludesSelected) {
            overlappedDropTargetItem.path = dropTargetItem.path
          }
        })
      }
      else if (['navigator::currentDir'].includes(this.overlappedDropTarget)) {
        overlappedDropTargetItem.path = this.currentDir.path
      }
      return overlappedDropTargetItem
    },
    setOverlappedDropTargetItem (dropTargetItems, mousemoveEvent) {
      this.inputState.drag.overlappedDropTargetItem = this.getOverlappedDropTargetItem(dropTargetItems, mousemoveEvent)
    },
    isPointerInsideElement (dropTargetItem, mousemoveEvent) {
      try {
        const elementBoundary = dropTargetItem.element.getBoundingClientRect()
        return mousemoveEvent.clientX >= elementBoundary.left &&
          mousemoveEvent.clientX <= elementBoundary.right &&
          mousemoveEvent.clientY >= elementBoundary.top &&
          mousemoveEvent.clientY <= elementBoundary.bottom
      }
      catch (error) {
        return false
      }
    },
    async handleDirTargetDrop (dropEvent) {
      if (this.inputState.drag.overlappedDropTargetItem.path === '') {return}
      if (this.inputState.drag.startedInsideWindow) {return}
      this.resetValues()
      await this.handleInboundDrop(dropEvent)
    },
    async handleInboundDrop (dropEvent) {
      try {
        if (dropEvent.dataTransfer.items[0].kind === 'string') {
          await this.handleInboundDropString(dropEvent)
        }
        else if (dropEvent.dataTransfer.items[0].kind === 'file') {
          await this.handleInboundDropFile(dropEvent)
        }
      }
      catch (error) {
        notifications.emit({name: 'error', props: {error}})
        this.resetValues()
      }
    },
    async handleInboundDropFile (dropEvent) {
      let filePaths = []
      for (const file of dropEvent.dataTransfer.files) {
        filePaths.push(file.path)
      }
      if (this.inputState.shift) {
        await this.$store.dispatch('copyDirItems', {
          items: filePaths,
          directory: this.inputState.drag.overlappedDropTargetItem.path,
        })
      }
      else {
        await this.$store.dispatch('moveDirItems', {
          items: filePaths,
          directory: this.inputState.drag.overlappedDropTargetItem.path,
        })
      }
    },
    async handleInboundDropString (dropEvent) {
      const dataTransferInfo = {
        plain: dropEvent.dataTransfer.getData('text/plain'),
        html: dropEvent.dataTransfer.getData('text/html'),
        url: dropEvent.dataTransfer.getData('text/uri-list'),
      }
      const requestdata = request(dataTransferInfo.url)
      requestdata.on('response', (response) => {
        const videoHosting = this.getSupportedVideoHosting(dataTransferInfo)
        const videoStream = this.getSupportedVideoContentType(dataTransferInfo, response)
        const isHostingVideoMatch = dataTransferInfo.url && videoHosting.isSupported
        const isStreamVideoMatch = response.statusCode === 200 &&
           dataTransferInfo.url &&
           videoStream.isSupported
        if (isHostingVideoMatch) {
          this.handleURLVideoDataTransfer(dataTransferInfo, videoHosting)
        }
        else if (isStreamVideoMatch) {
          this.handleURLVideoDataTransfer(dataTransferInfo, videoStream)
        }
        else if (dataTransferInfo.html || dataTransferInfo.url) {
          this.handleHTMLDataTransfer(dataTransferInfo)
        }
      })

      requestdata.on('error', (response) => {
        const parser = new DOMParser()
        const virtualDocument = parser.parseFromString(dataTransferInfo.html, 'text/html')
        const imageElement = virtualDocument.querySelector('img')
        if (imageElement?.src) {
          this.handleHTMLDataTransfer(dataTransferInfo)
        }
        else {
          this.$eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'item-transfer:403',
            timeout: 6000,
            closeButton: true,
            title: 'Unable to download resource',
            message: response,
          })
        }
      })
    },
    handleURLVideoDataTransfer (dataTransferInfo, videoType) {
      const requestdata = request(dataTransferInfo.url)
      requestdata.on('response', (response) => {
        if (response.statusCode === 403) {
          this.$eventHub.$emit('notification', {
            action: 'update-by-type',
            type: 'item-transfer:403',
            timeout: 10000,
            closeButton: true,
            title: 'Video download failed',
            message: `
                Possible reasons: link has expired; download is forbidden.
                <br><strong>URL:</strong> 
                <br>${dataTransferInfo.url}
              `,
          })
          throw Error(`${response.statusCode}: ${response.statusMessage}`)
        }
        else {
          const data = {
            url: dataTransferInfo.url,
            directory: this.inputState.drag.overlappedDropTargetItem.path,
            source: videoType.source,
            type: 'video',
          }
          this.dialogs.externalDownloadDialog.data = {...this.dialogs.externalDownloadDialog.data, ...data}
          this.dialogs.externalDownloadDialog.value = true
        }
      })
    },
    handleHTMLDataTransfer (dataTransferInfo) {
      const parser = new DOMParser()
      const virtualDocument = parser.parseFromString(dataTransferInfo.html, 'text/html')
      const imageElement = virtualDocument.querySelector('img')
      if (imageElement) {
        this.dialogs.downloadTypeSelector.data.downloadFileButton = () => {
          this.initDownloadFile(dataTransferInfo.url)
        }
        this.dialogs.downloadTypeSelector.data.downloadImageButton = () => {
          if (imageElement.src) {
            this.initDownloadFile(imageElement.src)
          }
        }
        this.dialogs.downloadTypeSelector.value = true
      }
      else {
        this.initDownloadFile(dataTransferInfo.url)
      }
    },
    initDownloadFile (url) {
      electron.ipcRenderer.send('download-file', {
        url,
        dir: this.inputState.drag.overlappedDropTargetItem.path,
      })
    },
    getSupportedVideoHosting (dataTransferInfo) {
      try {
        const urlParsed = new URL(dataTransferInfo.url)
        if (urlParsed.host) {
          return supportedFormats.getVideoHosting({host: urlParsed.host})
        }
        else {
          return {isSupported: false}
        }
      }
      catch (error) {
        return {isSupported: false}
      }
    },
    getSupportedVideoContentType (dataTransferInfo, response) {
      try {
        const urlParsed = new URL(dataTransferInfo.url)
        if (urlParsed.host) {
          return supportedFormats.getVideoContentType({
            filePath: urlParsed.pathname,
            headerContentType: response.headers['content-type'],
          })
        }
        else {
          return {isSupported: false}
        }
      }
      catch (error) {
        return {isSupported: false}
      }
    },
  },
}
</script>
