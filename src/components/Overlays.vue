<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <!-- overlay: {type: inbound-drag} -->
    <transition name="fade-in">
      <v-layout
        id="overlay--inbound-drag"
        class="overlay--inbound-drag"
        v-show="inboundDragOverlayIsVisible"
        column align-center justify-center
      >
        <div class="overlay--inbound-drag__title">
          {{inboundDragOverlayText.title}}
        </div>
        <div
          class="overlay--inbound-drag__sub-title"
          v-if="inboundDragOverlayText.allowedTypes"
        >{{inboundDragOverlayText.allowedTypes}}
        </div>
        <div
          class="overlay--inbound-drag__sub-title"
          v-if="inboundDragOverlayText.modeInstructions"
        >{{inboundDragOverlayText.modeInstructions}}
        </div>
        <div class="overlay--inbound-drag__sub-title">
          Hit [ESC] button to cancel
        </div>
      </v-layout>
    </transition>

    <!-- overlay: {type: dir-item-drag} -->
    <transition name="overlay--item-drag__transition">
      <div
        id="overlay--item-drag"
        v-show="dirItemDragOverlay || dirItemDragOverlayIsLocked"
      >
        <v-layout align-center style="gap: 16px">
          <div class="overlay--item-drag__description">
            {{inputState.shift ? 'Copy' : 'Move'}}
            {{selectedDirItems.length}}
            {{$localizeUtils.pluralize(selectedDirItems.length, 'item')}}
          </div>
          <div class="overlay--item-drag__icon">
            <v-icon size="20px">
              {{inputState.shift
                ? 'far fa-copy'
                : 'mdi-content-duplicate'
              }}
            </v-icon>
          </div>
        </v-layout>
        <div class="overlay--item-drag__subtitle">
          Hold [Shift] to change mode
        </div>
      </div>
    </transition>
  </div>
</template>

<script>
import { mapFields } from 'vuex-map-fields'
import { mapGetters, mapState } from 'vuex'
import TimeUtils from '../utils/timeUtils.js'

const electron = require('electron')
const electronRemote = require('@electron/remote')
const fs = require('fs')
const request = require('request')

