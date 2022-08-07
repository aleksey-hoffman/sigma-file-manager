<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    :id="`item-index-${index}`"
    class="dir-item-card dir-item-node"
    :class="{
      'drop-target drag-target': type && type.includes('directory'),
      'drag-target': type && type.includes('file')
    }"
    :data-item-id="dirItem.id"
    :index="index"
    :data-item-path="`${dirItem.path}`"
    :data-item-real-path="`${dirItem.realPath}`"
    :data-layout="specifiedNavigatorLayout"
    :data-type="type"
    :data-file-type="$utils.getFileType(dirItem.realPath).mimeDescription"
    :data-item-hover-is-paused="itemHoverIsPaused"
    :data-hover-effect="dirItemHoverEffect"
    :in-fs-clipboard="dirItemIsInFsClipboard"
    :fs-clipboard-type="fsClipboard.type"
    :is-selected="isDirItemSelected(dirItem)"
    data-two-line="false"
    :cursor="navigatorOpenDirItemWithSingleClick && !inputState.alt ? 'pointer' : 'default'"
    @mousedown="handleDirItemMouseDown($event, dirItem, index)"
    @mouseenter="handleDirItemMouseEnter($event, dirItem)"
    @mouseleave="handleDirItemMouseLeave($event, dirItem)"
    @mousedown.middle="handleDirItemMiddleMouseDown($event, dirItem)"
  >
    <v-layout
      v-ripple
      class="dir-item-card__content-container"
      align-center
      :style="getCardContentContainerStyles"
    >
      <template v-if="specifiedNavigatorLayout === 'list'">
        <!-- card::thumb-container -->
        <v-layout
          class="dir-item-card__content-container__item dir-item-card__thumb-container"
          :data-item-real-path="`${dirItem.realPath}`"
          align-center
          justify-center
        >
          <!-- card::thumb: {type: directory} -->
          <v-icon
            v-if="type.includes('directory')"
            class="dir-item-card__icon"
            size="28px"
          >
            {{getThumbIcon(dirItem)}}
          </v-icon>

          <!-- card::thumb: {type: file && !isImage} -->
          <v-layout
            v-if="type.includes('file')"
            column
          >
            <v-icon
              class="dir-item-card__icon pt-1"
              size="22px"
              style="height: 22px;"
            >
              {{getThumbIcon(dirItem)}}
            </v-icon>
            <div class="dir-item-card__ext-container">
              <div class="dir-item-card__ext">
                {{$utils.getExt(dirItem.path)}}
              </div>
            </div>
          </v-layout>
        </v-layout>

        <div
          v-for="(item, index) in sortingTypes"
          :key="'dir-item-card__content-container__item-' + index"
          class="dir-item-card__content-container__item"
          :style="{display: item.isChecked ? 'flex' : 'none'}"
        >
          <template v-if="item.name === 'name'">
            <div
              class="dir-item-card__name"
              :style="{'--name-column-max-width': navigatorNameColumnMaxWidth}"
            >
              <div class="dir-item-card__name__line-1">
                <span
                  v-if="showScore"
                  class="inline-code--light mr-2"
                >
                  score: {{dirItem.score}}
                </span>
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <v-icon
                      v-show="dirItem.isInaccessible"
                      color="red"
                      size="12px"
                      v-on="on"
                    >
                      mdi-circle-medium
                    </v-icon>
                  </template>
                  <span>Item is inaccessible</span>
                </v-tooltip>
                {{dirItem.name}}
              </div>

              <!-- card::name::line-2-->
              <div
                v-if="showDir && dirItem.dir !== dirItem.path"
                class="dir-item-card__name__line-2"
              >
                {{dirItem.dir}}
              </div>
            </div>
          </template>

          <template v-if="item.name === 'date-created' && item.isChecked">
            <div class="dir-item-card__date">
              {{getLocalDateTime({stat: 'birthtime'})}}
            </div>
          </template>

          <template v-if="item.name === 'date-modified-meta' && item.isChecked">
            <div class="dir-item-card__date">
              {{getLocalDateTime({stat: 'ctime'})}}
            </div>
          </template>

          <template v-if="item.name === 'date-modified-contents' && item.isChecked">
            <div class="dir-item-card__date">
              {{getLocalDateTime({stat: 'mtime'})}}
            </div>
          </template>

          <template v-if="item.name === 'size' && item.isChecked">
            <!-- {type: (directory|directory-symlink)} -->
            <!-- card::item-count -->
            <div
              v-if="type === 'directory' || type === 'directory-symlink'"
              class="dir-item-card__item-count"
            >
              {{dirItem.dirItemCount}} {{$localizeUtils.pluralize(dirItem.dirItemCount, 'item')}}
            </div>

            <!-- {type: (file|file-symlink)} -->
            <!-- card::item-count -->
            <div
              v-else-if="type === 'file' || type === 'file-symlink'"
              class="dir-item-card__item-count"
            >
              {{$utils.prettyBytes(dirItem.stat.size, 1)}}
            </div>
          </template>

          <template v-if="item.name === 'status' && item.isChecked">
            <div class="dir-item-card__item-offline-status">
              <div v-if="offlineStatus.status">
                <v-tooltip bottom>
                  <template #activator="{ on }">
                    <v-icon
                      color="var(--color-6)"
                      size="12px"
                      v-on="on"
                    >
                      {{offlineStatus.icon}}
                    </v-icon>
                  </template>
                  <span>{{offlineStatus.tooltip}}</span>
                </v-tooltip>
              </div>
              <div v-else />
            </div>

            <div class="dir-item-card__actions">
              <slot name="actions" />
            </div>
          </template>
        </div>
      </template>

      <!-- {layout: 'grid'} -->
      <template v-if="specifiedNavigatorLayout === 'grid'">
        <!-- card::thumb-container -->
        <v-layout
          class="dir-item-card__thumb-container"
          :data-item-real-path="`${dirItem.realPath}`"
          align-center
          justify-center
        >
          <!-- card::thumb: {type: directory} -->
          <v-icon
            v-if="type.includes('directory')"
            class="dir-item-card__icon"
            size="28px"
          >
            {{getThumbIcon(dirItem)}}
          </v-icon>

          <!-- card::thumb: {type: file && !isImage} -->
          <v-layout
            v-if="type.includes('file')"
            column
          >
            <v-icon
              class="dir-item-card__icon"
              size="48px"
            >
              {{getThumbIcon(dirItem)}}
            </v-icon>
          </v-layout>
        </v-layout>

        <!-- {type: (directory|directory-symlink)} -->
        <v-layout
          v-if="type === 'directory' || type === 'directory-symlink'"
          column
        >
          <!-- card::name -->
          <div class="dir-item-card__name">
            <v-tooltip bottom>
              <template #activator="{ on }">
                <v-icon
                  v-show="dirItem.isInaccessible"
                  color="red"
                  size="12px"
                  v-on="on"
                >
                  mdi-circle-medium
                </v-icon>
              </template>
              <span>Item is inaccessible</span>
            </v-tooltip>
            {{dirItem.name}}
          </div>

          <!-- card::item-count -->
          <div class="dir-item-card__item-count">
            {{dirItem.dirItemCount}} {{$localizeUtils.pluralize(dirItem.dirItemCount, 'item')}}
          </div>
        </v-layout>

        <!-- {type: (file|file-symlink)} -->
        <v-layout
          v-else-if="type === 'file' || type === 'file-symlink'"
          class="dir-item-card__description-container"
          :data-path="dirItem.path"
          justify-center
          column
        >
          <div class="dir-item-card__overlay" />

          <div class="dir-item-card__bottom-container">
            <!-- card::name -->
            <div class="dir-item-card__name">
              <v-tooltip bottom>
                <template #activator="{ on }">
                  <v-icon
                    v-show="dirItem.isInaccessible"
                    color="red"
                    size="12px"
                    style="margin-left: -16px"
                    v-on="on"
                  >
                    mdi-circle-medium
                  </v-icon>
                </template>
                <span>Item is inaccessible</span>
              </v-tooltip>
              {{dirItem.name}}
            </div>

            <!-- card::item-count -->
            <div class="dir-item-card__item-count">
              {{$utils.getExt(dirItem.path)}} | {{$utils.prettyBytes(dirItem.stat.size, 1)}}
            </div>
          </div>
        </v-layout>

        <div class="dir-item-card__actions">
          <slot name="actions" />
        </div>
      </template>
    </v-layout>

    <!-- card::overlays -->
    <div class="dir-item-card__overlay-container">
      <div
        v-if="isDirItemSelected(dirItem)"
        class="dir-item-card__overlay dir-item-card__overlay--selected"
      />
      <div
        v-if="dirItemIsInFsClipboard"
        class="dir-item-card__overlay dir-item-card__overlay--fs-clipboard"
      />
      <div
        class="dir-item-card__overlay dir-item-card__overlay--highlighted"
        :class="{'is-visible': dirItem.isHighlighted}"
      />
      <div
        class="dir-item-card__overlay dir-item-card__overlay--hover"
      />
      <div
        class="dir-item-card__overlay overlay--drag-over"
        :class="{'is-visible': showDragOverOverlay(dirItem)}"
      />
    </div>
  </div>
