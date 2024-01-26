<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {OverlayScrollbarsComponent} from 'overlayscrollbars-vue';
import {ref, onMounted} from 'vue';
import {Tab, TabDraggable} from '@/components/navigator/tab-bar';
import {Button} from '@/components/ui/button';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import type {Tab as TabType, TabGroup} from '@/types/workspaces';

const workspacesStore = useWorkspacesStore();
const {openNewTabGroup, closeTabGroup, setTabs} = workspacesStore;

const previewEnabled = ref(true);

function changeScrollPosition () {
  const scrollContainer = document.querySelector('.tab-bar__base');
  scrollContainer?.addEventListener('wheel', event => {
    scrollContainer.scrollLeft += (event as WheelEvent).deltaY || 0;
  });
}

onMounted(() => {
  changeScrollPosition();
});
</script>

<template>
  <div class="tab-bar">
    <div class="tab-bar__base-container">
      <OverlayScrollbarsComponent
        defer
        :options="{
          scrollbars: {
            theme: 'os-theme-dark os-theme-dark--lighten-2',
            autoHide: 'move'
          }
        }"
      >
        <div class="tab-bar__base">
          <TabDraggable
            :items="workspacesStore.currentWorkspace?.tabGroups || []"
            :draggable-bg-color-var="'window-toolbar-color'"
            parent-selector=".tab-bar"
            @set="setTabs($event as TabGroup[])"
            @drag-start="previewEnabled = false"
            @drag-end="previewEnabled = true"
          >
            <template #item="{ item }">
              <Tab
                :tab-group="(item as TabType[])"
                :preview-enabled="previewEnabled"
                @close-tab="closeTabGroup($event)"
              />
            </template>
          </TabDraggable>
        </div>
      </OverlayScrollbarsComponent>
    </div>

    <Button
      button-class="window-toolbar__item ml-2"
      icon="mdi-plus"
      size="x-small"
      icon-size="18px"
      :tooltip="$t('tabs.newTabInCurrentWorkspace')"
      @click="openNewTabGroup()"
    />
  </div>
</template>

<style>
.tab-bar {
  display: flex;
  max-width: 50%;
  align-items: center;
  margin-top: 1px;
}

.tab-bar__base-container {
  overflow: overlay;
  -webkit-app-region: no-drag;
}

.tab-bar__base {
  display: flex;
  width: fit-content;
  height: calc(var(--window-toolbar-height) + 14px);
  align-items: center;
  justify-content: center;
}
</style>