export default {
  data () {
    return {
      dragOverEventthrottle: null,
      dropTargetItems: [],
      dragTargetItems: [],
      dragDropTargetItemsContainer: null,
      dirItemDragOverlayIsLocked: false,
      mouseDown: {
        item: {
          path: ''
        },
        leftClick: false,
        rightClick: false,
        downCoordX: null,
        downCoordY: null,
        moveCoordX: null,
        moveCoordY: null,
        clickedItemIsSelected: false,
        noneItemsSelected: false,
        singleItemSelected: false,
        multipleItemsSelected: false
      }
    }
  },
  mounted () {
    // Register eventHub listeners
    this.$eventHub.$on('cancel:drag', this.resetMouseMoveEventValues)

    // NOTE: 'dragover' event is required for 'drop' event to work
    this.dragOverEventthrottle = new TimeUtils()
    window.addEventListener('dragover', this.dragoverHandler)
    window.addEventListener('dragenter', this.dragenterHandler)
    window.addEventListener('dragleave', this.dragleaveHandler)
    window.addEventListener('drop', this.dropHandler)
    window.addEventListener('mouseup', this.mouseUpHandler, { once: true })
    window.addEventListener('mousedown', this.mousedownHandler)
  },
  watch: {
    cursorLeftWindow (value) {
      if (value) {
        this.dirItemDragOverlay = false
      }
    },
    dirItemDragMoveTresholdReached (value) {
      if (value) {
        this.dirItemDragOverlay = true
        this.dirItemDragOverlayIsLocked = true
      }
      else {
        this.dirItemDragOverlay = false
      }
    },
    'drag.dirItemInbound.value' (value) {
      if (!value) {
        this.resetMouseMoveEventValues()
      }
    }
  },
  computed: {
    ...mapFields({
      inputState: 'inputState',
      dialogs: 'dialogs',
      visibleDirItems: 'navigatorView.visibleDirItems',
      drag: 'drag',

      dragTargetType: 'drag.targetType',
      dragEventCursorIsMoving: 'drag.cursorIsMoving',
      dragEventWatchingItemOverlap: 'drag.watchingItemOverlap',
      dragStartedInsideWindow: 'drag.startedInsideWindow',
      dirItemDragMoveTresholdReached: 'drag.moveTresholdReached',
      dragMoveTreshold: 'drag.moveTreshold',
      cursorLeftWindow: 'drag.cursorLeftWindow',
      inboundDragOverlay: 'overlays.inboundDrag',
      dirItemDragOverlay: 'overlays.dirItemDrag'
    }),
    ...mapGetters([
      'selectedDirItems',
      'selectedDirItemsPaths',
      'someDialogIsOpened'
    ]),
    ...mapState({
      currentDir: state => state.navigatorView.currentDir
    }),
    inboundDragOverlayIsVisible () {
      const allowedInboundDragOverlayTargets = [
        'navigatorCurrentDirTarget',
        'homePageBannerCustomMediaUploadTarget'
      ]
      const isValidDropTarget = allowedInboundDragOverlayTargets.includes(this.currentDragTarget)
      return this.drag.dirItemInbound.value && isValidDropTarget
    },
    currentDragTarget () {
      const navigatorDirTarget = this.$route.name === 'navigator' &&
        this.inputState.ctrl
      const navigatorCurrentDirTarget = this.$route.name === 'navigator' &&
        !this.inputState.ctrl
      const homePageBannerCustomMediaUploadTarget = this.$route.name === 'home' &&
        this.dialogs.homeBannerPickerDialog.value
      if (navigatorCurrentDirTarget) {return 'navigatorCurrentDirTarget'}
      else if (navigatorDirTarget) {return 'navigatorDirTarget'}
      else if (homePageBannerCustomMediaUploadTarget) {return 'homePageBannerCustomMediaUploadTarget'}
      else {return ''}
    },
    inboundDragOverlayText () {
      if (this.currentDragTarget === 'navigatorCurrentDirTarget') {
        return {
          title: 'Drop here to copy / download into the current directory',
          modeInstructions: 'Hold CTRL for selective drop mode'
        }
      }
      else if (this.currentDragTarget === 'homePageBannerCustomMediaUploadTarget') {
        return {
          title: 'Drop here to copy file and add custom media',
          allowedTypes: 'file, path, URL',
          modeInstructions: ''
        }
      }
      else {
        return {
          title: 'Drop here to copy / download into the current directory',
          modeInstructions: 'Hold CTRL for selective drop mode'
        }
      }
    }
  },
  methods: {
    isDirItemSelected (item) {
      return this.selectedDirItemsPaths.includes(item.path)
    },
    stopDragWatcher () {
      this.dragEventWatchingItemOverlap = false
      this.drag.dirItemInbound.value = false
      this.dragEventCursorIsMoving = false
      this.handleMouseUpActions()
      this.resetMouseMoveEventValues()
      this.dragOverEventthrottle.clear()
    },
    resetMouseMoveEventValues () {
      window.removeEventListener('mouseup', this.mouseUpHandler, { once: true })
      window.removeEventListener('mousemove', this.mouseMoveHandler)
      window.removeEventListener('blur', this.windowBlurHandler)
      this.inputState.pointer.hoveredItem = { id: '', path: '' }
      this.dragStartedInsideWindow = false
      this.dirItemDragOverlay = false
      this.dirItemDragMoveTresholdReached = false
      this.dirItemDragOverlayIsLocked = false
    },
    fetchDropTargetItems () {
      // Get existing drag / drop target items
      let dropTargetItems = []
      if (this.$route.name === 'home') {
        // Get currently existing draggable items
        this.dragDropTargetItemsContainer = document.querySelectorAll('#home-route__content-area--main')
        dropTargetItems = document.querySelectorAll('.drop-target')
      }
      else if (this.$route.name === 'navigator') {
        this.dragDropTargetItemsContainer = document.querySelectorAll('.drag-drop-container')
        this.dragDropTargetItemsContainer.forEach(node => {
          if (node.firstChild) {
            const targets = node.firstChild.querySelectorAll('.drop-target')
            targets.forEach(targetNode => {
              dropTargetItems.push(targetNode)
            })
          }
        })
      }
      return dropTargetItems
    },
    fetchDragTargetItems () {
      // Get existing drag / drop target items
      let dropTargetItems = []
      if (this.$route.name === 'home') {
        // Get currently existing draggable items
        this.dragDropTargetItemsContainer = document.querySelectorAll('#home-route__content-area--main')
        dropTargetItems = document.querySelectorAll('.drag-target')
      }
      else if (this.$route.name === 'navigator') {
        this.dragDropTargetItemsContainer = document.querySelectorAll('.drag-drop-container')
        this.dragDropTargetItemsContainer.forEach(node => {
          if (node.firstChild) {
            const targets = node.firstChild.querySelectorAll('.drag-target')
            targets.forEach(targetNode => {
              dropTargetItems.push(targetNode)
            })
          }
        })
      }
      return dropTargetItems
    },
    // fetchTargetItems (name) {
    //   // Get existing drag / drop target items
    //   let dropTargetItems
    //   if (this.$route.name === 'home') {
    //     // Get currently existing draggable items
    //     this.dragDropTargetItemsContainer = document.querySelectorAll('#home-route__content-area--main')
    //     dropTargetItems = document.querySelectorAll(`.${name}-target`)
    //   }
    //   else if (this.$route.name === 'navigator') {
    //     this.dragDropTargetItemsContainer = document.querySelectorAll('.drag-drop-container')
    //     dropTargetItems = this.dragDropTargetItemsContainer.firstChild.querySelectorAll(`.${name}-target`)
    //   }
    //   return dropTargetItems
    // },
    handleLocalDragOverEvent (dragEvent) {
      console.log('handleLocalDragOverEvent', dragEvent)
    },
    handleGlobalDragOverEvent (dragEvent) {
      if (!this.drag.dirItemInbound.value) {
        this.drag.dirItemInbound.value = true
      }
      // this.dragEventCursorIsMoving = true
      // if (!this.inboundDragOverlay) {
      this.setCursorOverlappedItem(
        this.fetchDropTargetItems(),
        dragEvent
      )
      // }
      if (!this.dragEventWatchingItemOverlap) {
        this.dragEventWatchingItemOverlap = true
      }
    },
    dragoverHandler (dragEvent) {
      dragEvent.preventDefault()
      dragEvent.dataTransfer.dropEffect = 'copy'
      this.dragOverEventthrottle.throttle(() => {
        if (this.dragStartedInsideWindow) {
          this.handleLocalDragOverEvent(dragEvent)
        }
        else {
          this.handleGlobalDragOverEvent(dragEvent)
        }
      }, { time: 100 })
    },
    handlerDropActions (dropEvent) {
      return new Promise((resolve, reject) => {
        console.log(this.inboundDragOverlayIsVisible, this.currentDragTarget, dropEvent)
        // Avoid triggering when overlay is not shown
        // if (!this.inboundDragOverlayIsVisible) {
        //   reject()
        //   return
        // }
        if (this.currentDragTarget === 'homePageBannerCustomMediaUploadTarget') {
          this.$store.dispatch('HANDLE_HOME_PAGE_BACKGROUND_ITEM_DROP', dropEvent)
            .then(() => resolve())
        }
        else if (['navigatorDirTarget', 'navigatorCurrentDirTarget'].includes(this.currentDragTarget)) {
          this.handleTargetDrop(dropEvent, this.currentDragTarget)
            .then(() => resolve())
        }
      })
    },
    handleTargetDrop (dropEvent, target) {
      return new Promise((resolve, reject) => {
        if (this.inputState.pointer.hoveredItem.path === '') { 
          resolve()
          return
        }
        if (!this.dragStartedInsideWindow) {
          console.log(dropEvent.dataTransfer.items)
          const promises = []

          // Handle transfer type: local file / directory
          const localItems = dropEvent.dataTransfer.files
          
          if (dropEvent.dataTransfer.items) {
            if (dropEvent.dataTransfer.items[0].kind === 'file') {
              for (const file of dropEvent.dataTransfer.files) {
                promises.push(
                  this.handleLocalItemTransfer(dropEvent.dataTransfer, file)
                )
              }
            }
          }

          // Handle transfer type: URL / external file / HTML
          const transferItem = { data: {} }
          for (const item of dropEvent.dataTransfer.items) {
            if (item.kind === 'string' && item.type === 'text/plain') {
              transferItem.data.plain = dropEvent.dataTransfer.getData('text/plain')
            }
            if (item.kind === 'string' && item.type === 'text/html') {
              transferItem.data.html = dropEvent.dataTransfer.getData('text/html')
            }
          }
          console.log('text/plain', dropEvent.dataTransfer.getData('text/plain'))
          console.log('text/html', dropEvent.dataTransfer.getData('text/html'))

          // If item has type 'text/plain', handle it first
          if (transferItem.data.plain) {
            promises.push(
              this.handlePlainItemTransfer(dropEvent.dataTransfer, transferItem)
            )
          }

          // Handle type 'text/html' only if the item doesn't have type 'text/plain'
          else if (transferItem.data.html) {
            promises.push(
              this.handleHTMLItemTransfer(dropEvent, item)
            )
          }

          Promise.allSettled(promises)
            .then(() => {
              resolve()
            })
        }
      })
    },
    dropHandler (dropEvent) {
      dropEvent.preventDefault()
      this.handlerDropActions(dropEvent)
        .then(() => this.stopDragWatcher())
    },
    async handleLocalItemTransfer (dataTransfer, item) {
      console.log('=== Overlays > handleLocalItemTransfer')
      const itemIsDirectory = fs.statSync(item.path).isDirectory()
      // Copy directory
      if (itemIsDirectory) {
        const itemObject = await this.$store.dispatch('FETCH_DIR_ITEM_INFO', item.path)
        await this.$store.dispatch('COPY_DIR_ITEMS', {
          items: [itemObject],
          directory: this.inputState.pointer.hoveredItem.path
        })
      }
      // Copy file
      else {
        this.$store.dispatch('INIT_WRITE_FILE', {
          size: item.size,
          path: item.path,
          directory: this.inputState.pointer.hoveredItem.path
        })
      }
    },
    handlePlainItemTransfer (dataTransfer, transferItem) {
      return new Promise((resolve, reject) => {
        const stringPlain = transferItem.data.plain
        const url = dataTransfer.getData('URL')

        let urlParsed = ''
        try { urlParsed = new URL(url) }
        catch (error) {}

        const requestdata = request(url)
        requestdata.on('response', (response) => {
          if (response.statusCode === 403) {
            this.$eventHub.$emit('notification', {
              action: 'update-by-type',
              type: 'item-transfer:403',
              timeout: 10000,
              closeButton: true,
              title: 'Download failed',
              message: `
                Possible reasons: link has expired; download is forbidden.
                <br><b>URL:</b> 
                <br>${url}
              `
            })
            reject()
          }
          else {
            resolve()
            const contentType = this.getTransferContentType(response, urlParsed)
            if (contentType === 'video:m3u8') {
              const data = {
                url: url,
                directory: this.inputState.pointer.hoveredItem.path,
                source: 'm3u8',
                type: 'video'
              }
              this.dialogs.externalDownloadDialog.data = { ...this.dialogs.externalDownloadDialog.data, ...data }
              this.dialogs.externalDownloadDialog.value = true
            }
            else if (contentType === 'video:youtube') {
              const data = {
                url: url,
                directory: this.inputState.pointer.hoveredItem.path,
                source: 'youtube',
                type: 'video'
              }
              this.dialogs.externalDownloadDialog.data = { ...this.dialogs.externalDownloadDialog.data, ...data }
              this.dialogs.externalDownloadDialog.value = true
            }
            else {
              electron.ipcRenderer.send('download-file', {
                url: url,
                dir: this.inputState.pointer.hoveredItem.path,
                hashID: this.$utils.getHash()
              })
            }
          }
        })
      })
    },
    handleHTMLItemTransfer (dropEvent, item) {
      return new Promise((resolve, reject) => {
        const stringHTML = dropEvent.dataTransfer.getData('text/html')
        console.log('stringHTML', stringHTML)
        resolve()
      })
    },
    getTransferContentType (response, urlParsed) {
      const isM3U8Video = response.headers['content-type'] === 'application/vnd.apple.mpegurl' &&
        urlParsed.pathname.endsWith('.m3u8')
      const isYoutubeHostname = ['www.youtube.com', 'youtube.com'].includes(urlParsed.hostname)
      const isYoutubeVideo = isYoutubeHostname && urlParsed.pathname === '/watch'

      if (isM3U8Video) { return 'video:m3u8' }
      else if (isYoutubeVideo) { return 'video:youtube' }
    },
    dragenterHandler (dragenterEvent) {
      electronRemote.getCurrentWindow().focus()
    },
    dragleaveHandler (dragleaveEvent) {
      const cursorLeftWindow = dragleaveEvent.clientX === 0 && dragleaveEvent.clientY === 0
      if (cursorLeftWindow) {
        // Note: delay to prevent mouseenter event collsion on dragleave and drag-cancel
        setTimeout(() => {
          this.drag.dirItemInbound.value = false
        }, 100)
      }
    },
    mousedownHandler (mousedownEvent) {
      // Set status
      this.inputState.pointer.button1 = true
      this.dragStartedInsideWindow = true

      // Do not continue if a dialog is opened
      if (this.someDialogIsOpened) { return }

      const dragTargetItems = this.fetchDragTargetItems()
      if (dragTargetItems) {
        this.mouseDown.item = this.getPointerOverlappedItem(
          this.dragDropTargetItemsContainer,
          dragTargetItems,
          mousedownEvent
        )
      }
      this.mouseDown.clickedItemIsSelected = this.isDirItemSelected(this.mouseDown.item)
      this.mouseDown.leftClick = mousedownEvent.button === 0
      this.mouseDown.rightClick = mousedownEvent.button === 2
      this.mouseDown.downCoordX = mousedownEvent.clientX
      this.mouseDown.downCoordY = mousedownEvent.clientY
      this.mouseDown.moveCoordX = null
      this.mouseDown.moveCoordY = null
      this.mouseDown.noneItemsSelected = this.selectedDirItems.length === 0
      this.mouseDown.singleItemSelected = this.selectedDirItems.length === 1
      this.mouseDown.multipleItemsSelected = this.selectedDirItems.length > 1
      // Init listeners
      window.addEventListener('mousemove', this.mouseMoveHandler)
      window.addEventListener('mouseup', this.mouseUpHandler, { once: true })
      window.addEventListener('blur', this.windowBlurHandler)
    },
    mouseUpHandler (mouseupEvent) {
      this.inputState.pointer.button1 = false
      this.dragTargetType = ''
      this.drag.dirItemInbound.value = false
      this.handleMouseUpActions()
      this.resetMouseMoveEventValues()
    },
    mouseMoveHandler (mousemoveEvent) {
      console.log('mouseMoveHandler', mousemoveEvent)
      if (this.inputState.pointer.button1) {
        // TODO:
        // - if cursor is over selected item,
        // set this.dirItemDragOverlay = false,
        // otherwise do the following
        this.dirItemDragMoveTresholdReached = this.dragStarted(mousemoveEvent)
        const dirItemDragOverlayNode = document.querySelector('#overlay--item-drag')
        const dropTargetItems = this.fetchDropTargetItems()
        if (dropTargetItems) {
          this.updateDirItemDragOverlayPosition(dirItemDragOverlayNode, mousemoveEvent)
          this.setCursorOverlappedItem(
            dropTargetItems,
            mousemoveEvent
          )
        }
        this.handleWindowDragOut(mousemoveEvent)
      }
    },
    windowBlurHandler () {
      this.startOutboundDirItemDrag()
    },
    dragStarted (mousemoveEvent) {
      // Calculate if cursor moved beyond treshold
      if (this.mouseDown.leftClick && this.dragTargetType === 'dirItem') {
        this.mouseDown.moveCoordX = mousemoveEvent.clientX
        this.mouseDown.moveCoordY = mousemoveEvent.clientY
        const distanceX = Math.abs(this.mouseDown.downCoordX - mousemoveEvent.clientX)
        const distanceY = Math.abs(this.mouseDown.downCoordY - mousemoveEvent.clientY)
        const cursorMoved = distanceX > this.dragMoveTreshold ||
                      distanceY > this.dragMoveTreshold
        return cursorMoved
      }
      return false
    },
    updateDirItemDragOverlayPosition (dirItemDragOverlayNode, mousemoveEvent) {
      dirItemDragOverlayNode.style.left = (mousemoveEvent.clientX) + 'px'
      dirItemDragOverlayNode.style.top = (mousemoveEvent.clientY) + 'px'
    },
    handleWindowDragOut (mousemoveEvent) {
      const windowSize = electronRemote.getCurrentWindow().getSize()
      const windowWidth = windowSize[0]
      const windowHeight = windowSize[1]
      const margin = 0
      const reachedBorderTop = mousemoveEvent.clientY - margin < 0
      const reachedBorderBottom = mousemoveEvent.clientY + margin > windowHeight
      const reachedBorderLeft = mousemoveEvent.clientX - margin < 0
      const reachedBorderRight = mousemoveEvent.clientX + margin > windowWidth
      this.cursorLeftWindow = reachedBorderTop ||
        reachedBorderBottom ||
        reachedBorderLeft ||
        reachedBorderRight

      if (this.cursorLeftWindow) {
        this.startOutboundDirItemDrag()
      }
    },
    startOutboundDirItemDrag () {
      this.drag.dirItemOutbound.value = true
      this.resetMouseMoveEventValues()
      electron.ipcRenderer.send('window:drag-out', this.selectedDirItemsPaths)
    },
    handleMouseUpActions () {
      const {
        item,
        leftClick,
        rightClick,
        downCoordX,
        downCoordY,
        clickedItemIsSelected,
        singleItemSelected,
        multipleItemsSelected
      } = this.mouseDown

      // Handle item drag end
      if (this.dirItemDragMoveTresholdReached) {
        const overlappedSomeItem = this.inputState.pointer.hoveredItem.path !== ''
        if (overlappedSomeItem) {
          const dropTargetItemIsDirectory = fs.statSync(this.inputState.pointer.hoveredItem.path).isDirectory()
          if (dropTargetItemIsDirectory) {
            if (this.inputState.shift) {
              this.$store.dispatch('COPY_DIR_ITEMS', {
                items: this.selectedDirItems,
                directory: this.inputState.pointer.hoveredItem.path
              })
            }
            else {
              this.$store.dispatch('MOVE_DIR_ITEMS', {
                items: this.selectedDirItems,
                directory: this.inputState.pointer.hoveredItem.path
              })
            }
          }
        }
      }
    },
    isPointerInsideElement (elementNode, mousemoveEvent) {
      const elementNodeBoundary = elementNode.getBoundingClientRect()
      return mousemoveEvent.clientX >= elementNodeBoundary.left &&
        mousemoveEvent.clientX <= elementNodeBoundary.right &&
        mousemoveEvent.clientY >= elementNodeBoundary.top &&
        mousemoveEvent.clientY <= elementNodeBoundary.bottom
    },
    /** Returns item, overlapped by pointer.
    * Checks only items with 'drop-target' class and the inbound drag overlay
    * @param {array} dropTargetItems
    * @param {object} mouseMoveEvent
    * @returns {object} { id: string, path: string }
    */
    getPointerOverlappedItem (dropTargetItems, mousemoveEvent) {
      const overlappedDropTargetItem = { id: '', path: '' }
      if (this.inboundDragOverlayIsVisible) {
        overlappedDropTargetItem.path = this.currentDir.path
      }
      else {
        dropTargetItems?.forEach(dropTargetItem => {
          const isPointerInsideElement = this.isPointerInsideElement(dropTargetItem, mousemoveEvent)
          // Prevent circular copy / move operation by ignoring dragged items that are selected
          const draggedItemsIncludesSelected = this.selectedDirItems.some(item => {
            return item.path === dropTargetItem.dataset.itemPath
          })

          if (isPointerInsideElement && !draggedItemsIncludesSelected) {
            overlappedDropTargetItem.id = dropTargetItem.id
            overlappedDropTargetItem.path = dropTargetItem.dataset.itemPath
          }
        })
      }
      return {
        id: overlappedDropTargetItem.id,
        path: overlappedDropTargetItem.path
      }
    },
    setCursorOverlappedItem (dropTargetItems, mousemoveEvent) {
      const overlappedDropTargetItem = this.getPointerOverlappedItem(dropTargetItems, mousemoveEvent)
      this.inputState.pointer.hoveredItem = {
        id: overlappedDropTargetItem.id,
        path: overlappedDropTargetItem.path
      }
    }
  }
}
</script>