</template>

<script>
import {mapGetters, mapState} from 'vuex'
import {mapFields} from 'vuex-map-fields'

const fs = require('fs')
const PATH = require('path')
const electron = require('electron')

export default {
  name: 'dir-item',
  props: {
    index: {
      type: Number,
      default: 0,
    },
    dirItem: {
      type: Object,
      default: () => ({}),
    },
    type: {
      type: String,
      default: '',
    },
    layout: {
      type: String,
      default: '',
    },
    itemHoverIsPaused: {
      type: Boolean,
      default: false,
    },
    showScore: {
      type: Boolean,
      default: false,
    },
    showDir: {
      type: Boolean,
      default: false,
    },
  },
  data () {
    return {
      dirItemAwaitsSecondClick: false,
      dirItemAwaitsSecondClickTimeout: null,
      mouseDown: {
        item: {},
        leftClick: false,
        rightClick: false,
        downCoordX: null,
        downCoordY: null,
        clickedItemIsSelected: false,
        noneItemsSelected: false,
        singleItemSelected: false,
        multipleItemsSelected: false,
      },
    }
  },
  mounted () {
    this.loadThumb()
    this.$eventHub.$on('cancel:drag', this.resetValues)
  },
  beforeDestroy () {
    this.$eventHub.$off('cancel:drag', this.resetValues)
    try {
      this.$emit('removeFromThumbLoadingSchedule', {item: this.dirItem})
    }
    catch (error) {}
  },
  computed: {
    ...mapState({
      navigatorLayout: state => state.storageData.settings.navigatorLayout,
      appPaths: state => state.storageData.settings.appPaths,
    }),
    ...mapGetters([
      'selectedDirItems',
      'selectedDirItemsPaths',
      'sortingHeaderGridColumnTemplate',
    ]),
    ...mapFields({
      inputState: 'inputState',
      showDirItemDragOverlay: 'overlays.dirItemDrag',
      currentDir: 'navigatorView.currentDir',
      thumbsInProcessing: 'thumbsInProcessing',
      openDirItemSecondClickDelay: 'storageData.settings.navigator.openDirItemSecondClickDelay',
      navigatorOpenDirItemWithSingleClick: 'storageData.settings.navigator.openDirItemWithSingleClick',
      dirItemHoverEffect: 'storageData.settings.dirItemHoverEffect',
      visibleDirItems: 'navigatorView.visibleDirItems',
      dirItemsInfoIsFetched: 'navigatorView.dirItemsInfoIsFetched',
      selectedSortingType: 'storageData.settings.sorting.selectedType',
      fsClipboard: 'navigatorView.clipboard.fs',
      sortingTypes: 'storageData.settings.sorting.types',
      navigatorNameColumnMaxWidth: 'storageData.settings.navigator.nameColumnMaxWidth',
    }),
    specifiedNavigatorLayout () {
      return this.layout || this.navigatorLayout
    },
    offlineStatus () {
      if (this.dirItem.fsAttributes.isOffline) {
        return {
          status: 'offline',
          icon: 'mdi-cloud-outline',
          tooltip: 'Offline item (size on drive is 0)',
        }
      }
      else if (this.dirItem?.fsAttributes.keepOnDevice) {
        return {
          status: 'keepOnDevice',
          icon: 'mdi-cloud-download',
          tooltip: 'Keep on device',
        }
      }
      else {
        return {}
      }
    },
    dirItemIsInFsClipboard () {
      return this.fsClipboard.items.some(item => item.path === this.dirItem.path)
    },
    getCardContentContainerStyles () {
      if (this.specifiedNavigatorLayout === 'list') {
        return {
          'grid-template-columns': this.sortingHeaderGridColumnTemplate.join(' '),
        }
      }
      else {
        return {}
      }
    },
  },
  methods: {
    resetValues () {
      window.removeEventListener('mousemove', this.handleMouseMove)
      window.removeEventListener('mouseup', this.handleMouseUp)
      window.removeEventListener('mouseout', this.handleMouseOut)
      window.removeEventListener('blur', this.handleWindowBlur)
      this.showDirItemDragOverlay = false
      this.inputState.drag.moveActivationTresholdReached = false
      this.inputState.drag.isStarted = false
      this.inputState.drag.type = ''
    },
    getLocalDateTime (params) {
      return this.$utils.getLocalDateTime(
        this.dirItem.stat[params.stat],
        this.$store.state.storageData.settings.dateTime,
      )
    },
    async loadThumbHandler (path) {
      if (this.dirItem.path === path) {
        await this.loadThumb()
      }
    },
    async loadSkippedThumbs () {
      const dirItem = document.querySelector(`div[data-item-real-path="${this.dirItem.realPath}"].dir-item-card`)
      if (dirItem) {
        const dirItemThumbContainer = dirItem.querySelector('.dir-item-card__thumb-container')
        const dirItemFileType = dirItem.dataset.fileType
        const dirItemRealPath = dirItem.dataset.itemRealPath
        const hasImage = dirItemThumbContainer.getElementsByTagName('img').length > 0
        if (!hasImage) {
          await this.loadThumb()
        }
      }
    },
    async loadThumb (options = {}) {
      return new Promise((resolve, reject) => {
        const virtuallyLoadedDirItems = document.querySelectorAll('.dir-item-card')
        // const dirItem = specifiedDirItem ?? document.querySelector(`div[data-item-path="${this.dirItem.realPath}"].dir-item-card`)
        const dirItemNode = document.querySelector(`div[data-item-real-path="${this.dirItem.realPath}"].dir-item-card`)
        if (dirItemNode) {
          const dirItemIndex = parseInt(dirItemNode.getAttribute('index'))
          const dirItemThumbContainer = dirItemNode.querySelector('.dir-item-card__thumb-container')
          const dirItemFileType = dirItemNode.dataset.fileType
          const dirItemPath = dirItemNode.dataset.itemPath
          const dirItemRealPath = dirItemNode.dataset.itemRealPath
          // this.animateDirItemNode({dirItemNode, options})
          this.addThumb(dirItemThumbContainer, dirItemRealPath, dirItemFileType, dirItemNode)
            .then(() => {
              resolve()
            })
        }
      })
    },
    animateDirItemNode (params) {
      if (!params.options.skipTransition) {
        params.dirItemNode.animate(
          [
            {opacity: 0, transform: 'translateY(10px)'},
            {opacity: 1, transform: 'translateY(0px)'},
          ],
          {
            easing: 'ease',
            duration: 500,
          },
        )
      }
    },
    async addThumb (dirItemThumbContainer, dirItemRealPath, dirItemFileType, dirItemNode) {
      return new Promise((resolve, reject) => {
        if (dirItemFileType === 'image') {
          this.fetchImageThumb(dirItemThumbContainer, dirItemRealPath, dirItemNode)
            .then(() => {
              resolve()
            })
        }
        else {
          resolve()
        }
      })
    },
    removeThumb (dirItemThumbContainer) {
      dirItemThumbContainer
        .querySelectorAll('.dir-item-card__thumb')
        .forEach(element => element.remove())
    },
    async fetchImageThumb (dirItemThumbContainer, dirItemRealPath, dirItemNode) {
      // NOTES:
      // - Changed the method of checking for thumbnail existance.
      //   Blocking issue: 'WASM out of memory':
      //   https://github.com/Daninet/hash-wasm/issues/7
      //   Now, instead of comparing files by hash, it compares 3 parameters:
      //   ${fileSize}_${fileDateModified}_${fileNameBase}
      //   It's enough to figure out if a file has changed and needs a new thumb
      return new Promise((resolve, reject) => {
        // Check if thumb dir exists. If not, create it
        if (!fs.existsSync(this.appPaths.storageDirectories.appStorageNavigatorThumbs)) {
          fs.mkdirSync(this.appPaths.storageDirectories.appStorageNavigatorThumbs, {recursive: true})
        }
        const parsedFileName = PATH.parse(dirItemRealPath)
        const fileNameBase = parsedFileName.base
        const fileSize = this.dirItem.stat.size
        const fileDateModified = this.dirItem.stat.mtimeMs
        const thumbPath = this.getThumbPath(fileSize, fileNameBase, fileDateModified)
        if (fs.existsSync(thumbPath)) {
          this.appendImageThumb(dirItemThumbContainer, thumbPath, dirItemRealPath, dirItemNode)
            .then(() => {
              resolve()
            })
        }
        else {
          this.generateImageThumb(dirItemThumbContainer, thumbPath, dirItemRealPath, dirItemNode)
            .then(() => {
              this.appendImageThumb(dirItemThumbContainer, thumbPath, dirItemRealPath, dirItemNode)
                .then(() => {
                  resolve()
                })
            })
        }
      })
    },
    getThumbPath (fileSize, fileNameBase, fileDateModified) {
      // Replace last occurance of '.symlink' so that it loads symlink thumbs as well
      const thumbDir = this.appPaths.storageDirectories.appStorageNavigatorThumbs
      return this.specifiedNavigatorLayout === 'list'
        ? `${thumbDir}/48x48_${fileSize}_${fileDateModified}_${fileNameBase}`.replace(/\\/g, '/')
        : `${thumbDir}/280x158_${fileSize}_${fileDateModified}_${fileNameBase}`.replace(/\\/g, '/')
    },
    async appendImageThumb (dirItemThumbContainer, thumbPath, dirItemRealPath, dirItemNode) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        // image.style.position = 'absolute'
        image.classList.add('dir-item-card__thumb')
        image.setAttribute('src', this.$storeUtils.getSafePath(this.$sharedUtils.getUrlSafePath(thumbPath)))
        if (this.specifiedNavigatorLayout === 'list') {
          image.animate(
            [
              {opacity: 0, transform: 'translateY(4px)'},
              {opacity: 1, transform: 'translateY(0px)'},
            ],
            {
              easing: 'ease',
              duration: 2000,
            },
          )
        }
        else if (this.specifiedNavigatorLayout === 'grid') {
          image.animate(
            [
              {opacity: 0},
              {opacity: 1},
            ],
            {
              easing: 'ease',
              duration: 2000,
            },
          )
        }
        image.decode()
          .then(() => {
            this.loadImageThumb(image, dirItemThumbContainer, dirItemNode)
              .then(() => {
                resolve()
              })
          })
          .catch((error) => {
            resolve()
          })
      })
    },
    async loadImageThumb (image, dirItemThumbContainer, dirItemNode) {
      return new Promise((resolve, reject) => {
        // Remove previous thumb
        while (dirItemThumbContainer.hasChildNodes()) {
          dirItemThumbContainer.removeChild(dirItemThumbContainer.lastChild)
        }
        // Append new thumb
        dirItemThumbContainer.appendChild(image)
        dirItemNode.dataset.thumbIsLoaded = true
        resolve()
      })
    },
    async generateImageThumb (dirItemThumbContainer, thumbPath, dirItemRealPath, dirItemNode) {
      return new Promise((resolve, reject) => {
        this.$emit('addToThumbLoadingSchedule', {
          item: this.dirItem,
          thumbPath,
          onEnd: () => {
            resolve()
          },
        })
      })
    },
    isDirItemSelected (dirItem) {
      return this.selectedDirItemsPaths.includes(dirItem.path)
    },
    showDragOverOverlay (dirItem) {
      return this.inputState.drag.type !== '' &&
        this.inputState.drag.moveActivationTresholdReached &&
        this.inputState.drag.overlappedDropTargetItem.path === dirItem.path
    },
    getThumbIcon (dirItem) {
      const mimeDescription = this.$utils.getFileType(dirItem.path).mimeDescription
      if (mimeDescription === 'video') {
        return 'mdi-play-circle-outline'
      }
      else if (mimeDescription === 'audio') {
        return 'mdi-play-outline'
      }
      else if (mimeDescription === 'image') {
        return 'mdi-image-outline'
      }
      else if (dirItem.type === 'file') {
        return 'mdi-file-outline'
      }
      else if (dirItem.type === 'file-symlink') {
        return 'mdi-file-move-outline'
      }
      else if (dirItem.type === 'directory') {
        return 'mdi-folder-outline'
      }
      else if (dirItem.type === 'directory-symlink') {
        return 'mdi-folder-move-outline'
      }
    },
    handleDirItemMouseDown (event, dirItem, index) {
      if (event.path.some(pathElement => pathElement.classList?.contains('dir-item-card__actions'))) {return}

      this.inputState.drag.type = 'local'
      this.inputState.drag.dirItems = this.selectedDirItems
      this.mouseDown.item = dirItem
      this.mouseDown.leftClick = event.button === 0
      this.mouseDown.rightClick = event.button === 2
      this.mouseDown.downCoordX = event.clientX
      this.mouseDown.downCoordY = event.clientY
      this.mouseDown.clickedItemIsSelected = this.isDirItemSelected(dirItem)
      this.mouseDown.noneItemsSelected = this.selectedDirItems.length === 0
      this.mouseDown.singleItemSelected = this.selectedDirItems.length === 1
      this.mouseDown.multipleItemsSelected = this.selectedDirItems.length > 1
      this.handleMouseDownActions()
      window.addEventListener('mouseup', this.handleMouseUp)
      window.addEventListener('mousemove', this.handleMouseMove)
      window.addEventListener('mouseout', this.handleMouseOut)
      window.addEventListener('blur', this.handleWindowBlur)
      this.inputState.pointer.lastMousedownEvent = event
    },
    handleMouseMove (mousemoveEvent) {
      this.inputState.drag.type = 'local'
      this.inputState.drag.isStarted = true
      this.inputState.drag.moveActivationTresholdReached = this.isMoveActivationTresholdReached(mousemoveEvent)
      this.inputState.pointer.lastMousedownMoveEvent.clientX = mousemoveEvent.clientX
      this.inputState.pointer.lastMousedownMoveEvent.clientY = mousemoveEvent.clientY
    },
    handleMouseUp () {
      this.showDirItemDragOverlay = false
      this.handleMouseMoveUpActions()
      this.handleMouseMoveUpDragActions()
      this.resetValues()
    },
    handleMouseOut (event) {
      const wentBeyondLeftWindowBorder = event.clientX <= 0
      const wentBeyondTopWindowBorder = event.clientY <= 0
      const wentBeyondRightWindowBorder = event.clientX >= window.innerWidth
      const wentBeyondBottomWindowBorder = event.clientY >= window.innerHeight
      this.inputState.drag.isInsideWindow = !(wentBeyondLeftWindowBorder ||
        wentBeyondTopWindowBorder ||
        wentBeyondRightWindowBorder ||
        wentBeyondBottomWindowBorder)
      if (!this.inputState.drag.isInsideWindow) {
        this.initOutboundDirItemDrag()
      }
    },
    handleWindowBlur () {
      this.initOutboundDirItemDrag()
    },
    handleMouseMoveUpActions () {
      const {
        item,
        leftClick,
        rightClick,
        downCoordX,
        downCoordY,
        clickedItemIsSelected,
        singleItemSelected,
        multipleItemsSelected,
      } = this.mouseDown

      if (!this.inputState.drag.moveActivationTresholdReached) {
        // Handle pointer_btn_1_up
        if ((this.inputState.ctrl || this.inputState.shift) && leftClick) {
          if (clickedItemIsSelected) {
            this.$store.dispatch('DESELECT_DIR_ITEM', item)
          }
          else if (!clickedItemIsSelected) {
            this.$store.dispatch('DESELECT_DIR_ITEM', this.currentDir)
            this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', item)
          }
        }
        else if (leftClick && !this.inputState.shift && !this.inputState.ctrl) {
          // Handle 2nd pointer_btn_1_up
          clearTimeout(this.dirItemAwaitsSecondClickTimeout)
          if (this.dirItemAwaitsSecondClick) {
            this.$store.dispatch('OPEN_DIR_ITEM', item)
            this.dirItemAwaitsSecondClick = false
          }
          // Handle 1st pointer_btn_1_up
          else {
            if (this.navigatorOpenDirItemWithSingleClick && !this.inputState.alt) {
              this.$store.dispatch('OPEN_DIR_ITEM', item)
            }
            else {
              this.dirItemAwaitsSecondClick = true
              this.dirItemAwaitsSecondClickTimeout = setTimeout(() => {
                this.dirItemAwaitsSecondClick = false
              }, this.openDirItemSecondClickDelay)
            }
            if (multipleItemsSelected && clickedItemIsSelected) {
              this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
              this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', item)
            }
            else if (singleItemSelected && clickedItemIsSelected) {
              this.$store.dispatch('DESELECT_DIR_ITEM', item)
            }
          }
        }
        // Handle pointer_btn_2_up
        else if (rightClick) {
          if (!clickedItemIsSelected) {
            this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
            this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', item)
          }
          this.$store.dispatch('SET_CONTEXT_MENU', {
            x: downCoordX,
            y: downCoordY,
          })
        }
      }
    },
    async handleMouseMoveUpDragActions () {
      if (this.inputState.drag.moveActivationTresholdReached) {
        const dropTargetPath = this.inputState.drag.overlappedDropTargetItem.path
        const overlappedSomeDropTargetItem = dropTargetPath !== ''
        if (overlappedSomeDropTargetItem) {
          const dropTargetItemIsDirectory = fs.statSync(dropTargetPath).isDirectory()
          if (dropTargetItemIsDirectory) {
            if (this.inputState.shift) {
              await this.$store.dispatch('copyDirItems', {
                items: this.selectedDirItems,
                directory: dropTargetPath,
              })
            }
            else {
              await this.$store.dispatch('moveDirItems', {
                items: this.selectedDirItems,
                directory: dropTargetPath,
              })
            }
          }
        }
      }
    },
    handleMouseDownActions () {
      const {item, leftClick, clickedItemIsSelected} = this.mouseDown
      const isSelectingNotSelectedDirItem = leftClick &&
        !clickedItemIsSelected &&
        !this.inputState.ctrl &&
        !this.inputState.shift
      const isSelectingDirItemRange = leftClick && this.inputState.shift
      // Handle pointer_btn_1_down
      if (isSelectingNotSelectedDirItem) {
        this.$store.dispatch('DESELECT_ALL_DIR_ITEMS')
        this.$store.dispatch('ADD_TO_SELECTED_DIR_ITEMS', item)
      }
      else if (isSelectingDirItemRange) {
        this.$store.dispatch('SELECT_DIR_ITEM_RANGE', item)
      }
    },
    handleDirItemMouseEnter (event, item) {
      if (!this.inputState.drag.isStarted) {
        this.inputState.pointer.hover.itemType = 'dirItem'
        this.inputState.pointer.hover.item = item
        this.$store.dispatch('HANDLE_HIGHLIGHT_DIR_ITEM_RANGE', {
          hoveredItem: item,
        })
      }
    },
    handleDirItemMouseLeave (event, item) {
      this.inputState.pointer.hover.itemType = ''
      this.inputState.pointer.hover.item = {}
    },
    handleDirItemMiddleMouseDown (event, item) {
      event.preventDefault()
      this.$store.dispatch('ADD_TAB', {item})
    },
    initOutboundDirItemDrag () {
      this.inputState.drag.type = 'outbound'
      if (this.inputState.drag.dirItems.length > 0) {
        const diritemsPaths = this.inputState.drag.dirItems.map(item => item.path)
        electron.ipcRenderer.send('window:drag-out', diritemsPaths)
      }
      this.resetValues()
    },
    isMoveActivationTresholdReached (mousemoveEvent) {
      const distanceX = Math.abs(this.inputState.pointer.lastMousedownEvent.clientX - mousemoveEvent.clientX)
      const distanceY = Math.abs(this.inputState.pointer.lastMousedownEvent.clientY - mousemoveEvent.clientY)
      return distanceX > this.inputState.drag.moveActivationTreshold ||
             distanceY > this.inputState.drag.moveActivationTreshold
    },
  },
}
</script>

