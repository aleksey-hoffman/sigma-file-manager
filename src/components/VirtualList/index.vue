<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div
    ref="rootContainer"
    class="
      virtual-list__root-container
      main-content-container
      custom-scrollbar
      drag-drop-container
      unselectable
      fade-mask--bottom
    "
    :style="{
      '--fade-mask-bottom': `${bottomFadeMaskHeightCurrentValue}%`,
    }"
    :sorting-display-type="navigatorSortingElementDisplayType"
  >
    <div
      ref="viewportContainer"
      class="virtual-list__viewport-container"
      :style="viewportContainerStyle"
    >
      <div
        ref="viewport"
        class="virtual-list__viewport"
        :style="viewportStyle"
      >
        <template v-if="layout === 'list'">
          <div
            v-for="(item, index) in renderedItems"
            :key="item.name"
            class="dir-item mx-6"
            :style="{ height: item.height }"
          >
            <!-- item:top-spacer -->
            <template v-if="item.type === 'top-spacer'">
              <div
                class="
                  dir-item-node
                  dir-item--spacer
                  unselectable
                "
                :style="{ height: `${item.height}px` }"
              />
            </template>

            <!-- item:divider -->
            <div
              v-if="['directory-divider', 'file-divider'].includes(item.type)"
              :key="`dir-item-${item.path}`"
              class="dir-item-node dir-item--divider unselectable text--sub-title-1"
              :height="item.height"
            >
              {{item.title}}
            </div>

            <!-- item:['directory', 'directory-symlink', 'file', 'file-symlink'] -->
            <dir-item
              v-if="['directory', 'directory-symlink', 'file', 'file-symlink'].includes(item.type)"
              :key="`dir-item-${item.path}`"
              :ref="'dirItem' + item.positionIndex"
              :dir-item="item"
              :index="index"
              :height="item.height"
              :type="item.type"
              :item-hover-is-paused="status.itemHover.isPaused"
              @addToThumbLoadingSchedule="addToThumbLoadingSchedule"
              @removeFromThumbLoadingSchedule="removeFromThumbLoadingSchedule"
            />

            <!-- item:bottom-spacer -->
            <template v-if="item.type === 'bottom-spacer'">
              <div
                class="
                  dir-item-node
                  dir-item--spacer
                  unselectable
                "
                :style="{ height: `${item.height}px` }"
              />
            </template>
          </div>
        </template>

        <template v-else>
          <div class="dir-item-row-grid">
            <dir-item-row
              v-for="row in renderedItems"
              :key="`dir-item-row-${row.positionIndex}`"
              :ref="'dirItemRow' + row.positionIndex"
              class="dir-item"
              :row="row"
              :type="row.type"
              :item-hover-is-paused="status.itemHover.isPaused"
              :style="{
                'margin-bottom': `${row.marginBottom}px`
              }"
              @addToThumbLoadingSchedule="addToThumbLoadingSchedule"
              @removeFromThumbLoadingSchedule="removeFromThumbLoadingSchedule"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import TimeUtils from '@/utils/timeUtils.js'
import ThumbWorker from 'worker-loader!@/workers/thumbWorker.js'