<style>
.overlay--inbound-drag {
  position: fixed;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgb(81, 110, 176, 0.2);
  outline: 4px dashed #fafafa;
  outline-offset: -4px;
  z-index: 1000;
  backdrop-filter: blur(8px);
}

.overlay--inbound-drag--selective {
  position: absolute;
  width: 100%;
  height: 100%;
  background-color: rgb(81, 110, 176, 0.8);
  outline: 3px dashed #fff;
  outline-offset: -3px;
  z-index: 3;
}

.overlay--inbound-drag__title {
  user-select: none;
  pointer-events: none;
  color: #fafafa;
  font-size: 24px;
}

.overlay--inbound-drag__sub-title {
  user-select: none;
  pointer-events: none;
  color: #e0e0e0;
}

#overlay--item-drag {
  pointer-events: none;
  position: fixed;
  gap: 16px;
  padding: 6px 24px;
  z-index: 5;
  /* height: 64px; */
  background-color: rgb(159, 168, 218, 0.1);
  border: 2px solid rgb(159, 168, 218, 0.3);
  border-radius: 4px;
  backdrop-filter: blur(8px);
  box-shadow: 0 10px 40px rgb(0,0,0,0.2),
              -4px 4px 10px rgb(0,0,0,0.05);
}

#overlay--item-drag * {
  color: #bdbdbd;
}

.overlay--item-drag__description {
  /* padding: 8px 8px 8px 16px; */
}

.overlay--item-drag__icon {
  /* padding: 8px 16px 8px 8px; */
}

.overlay--item-drag__subtitle {
  /* padding: 8px 16px 8px 8px; */
  color: var(--color-6) !important;
  font-size: 12px;
}
</style>