<style>
.dir-item-card {
  --blue-highlight-color-value: 159, 168, 218;
  --green-highlight-color-value: 75, 200, 140;
  --red-highlight-color-value: 200, 50, 80;
}

@keyframes outline-pulse-animation {
  0% {outline-color: rgb(var(--blue-highlight-color-value), 0.4);}
  50% {outline-color: rgb(255, 255, 255, 0.1);}
  100% {outline-color: rgb(var(--blue-highlight-color-value), 0.4);}
}

.dir-item-row-grid[type="directory"],
.dir-item-row-grid[type="directory-symlink"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 64px;
  gap: 24px;
}

.dir-item-row-grid[type="file"],
.dir-item-row-grid[type="file-symlink"]  {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 158px;
  gap: 24px;
}

.dir-item-card__overlay-container {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  width: 100%;
  height: 100%;
}

.dir-item-card__overlay {
  z-index: 1;
  position: absolute;
  width: 100%;
  height: 100%;
  outline-offset: -2px;
  pointer-events: none;
}

.dir-item-card__overlay--selected {
  background-color: rgb(var(--blue-highlight-color-value), 0.05);
  outline: 1px solid rgb(var(--blue-highlight-color-value), 0.2);
  outline-offset: -1px;
}

[data-layout="grid"]
  .dir-item-card__overlay--selected {
    background-color: rgb(var(--blue-highlight-color-value), 0.08);
    outline: 1px solid rgb(var(--blue-highlight-color-value), 0.4);
    outline-offset: 0;
  }

