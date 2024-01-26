<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Splitpanes, Pane} from 'splitpanes';
import {ref, onMounted} from 'vue';
import {ContentPane} from '@/components/navigator/content-pane';
import 'splitpanes/dist/splitpanes.css';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import type {Workspace} from '@/types/workspaces';

interface Props {
  currentWorkspace: Workspace;
}

defineProps<Props>();

const workspacesStore = useWorkspacesStore();

const renderContents = ref(false);
const renderContentsTimeout = ref<ReturnType<typeof setTimeout> | null>(null);
const navigatorContentRef = ref<HTMLElement | null>(null);

setTimeout(() => {
  renderContents.value = true;
}, 100);

onMounted(() => {
  observeContent();
});

function observeContent() {
  if (!navigatorContentRef.value) {
    return;
  }
  const initialWidth = navigatorContentRef.value.offsetWidth;
  const initialHeight = navigatorContentRef.value.offsetHeight;

  const observer = new ResizeObserver(entries => {
    const currentWidth = entries[0].contentRect.width;
    const currentHeight = entries[0].contentRect.height;

    if (currentWidth !== initialWidth || currentHeight !== initialHeight) {
      renderContents.value = false;
      if (renderContentsTimeout.value) {
        clearTimeout(renderContentsTimeout.value);
      }
      renderContentsTimeout.value = setTimeout(() => {
        renderContents.value = true;
      }, 100);
    }
  });

  observer.observe(navigatorContentRef.value);

  return () => {
    if (!navigatorContentRef.value) {
      return;
    }
    observer.unobserve(navigatorContentRef.value);
  };
}

function paneOnReize(event) {
  event.forEach((pane, index) => {
    if (workspacesStore.currentTabGroup?.[index]) {
      workspacesStore.currentTabGroup[index].paneWidth = pane.size;
    }
  });
  renderContents.value = false;
}

function paneOnResized() {
  renderContents.value = true;
}
</script>

<template>
  <main
    ref="navigatorContentRef"
    class="navigator-page-content"
  >
    <Splitpanes
      @resize="paneOnReize"
      @resized="paneOnResized"
    >
      <Pane
        v-for="(tab, index) in workspacesStore.currentTabGroup"
        :key="'navigator-content-pane' + index"
        :size="tab.paneWidth"
      >
        <ContentPane
          :tab="tab"
          :render-contents="renderContents"
        />
      </Pane>
    </Splitpanes>
  </main>
</template>

<style>
.navigator-page-content {
  display: flex;
  height: 100%;
}

.splitpanes {
  background: transparent;
}

.splitpanes__splitter {
  position: relative;
  width: 1px;
  padding: 0;
  margin: 5px;
  background-color: var(--divider-color);
  transition: all 0.3s ease;
}

.splitpanes__splitter::before,
.splitpanes__splitter::after {
  position: absolute;
  z-index: 1;
  top: 0;
  left: 0;
  content: '';
  opacity: 0;
  transition: opacity 0.3s ease;
}

.splitpanes__splitter:hover::before,
.splitpanes__splitter:hover::after {
  opacity: 1;
}

.splitpanes--vertical
  > .splitpanes__splitter::after {
    top: 0;
    right: -2px;
    left: -2px;
    height: 100%;
    background-color: var(--divider-color);
  }

.splitpanes--vertical
  > .splitpanes__splitter::before {
    top: 0;
    right: -6px;
    left: -6px;
    height: 100%;
  }

.splitpanes--vertical
  .splitpanes__pane {
      transition: none;
  }
</style>