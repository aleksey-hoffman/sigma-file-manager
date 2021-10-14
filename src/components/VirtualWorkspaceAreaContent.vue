<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div>
    <!-- debug-info -->
    <!-- scrollTop: {{scrollTop.toFixed(2)}} |
    total height: {{totalHeight}} |
    root height: {{rootHeight}} |
    amountScrolledItems {{amountScrolledItems}} |
    paused: {{thumbLoadingIsPaused}} |
    offsetY: {{offsetY}} |
    thumbLoadSchedule.length: {{thumbLoadSchedule.length}} |
    renderedItemsizes: {{renderedItemsizes}}
    allItemSizes: {{allItemSizes}} -->

    <div
      v-if="layout === 'list'"
      id="workspace-area__content"
      class="
        root
        workspace-area__content
        main-content-container
        custom-scrollbar
        drag-drop-container
        unselectable
        fade-mask--bottom
      "
      :style="{
        '--fade-mask-bottom': `${bottomFadeMaskHeightCurrentValue}%`,
      }"
      ref="root"
    >
      <div  class="viewport-container" ref="viewportContainer" :style="viewportContainerStyle">
        <div class="viewport" ref="viewport" :style="viewportStyle">
          <div
            class="dir-item mx-6"
            v-for="(item, index) in renderedItems"
            :key="item.name"
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
              ></div>
            </template>

            <!-- item:divider -->
            <div
              class="dir-item-node dir-item--divider unselectable text--sub-title-1"
              v-if="['directory-divider', 'file-divider'].includes(item.type)"
              :key="`dir-item-${item.path}`"
              :height="item.height"
            >{{item.title}}
            </div>

            <!-- item:['directory', 'directory-symlink', 'file', 'file-symlink'] -->
            <dir-item
              v-if="['directory', 'directory-symlink', 'file', 'file-symlink'].includes(item.type)"
              :key="`dir-item-${item.path}`"
              :source="item"
              :index="index"
              :height="item.height"
              :type="item.type"
              :thumbLoadingIsPaused="thumbLoadingIsPaused"
              :forceThumbLoad="forceThumbLoad"
              :status="status"
              :thumbLoadSchedule="thumbLoadSchedule"
              @addToThumbLoadSchedule="addToThumbLoadSchedule"
              @removeFromThumbLoadSchedule="removeFromThumbLoadSchedule"
              :ref="'dirItem' + item.positionIndex"
            ></dir-item>

            <!-- item:bottom-spacer -->
            <template v-if="item.type === 'bottom-spacer'">
              <div
                class="
                  dir-item-node
                  dir-item--spacer
                  unselectable
                "
                :style="{ height: `${item.height}px` }"
              ></div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <div
      v-if="layout === 'grid'"
      id="workspace-area__content"
      class="
        root
        custom-scrollbar
        main-content-container
        drag-drop-container
        unselectable
        fade-mask--bottom
      "
      :style="{
        '--fade-mask-bottom': `${bottomFadeMaskHeightCurrentValue}%`,
      }"
      ref="root"
    >
      <div  class="viewport-container" ref="viewportContainer" :style="viewportContainerStyle" style="padding: 0px 24px">
        <div class="viewport" ref="viewport" :style="viewportStyle">
          <div class="dir-item-row-grid">
            <!-- item:row -->
            <template >
              <dir-item-row
                class="dir-item"
                v-for="row in renderedItems"
                :key="`dir-item-row-${row.positionIndex}`"
                :ref="'dirItemRow' + row.positionIndex"
                :row="row"
                :type="row.type"
                :thumbLoadingIsPaused="thumbLoadingIsPaused"
                :forceThumbLoad="forceThumbLoad"
                :status="status"
                :thumbLoadSchedule="thumbLoadSchedule"
                @addToThumbLoadSchedule="addToThumbLoadSchedule"
                @removeFromThumbLoadSchedule="removeFromThumbLoadSchedule"
                :style="{
                  'margin-bottom': `${row.marginBottom}px`
                }"
              ></dir-item-row>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import {mapFields} from 'vuex-map-fields'