[data-layout="grid"][data-file-type="image"]
  .dir-item-card__overlay--selected {
    background-color: rgb(var(--blue-highlight-color-value), 0.3);
    outline: 1px solid rgb(var(--blue-highlight-color-value), 0.5);
  }

.dir-item-card[in-fs-clipboard][fs-clipboard-type="copy"]
  .dir-item-card__overlay--selected {
    opacity: 0;
  }

.dir-item-card[in-fs-clipboard][fs-clipboard-type="move"]
  .dir-item-card__overlay--selected {
    opacity: 0;
  }

.dir-item-card[in-fs-clipboard]:not([is-selected])[fs-clipboard-type="copy"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--green-highlight-color-value), 0.03);
    outline: 2px dotted rgba(var(--green-highlight-color-value), 0.2);
    background-image: repeating-linear-gradient(
      -45deg,
      rgba(var(--green-highlight-color-value), 0.1) 0,
      rgba(var(--green-highlight-color-value), 0.1) 2px,
      transparent 0,
      transparent 50%
    );
    background-repeat: repeat;
    background-size: 16px 16px;
  }

.dir-item-card[in-fs-clipboard]:not([is-selected])[fs-clipboard-type="move"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--red-highlight-color-value), 0.02);
    outline: 2px dotted rgba(var(--red-highlight-color-value), 0.4);
    background-image: repeating-linear-gradient(
      -45deg,
      rgba(var(--red-highlight-color-value), 0.2) 0,
      rgba(var(--red-highlight-color-value), 0.2) 2px,
      transparent 0,
      transparent 50%
    );
    background-repeat: repeat;
    background-size: 16px 16px;
  }