export default {
  props: {
    items: {
      type: Array,
      default: () => ([]),
    },
    layout: {
      type: String,
      default: '',
    },
    getScrollStatus: {
      type: Boolean,
      default: false,
    },
    calculateScrollSpeed: {
      type: Boolean,
      default: false,
    },
  },
  data () {
    return {
      status: {
        itemHover: {
          isPaused: false,
        },
        thumbLoading: {
          isPaused: false,
          isForced: false,
          isLocked: false,
          schedule: [],
        },
        scroll: {
          stopTimeout: null,
          currentPosition: 0,
          previousPosition: 0,
          delta: 0,
          direction: '',
          speed: 0,
          speedHistorySize: 10,
          speedHistory: [],
          bottomReached: false,
        },
      },
      mutationObserver: null,
      initialized: false,
      nodes: [],
      dirItemNodes: [],
      bottomFadeMaskHeightCurrentValue: 10,
      bottomFadeMaskHeight: 10,
      totalHeight: 0,
      initialItems: 0,
      bufferItems: 2,
      rowHeight: 48,
      rootContainerHeight: 600,
      previousRenderedItems: [],
      renderedItemsizes: [],
      allItemSizes: [],
      loadedDirItems: [],
      firstItemIsLoaded: false,
      lastItemIsLoaded: false,
      previousLoadedItemsCount: 0,
      topSpacerSize: 0,
      bottomSpacerSize: 0,
      throttle: null,
      thumbWorker: null,
      setValuesTimeouts: {
        currentDirPath: null,
      },
    }
  },
  mounted () {
    this.setItemsSizeProperties()
    this.thumbWorker = new ThumbWorker()
    this.throttle = new TimeUtils()
    this.$refs.rootContainer.addEventListener(
      'scroll',
      this.scrollHandler,
      {passive: true},
    )
    // this.initMutationObserver()
    setTimeout(() => {
      this.setValues()
      this.previousRenderedItems = this.renderedItems
    }, 100)
  },
  beforeDestroy () {
    // Remove timeouts to avoid memory leaks and errors from setValues()
    clearTimeout(this.setValuesTimeouts.currentDirPath)
    this.$refs.rootContainer.removeEventListener(
      'scroll',
      this.scrollHandler,
      {passive: true},
    )
  },
  watch: {
    items () {
      this.setItemsSizeProperties()
      this.setValues()
    },
    'status.scroll.bottomReached' (value) {
      if (value) {
        this.animateRange({
          start: this.bottomFadeMaskHeight,
          end: 0,
          steps: 25,
          stepDuration: 1,
          target: 'bottomFadeMaskHeightCurrentValue',
        })
      }
      else {
        this.animateRange({
          start: 0,
          end: this.bottomFadeMaskHeight,
          steps: 25,
          stepDuration: 1,
          target: 'bottomFadeMaskHeightCurrentValue',
        })
      }
    },
    renderedItems (newValue, oldValue) {
      this.previousRenderedItems = this.renderedItems
      if (newValue.length !== oldValue.length) {
        this.setValues()
      }
    },
    'currentDir.path': {
      handler (newValue, oldValue) {
        this.setValuesTimeouts.currentDirPath = setTimeout(() => {
          this.setValues()
        }, 100)
      },
      deep: true,
    },
    windowSize () {
      this.setValues()
    },
  },
  computed: {
    ...mapFields({
      dirItems: 'navigatorView.dirItems',
      appPaths: 'storageData.settings.appPaths',
      windowSize: 'windowSize',
      currentDir: 'navigatorView.currentDir',
      navigatorSortingElementDisplayType: 'storageData.settings.navigator.sorting.elementDisplayType',
    }),
    ...mapGetters([
      'clipboardToolbarIsVisible',
    ]),
    renderedItems () {
      return this.items.slice(
        this.amountScrolledItems,
        this.amountScrolledItems + this.amountRenderedItems,
      )
    },
    amountRenderedItems () {
      let itemHeightSum = 0
      let amountItemsFillRootContainerHeight = 0
      this.allItemSizes.forEach(itemHeight => {
        if (itemHeightSum < this.rootContainerHeight) {
          itemHeightSum += itemHeight
          amountItemsFillRootContainerHeight += 1
        }
      })
      return amountItemsFillRootContainerHeight + this.bufferItems
    },
    amountScrolledItems () {
      let sum = 0
      let counter = 0
      this.allItemSizes.forEach(item => {
        if (sum <= this.status.scroll.currentPosition) {
          sum += item
          counter += 1
        }
      })
      return counter - 1
    },
    offsetY () {
      // return this.startIndex * this.rowHeight
      return this.allItemSizes
        .slice(
          0,
          this.amountScrolledItems,
        )
        .reduce((a, b) => a + b, 0)

      // return this.status.scroll.currentPosition
    },
    viewportContainerStyle () {
      let height = this.totalHeight
      if (this.clipboardToolbarIsVisible) {
        height += 36
      }
      return {
        height: `${height}px`,
        padding: this.layout === 'grid' ? '0px 24px' : '0',
      }
    },
    viewportStyle () {
      return {
        transform: `translateY(${this.offsetY}px)`,
      }
    },
  },
  methods: {
    scrollToItem (path) {
      const targetItemIndex = this.items.find(item => item.path === path)?.positionIndex
      if (targetItemIndex) {
        this.scrollToIndex(targetItemIndex)
      }
    },
    scrollToIndex (index) {
      this.$refs.rootContainer.scrollTop = this.getIndexTopOffset(index)
    },
    getIndexTopOffset (index) {
      return this.items.slice(0, index).reduce((a, b) => a + (b.height || 0), 0)
    },
    setItemsSizeProperties () {
      this.allItemSizes = this.items.map(item => item.height)
      this.totalHeight = this.items.reduce((a, b) => a + (b.height || 0), 0)
    },
    addToLoadedList (path) {
      this.loadedDirItems.push(path)
    },
    removeFromLoadedList (path) {
      const index = this.loadedDirItems.findIndex(item => item === path)
      this.loadedDirItems.splice(index, 1)
    },
    animateRange (props) {
      const defaultProps = {
        start: 0,
        end: 10,
        steps: 10,
        stepDuration: 500,
        timingFunction: 'linear',
        target: null,
      }
      props = {...defaultProps, ...props}
      const {start, end, steps, stepDuration, timingFunction, target} = props
      const interpolatedList = this.interpolateChange({
        start,
        end,
        steps,
        stepDuration,
      })
      let step = 0
      const interval = setInterval(() => {
        if (step < interpolatedList.length) {
          this[target] = interpolatedList[step]
          step += 1
        }
        else {
          clearInterval(interval)
        }
      }, stepDuration)
    },
    interpolateChange (props) {
      const defaultProps = {
        start: 0,
        end: 10,
        steps: 10,
        stepDuration: 500,
        timingFunction: 'linear',
      }
      props = {...defaultProps, ...props}
      const {start, end, steps, stepDuration, timingFunction} = props
      const parts = this.splitIntoEqualParts({
        start,
        end,
        steps,
      })
      return parts
    },
    splitIntoEqualParts (props) {
      let {start, end, steps} = props
      const result = []
      if (start === end) {
        return [start]
      }
      if (start > end) {
        const delta = (start - end) / (steps - 1)
        while (Math.round(end) < start) {
          result.push(end)
          end += delta
        }
        result.push(start)
        result.reverse()
      }
      else {
        const delta = (end - start) / (steps - 1)
        while (Math.round(start) < end) {
          result.push(start)
          start += delta
        }
        result.push(end)
      }
      return result
    },
    async handleThumbLoad (payload) {
      return new Promise((resolve, reject) => {
        this.status.thumbLoading.isLocked = true
        this.generateImageThumb(payload.item.path, payload.item.realPath, payload.thumbPath)
          .then((event) => {
            this.status.thumbLoading.isLocked = false
            this.removeFromThumbLoadingSchedule(payload)
            if (event.data.result === 'error') {
              payload?.onError?.()
            }
            else {
              payload?.onEnd?.()
            }
            resolve()
            if (this.status.thumbLoading.schedule.length > 0) {
              this.handleThumbLoad(this.status.thumbLoading.schedule[0])
            }
          })
      })
    },
    addToThumbLoadingSchedule (payload) {
      this.status.thumbLoading.schedule.push(payload)
      if (!this.status.thumbLoading.isLocked && !payload.item.isInaccessible) {
        this.handleThumbLoad(payload)
      }
    },
    removeFromThumbLoadingSchedule (payload) {
      const index = this.status.thumbLoading.schedule.findIndex(object => object.item.path === payload.item.path)
      if (index !== -1) {
        this.status.thumbLoading.schedule.splice(index, 1)
      }
    },
    async generateImageThumb (dirItemPath, dirItemRealPath, thumbPath) {
      return new Promise((resolve, reject) => {
        this.thumbWorker.postMessage({
          action: 'gen-thumb',
          layout: this.layout,
          dirItemRealPath: dirItemRealPath,
          thumbPath: thumbPath,
          appPaths: this.appPaths,
        })
        this.thumbWorker.onmessage = (event) => {
          resolve(event)
        }
      })
    },
    getAmountScrolledItems () {
      let counter = 0
      let sum = 0
      while (sum <= this.status.scroll.currentPosition) {
        sum = this.allItemSizes
          .slice(0, counter + 1)
          .reduce((a, b) => a + b, 0) // sum array values
        counter += 1
      }
      return counter - 1
    },
    // initMutationObserver () {
    //   let config = {
    //     attributes: true,
    //     childList: true,
    //     subtree: true
    //   }
    //   this.mutationObserver = new MutationObserver(this.mutationObserverHandler)
    //   this.mutationObserver.observe(this.$refs.viewportContainer, config)
    // },
    // mutationObserverHandler (mutationsList, observer) {
    //   for (let mutation of mutationsList) {
    //     if (mutation.type === 'childList') {
    //     }
    //   }
    // },
    setScrollStatus (element) {
      this.status.scroll.previousPosition = this.status.scroll.currentPosition
      this.status.scroll.currentPosition = element.scrollTop
      if (this.getScrollStatus) {
        this.status.scroll.delta = this.status.scroll.currentPosition - this.status.scroll.previousPosition
        this.status.scroll.direction = this.status.scroll.delta > 0 ? 'down' : 'up'
        if (this.calculateScrollSpeed) {
          this.recordScrollSpeedHistory(this.status.scroll.delta)
          const speedSum = Math.abs((this.status.scroll.speedHistory).reduce((a, b) => a + b, 0))
          this.status.scroll.speed = speedSum / this.status.scroll.speedHistory.length
        }
      }
    },
    recordScrollSpeedHistory (scrollSpeed) {
      if (this.status.scroll.speedHistory.length > this.status.scroll.speedHistorySize) {
        this.status.scroll.speedHistory.splice(0, 1)
      }
      this.status.scroll.speedHistory.push(scrollSpeed)
    },
    scrollHandler (event) {
      this.status.itemHover.isPaused = true
      this.setScrollStatus(this.$refs.rootContainer)
      this.handleScrollStart()
      this.setValues()
      this.handleScrollStop()
      this.status.scroll.bottomReached = Math.ceil(this.status.scroll.currentPosition + this.rootContainerHeight) >= this.totalHeight
      this.$emit('scroll', {
        event,
        status: this.status.scroll,
      })
    },
    handleScrollStart () {
      this.status.thumbLoading.isForced = false
      this.status.thumbLoading.isPaused = true
      this.status.itemHover.isPaused = true
    },
    handleScrollStop () {
      clearTimeout(this.status.scroll.stopTimeout)
      this.status.scroll.stopTimeout = setTimeout(() => {
        this.status.thumbLoading.isForced = true
        this.status.thumbLoading.isPaused = false
        this.status.itemHover.isPaused = false
        this.status.scroll.speedHistory = []
      }, 250)
    },
    setValues () {
      if (!this.$refs.rootContainer) {return}
      const nodes = document.querySelectorAll('.dir-item')
      const dirItemNodes = document.querySelectorAll('.dir-item-node')
      this.nodes = nodes
      this.dirItemNodes = dirItemNodes
      this.status.scroll.currentPosition = this.$refs.rootContainer.scrollTop
      this.rootContainerHeight = this.$refs.rootContainer.clientHeight
      this.renderedItemsizes = this.renderedItems.map(item => item.height)
      this.appendPropertyIsInViewport(dirItemNodes)
      document.querySelector('.virtual-list__viewport').dataset.allItemSizes = this.allItemSizes
    },
    appendPropertyIsInViewport (dirItemNodes) {
      dirItemNodes.forEach(async (node) => {
        const isInViewport = await this.isHTMLNodeInViewport(node)
        node.dataset.isInViewport = isInViewport
      })
    },
    isHTMLNodeInViewport (domElement) {
      return new Promise(resolve => {
        const observer = new IntersectionObserver(([entry]) => {
          resolve(entry.intersectionRatio > 0)
          observer.disconnect()
        })
        observer.observe(domElement)
      })
    },
  },
}
</script>

<style>
.virtual-list__root-container {
  overflow-x: hidden;
  height: 100%;
  flex: 1;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height)
  );
}

.virtual-list__root-container[sorting-display-type="toolbar"] {
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height) -
    var(--workspace-area-sorting-header-height)
  );
}

.virtual-list__viewport-container {
  min-height: 100%;
  overflow: hidden;
}
</style>