import TimeUtils from '../utils/timeUtils.js'
import ThumbWorker from 'worker-loader!../workers/thumbWorker.js'

export default {
  props: {
    items: Array,
    layout: String
  },
  data () {
    return {
      status: {
        itemHover: {
          isPaused: false
        }
      },
      // workspaceArea: {
      mutationObserver: null,
      initialized: false,
      nodes: [],
      dirItemNodes: [],
      scrollTop: 0,
      bottomReached: false,
      bottomFadeMaskHeightCurrentValue: 10,
      bottomFadeMaskHeight: 10, 
      totalHeight: 0,
      initialItems: 0,
      bufferItems: 2,
      rowHeight: 48,
      rootHeight: 600,
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
      scrollStopTimeout: null,
      thumbLoadingIsPaused: false,
      forceThumbLoad: false,
      thumbLoadSchedule: [],
      thumbLoadIsLocked: false,
      thumbWorker: null,
      // isScrolling: false,
      // isScrollingTimeout: null,
      // },
      setValuesTimeouts: {
        currentDirPath: null
      }
    }
  },
  mounted () {
    this.thumbWorker = new ThumbWorker()
    this.throttle = new TimeUtils()
    this.$refs.root.addEventListener(
      'scroll',
      this.scrollHandler,
      { passive: true }
    )
    // this.initMutationObserver()
    setTimeout(() => {
      this.setValues()
      this.previousRenderedItems = this.renderedItems
    }, 100)
  },
  updated () {
    // NOTE:
    // Do not call this.setValues() here because
    // it will cause infinite update cycle
  },
  beforeDestroy () {
    // Remove timeouts to avoid memory leaks and errors from setValues()
    clearTimeout(this.setValuesTimeouts.currentDirPath)
    this.$refs.root.removeEventListener(
      'scroll',
      this.scrollHandler,
      { passive: true }
    )
  },
  watch: {
    items (value) {
      this.setValues()
    },
    bottomReached (value) {
      if (value) {
        this.animateRange({
          start: this.bottomFadeMaskHeight,
          end: 0,
          steps: 25,
          stepDuration: 1,
          target: 'bottomFadeMaskHeightCurrentValue'
        })
      }
      else {
        this.animateRange({
          start: 0,
          end: this.bottomFadeMaskHeight,
          steps: 25,
          stepDuration: 1,
          target: 'bottomFadeMaskHeightCurrentValue'
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
      deep: true
    },
    windowSize () {
      this.setValues()
    }
  },
  computed: {
    ...mapFields({
      dirItems: 'navigatorView.dirItems',
      appPaths: 'appPaths',
      windowSize: 'windowSize',
      currentDir: 'navigatorView.currentDir'
    }),
    ...mapGetters([
      'clipboardToolbarIsVisible'
    ]),
    renderedItems () {
      return this.items.slice(
        this.amountScrolledItems,
        this.amountScrolledItems + this.amountRenderedItems
      )
    },
    amountRenderedItems () {
      let itemHeightSum = 0
      let amountItemsFillRootHeight = 0
      this.allItemSizes.forEach(itemHeight => {
        if (itemHeightSum < this.rootHeight) {
          itemHeightSum += itemHeight
          amountItemsFillRootHeight += 1
        }
      })
      return amountItemsFillRootHeight + this.bufferItems
    },
    amountScrolledItems () {
      let sum = 0
      let counter = 0
      this.allItemSizes.forEach(item => {
        if (sum <= this.scrollTop) {
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
          this.amountScrolledItems
        )
        .reduce((a, b) => a + b, 0)

      // return this.scrollTop
    },
    viewportContainerStyle () {
      let height = this.totalHeight
      if (this.clipboardToolbarIsVisible) {
        height += 36
      }
      return {
        height: `${height}px`
      }
    },
    viewportStyle () {
      return {
        transform: `translateY(${this.offsetY}px)`
      }
    }
  },
  methods: {
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
        target: null
      }
      props = { ...defaultProps, ...props }
      const { start, end, steps, stepDuration, timingFunction, target } = props
      const interpolatedList = this.interpolateChange({
        start,
        end,
        steps,
        stepDuration
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
        timingFunction: 'linear'
      }
      props = { ...defaultProps, ...props }
      const { start, end, steps, stepDuration, timingFunction } = props
      const parts = this.splitIntoEqualParts({
        start,
        end,
        steps
      })
      return parts
    },
    splitIntoEqualParts (props) {
      let { start, end, steps } = props
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
        this.thumbLoadIsLocked = true
        this.generateImageThumb(payload.item.path, payload.item.realPath, payload.thumbPath)
          .then((event) => {
            this.thumbLoadIsLocked = false
            this.removeFromThumbLoadSchedule(payload)
            if (event.data.result === 'error') {
              payload?.onError?.()
            }
            else {
              payload?.onEnd?.()
            }
            resolve()
            if (this.thumbLoadSchedule.length > 0) {
              this.handleThumbLoad(this.thumbLoadSchedule[0])
            }
          })
      })
    },
    addToThumbLoadSchedule (payload) {
      this.thumbLoadSchedule.push(payload)
      if (!this.thumbLoadIsLocked && !payload.item.isInaccessible) {
        this.handleThumbLoad(payload)
      }
    },
    removeFromThumbLoadSchedule (payload) {
      const index = this.thumbLoadSchedule.findIndex(object => object.item.path === payload.item.path)
      if (index !== -1) {
        this.thumbLoadSchedule.splice(index, 1)
      }
    },
    async generateImageThumb (dirItemPath, dirItemRealPath, thumbPath) {
      return new Promise((resolve, reject) => {
        this.thumbWorker.postMessage({
          action: 'gen-thumb',
          layout: this.layout,
          dirItemRealPath: dirItemRealPath,
          thumbPath: thumbPath,
          appPaths: this.appPaths
        })
        this.thumbWorker.onmessage = (event) => {
          resolve(event)
        }
      })
    },
    getAmountScrolledItems () {
      let counter = 0
      let sum = 0
      while (sum <= this.scrollTop) {
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
    scrollHandler (event) {
      this.handleScrollStart()
      this.setValues()
      this.handleScrollStop()
      this.bottomReached = Math.ceil(this.scrollTop + this.rootHeight) >= this.totalHeight
    },
    handleScrollStart () {
      this.forceThumbLoad = false
      this.thumbLoadingIsPaused = true
      this.status.itemHover.isPaused = true
    },
    handleScrollStop () {
      // Watch for 'scroll stop':
      clearTimeout(this.scrollStopTimeout)
      this.scrollStopTimeout = setTimeout(() => {
        this.forceThumbLoad = true
        this.thumbLoadingIsPaused = false
        this.status.itemHover.isPaused = false
      }, 250)
    },
    setValues () {
      if (!this.$refs.root) {return}

      const nodes = document.querySelectorAll('.dir-item')
      const dirItemNodes = document.querySelectorAll('.dir-item-node')
      this.nodes = nodes
      this.dirItemNodes = dirItemNodes
      this.scrollTop = this.$refs.root.scrollTop
      this.rootHeight = this.$refs.root.clientHeight
      this.renderedItemsizes = this.renderedItems.map(item => item.height)
      this.allItemSizes = this.items.map(item => item.height)
      this.totalHeight = this.items.reduce((a, b) => a + (b.height || 0), 0)
      this.appendPropertyIsInViewport(dirItemNodes)
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
  }
}
</script>

<style>
.root {
  overflow-x: hidden;
  height: calc(
    100vh -
    var(--window-toolbar-height) -
    var(--action-toolbar-height) -
    var(--workspace-area-toolbar-height)
  );
}

.viewport-container {
  min-height: 100%;
  overflow: hidden;
}
</style>