.dir-item-card[in-fs-clipboard][is-selected][fs-clipboard-type="copy"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--green-highlight-color-value), 0.03);
    outline: 2px dotted rgba(var(--green-highlight-color-value), 0.2);
  }

.dir-item-card[in-fs-clipboard][is-selected][fs-clipboard-type="move"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--red-highlight-color-value), 0.04);
    outline: 2px dotted rgba(var(--red-highlight-color-value), 0.5);
  }

.dir-item-card[data-layout="grid"][data-file-type="image"][in-fs-clipboard][is-selected][fs-clipboard-type="copy"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--green-highlight-color-value), 0.2);
    outline: 2px dotted rgba(var(--green-highlight-color-value), 0.2);
  }

.dir-item-card[data-layout="grid"][data-file-type="image"][in-fs-clipboard][is-selected][fs-clipboard-type="move"]
  .dir-item-card__overlay--fs-clipboard {
    background-color: rgba(var(--red-highlight-color-value), 0.2);
    outline: 2px dotted rgba(var(--red-highlight-color-value), 0.5);
  }

.dir-item-card__overlay--highlighted {
  background-color: rgb(var(--blue-highlight-color-value), 0.05);
  outline: 2px solid rgb(var(--blue-highlight-color-value), 0.3);
  transition: all 0.3s;
  opacity: 0;
}

