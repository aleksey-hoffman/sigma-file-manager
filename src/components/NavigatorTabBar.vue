<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<template>
  <div class="tab-bar-outer-container">
    <div class="tab-bar-container custom-scrollbar custom-scrollbar--lighter-1">
      <div class="tab-bar">
        <drag-sortable-list
          :items="selectedWorkspace.tabs"
          :update-items="setTabs"
        >
          <template #item="{item}">
            <navigator-tab
              :tab="item"
            >
              {{item.name}}
            </navigator-tab>
          </template>
        </drag-sortable-list>
      </div>
    </div>

    <template v-if="$route.name === 'navigator'">
      <AppButton
        button-class="window-toolbar__item ml-2"
        icon="mdi-plus"
        icon-size="22px"
        tooltip="New tab in current workspace"
        @click="addTabOnClick"
      />
    </template>
  </div>
</template>

<script>
import {mapGetters} from 'vuex'
import AppButton from '@/components/AppButton/AppButton.vue'

export default {
  components: {
    AppButton,
  },
  mounted () {
    this.changeScrollPosition()
  },
  computed: {
    ...mapGetters([
      'selectedWorkspace',
    ]),
  },
  methods: {
    changeScrollPosition () {
      const scrollContainer = document.querySelector('.tab-bar-container')
      scrollContainer.addEventListener('wheel', (event) => {
        scrollContainer.scrollLeft += event.deltaY
      })
    },
    setTabs (items) {
      this.$store.dispatch('SET_TABS', items)
    },
    addTabOnClick () {
      this.$store.dispatch('ADD_TAB')
    },
  },
}
</script>

<style>
.tab-bar-outer-container {
  display: flex;
  align-items: center;
}

.tab-bar-container {
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.tab-bar {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: fit-content;
  height: calc(var(--window-toolbar-height) + 14px);
}
</style>