.dir-item-card__overlay--highlighted.is-visible {
  transition: all 0.3s;
  opacity: 1;
  animation: outline-pulse-animation 2s infinite;
}

.dir-item-card__overlay--hover {
  background-color: var(--highlight-color-5);
  opacity: 0;
}

[data-layout="grid"][data-type="directory"].dir-item-card__container,
[data-layout="grid"][data-type="directory-symlink"].dir-item-card__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 64px;
  gap: 24px;
}

[data-layout="grid"][data-type="file"].dir-item-card__container,
[data-layout="grid"][data-type="file-symlink"].dir-item-card__container {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  grid-auto-rows: 158px;
  gap: 24px;
}

/* CARD */
.dir-item-card * {
  user-select: none;
}

.dir-item-card {
  position: relative;
  z-index: 1;
  /* background-color: var(--bg-color-1); */
  background-color: var(--dir-item-card-bg);
  transition: all 0.3s ease-in-out; /* 'leave' transition */
}

.dir-item-card[cursor="pointer"] {
  cursor: pointer;
}

.dir-item--divider {
  z-index: 1;
  display: flex;
  align-items: center;
  height: 36px;
  margin: 0px !important;
  padding: 0px 0px;
  border-bottom: 1px solid var(--dir-item-card-border-3);
}

.dir-item-card:hover {
  /* transition: all 0.05s; /* 'enter' transition */
  transition: all 0s; /* 'enter' transition */
  z-index: 2;
}

.dir-item-card:not([data-item-hover-is-paused])[data-hover-effect="scale"]:hover {
  box-shadow: 0px 4px 32px rgb(0, 0, 0, 0.3) !important;
  transform: scale(1.02);
}

.dir-item-card[data-hover-effect="highlight"]:hover
  .dir-item-card__overlay--hover {
    opacity: 1;
  }

.search-widget__container
  .dir-item-card {
    margin: 0 24px;
  }

[data-layout="list"][data-type="directory"]
  .dir-item-card__content-container,
[data-layout="list"][data-type="directory-symlink"]
  .dir-item-card__content-container,
[data-layout="list"][data-type="file"]
  .dir-item-card__content-container,
[data-layout="list"][data-type="file-symlink"]
  .dir-item-card__content-container {
    display: grid;
    border-bottom: 1px solid var(--dir-item-card-border-3);
    /* Set the element height to 48px, otherwise
      the bottom border increases the height to 49px */
    height: 48px;
  }

[data-layout="list"][data-type="directory"]
  .dir-item-card__content-container__item,
[data-layout="list"][data-type="directory-symlink"]
  .dir-item-card__content-container__item,
[data-layout="list"][data-type="file"]
  .dir-item-card__content-container__item,
[data-layout="list"][data-type="file-symlink"]
  .dir-item-card__content-container__item {
    display: flex;
    align-items: center;
    justify-content: center;
    padding:
      var(--workspace-area-sorting-header-item-v-padding)
      var(--workspace-area-sorting-header-item-h-padding);
  }

.dir-item-card[data-layout="list"]
  .dir-item-card__content-container__item:nth-child(1) {
    padding: 0;
  }

.dir-item-card[data-layout="list"]
  .dir-item-card__content-container__item:nth-child(2) {
    justify-content: flex-start;
    padding: 0 var(--workspace-area-sorting-header-item-2-h-padding);
  }

[data-layout="list"]
  .dir-item-card__content-container__item:not(:nth-child(2))
    .dir-item-card__name {
      text-align: center;
    }

.dir-item-card[data-layout="list"]
  .dir-item-card__name {
    width: var(--name-column-max-width, 50%);
  }

@media (max-width: 800px) {
  .dir-item-card[data-layout="list"]
    .dir-item-card__name {
      width: 100%;
    }
}

[data-layout="grid"][data-type="directory"]
  .dir-item-card,
[data-layout="grid"][data-type="directory-symlink"]
  .dir-item-card {
    height: 64px;
  }

[data-layout="grid"][data-type="directory"]
  .dir-item-card__content-container,
[data-layout="grid"][data-type="directory-symlink"]
  .dir-item-card__content-container {
    display: grid;
    grid-template-columns: 64px 1fr 48px;
    gap: 0px;
    box-shadow: 0px 4px 16px rgb(0, 0, 0, 0.1);
    /* border: 1px solid var(--dir-item-card-border-3) !important; */
    border: 0px solid transparent !important;
    background-color: var(--bg-color-1);
    border-radius: 8px;
    height: 64px;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card {
    height: 158px;
    border: 0px solid transparent !important;
    background-color: var(--bg-color-1);
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__content-container,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__content-container {
    box-shadow:
      -4px -4px 8px rgb(255, 255, 255, 0.05),
      0px 4px 12px rgb(0, 0, 0, 0.3);
    /* border: 1px solid var(--dir-item-card-border-3) !important; */
    height: 100%;
    width: 100%;
      /* #1D78A1
    #0E438B
    #ED519C
    #5A128D */
    /* background:
      linear-gradient(217deg, #4164a5, rgba(255,0,0,0) 70.71%),
      linear-gradient(127deg, #1D78A1, rgba(0,255,0,0) 70.71%),
      linear-gradient(336deg, #ED519C, rgba(0,0,255,0) 60.71%); */
  }

[data-layout="grid"][data-type="file"]:not([data-file-type="image"])
  .dir-item-card__content-container,
[data-layout="grid"][data-type="file-symlink"]:not([data-file-type="image"])
  .dir-item-card__content-container {
    /* box-shadow:
      -4px -4px 8px #4164a544,
      0px 4px 12px #ED519C44;
  */
  }

/* CARD CONTENT */
[data-layout="grid"][data-type="file"]
  .dir-item-card__bottom-container,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__bottom-container {
    /* display: block; */
    position: absolute;
    bottom: 0;
    left: 0;
    padding: 2px 16px;
    height: 52px;
    width: 100%;
    text-align: center;
    z-index: 3;
  }

[data-layout="grid"][data-type="file"][data-file-type="image"]
  .dir-item-card__overlay,
[data-layout="grid"][data-type="file-symlink"][data-file-type="image"]
  .dir-item-card__overlay {
    background-image: linear-gradient(0deg, rgb(0, 0, 0, 0.8) 0%, rgb(0, 0, 0, 0.0) 100%);
    position: absolute;
    bottom: 0;
    left: 0;
    height: 100%;
    width: 100%;
    z-index: 0;
  }

.dir-item-card__ext,
.dir-item-card__name,
.dir-item-card__item-count,
.dir-item-card__item-size,
.dir-item-card__date {
  color: var(--color-6) !important;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.dir-item-card__name {
  display: flex;
  flex-direction: column;
}

.dir-item-card__name__line-1 {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dir-item-card__ext-container {
  padding: 0 8px;
}

.dir-item-card__ext {
  width: 100%;
  text-align: center;
  font-size: 12px;
  text-overflow: clip;
}

.dir-item-card__item-count,
.dir-item-card__date,
.dir-item-card__item-size {
  color: var(--color-7) !important;
}

[data-file-type="image"][data-layout="grid"][data-type="file"]
  .dir-item-card__name,
[data-file-type="image"][data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__name {
    color: var(--color-4) !important;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__name,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__name {
    color: var(--color-5) !important;
    line-height: 1.3;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__item-count,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__item-count {
    font-size: 14px;
  }

[data-file-type="image"][data-layout="grid"][data-type="file"]
  .dir-item-card__item-count,
[data-file-type="image"][data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__item-count {
    color: var(--color-6) !important;
  }

[data-layout="list"]
  .dir-item-card__thumb-container {
    width: 48px;
    height: 48px;
    background-color: rgba(255, 255, 255, 0.04);
  }

#app[dir-item-background="none"]
  [data-layout="list"]
    .dir-item-card__thumb-container  {
      background-color: transparent;
    }

[data-layout="grid"][data-type="directory"]
  .dir-item-card__thumb-container,
[data-layout="grid"][data-type="directory-symlink"]
  .dir-item-card__thumb-container {
    width: 64px;
    height: 64px;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__thumb-container,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__thumb-container {
    width: 100%;
    height: 100%;
  }

.dir-item-card__thumb {
  width: 100%;
  height: 100%;
}

img.dir-item-card__thumb {
  object-fit: cover;
}

[data-layout="list"]
  .dir-item-card__name__line-2 {
    color: var(--color-7);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

[data-layout="list"][data-type="file"]
  .dir-item-card__thumb,
[data-layout="list"][data-type="file-symlink"]
  .dir-item-card__thumb {
    background-color: var(--file-thumb-color);
    width: 48px;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__thumb,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__thumb {
    background-color: var(--file-thumb-color);
    width: 100%;
  }

[data-type="directory"]
  .dir-item-card__thumb,
[data-type="directory-symlink"]
  .dir-item-card__thumb {
    background-color: var(--directory-thumb-color);
  }

[data-type="file"]
  .dir-item-card__icon,
[data-type="file-symlink"]
  .dir-item-card__icon {
    color: var(--dir-item-card-icon-color) !important;
  }

[data-type="directory"]
  .dir-item-card__icon,
[data-type="directory-symlink"]
  .dir-item-card__icon {
    color: var(--dir-item-card-icon-color) !important;
  }

[data-layout="grid"][data-type="file"]
  .dir-item-card__icon,
[data-layout="grid"][data-type="file-symlink"]
  .dir-item-card__icon {
    margin-top: -24px;
  }

.dir-item-card__actions {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  right: 48px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 1;
  opacity: 0;
  transition: all 0.2s ease;
}

.dir-item-card:hover
  .dir-item-card__actions {
    opacity: 1;
    transition: all 0.3s;
  }
</style>
