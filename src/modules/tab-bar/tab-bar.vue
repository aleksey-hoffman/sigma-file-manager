<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { Tab, TabDraggable } from '.';
import { Button } from '@/components/ui/button';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import type { Tab as TabType, TabGroup } from '@/types/workspaces';
import { PlusIcon } from 'lucide-vue-next';

const workspacesStore = useWorkspacesStore();
const { openNewTabGroup, closeTabGroup, setTabs } = workspacesStore;

const previewEnabled = ref(true);
let scrollDisableTimeoutId: number | null = null;
const scrollContainerEl = ref<HTMLElement | null>(null);

function handleScrollActivity() {
  previewEnabled.value = false;

  if (scrollDisableTimeoutId !== null) {
    clearTimeout(scrollDisableTimeoutId);
  }

  scrollDisableTimeoutId = window.setTimeout(() => {
    previewEnabled.value = true;
  }, 200);
}

function onWheel(event: Event) {
  const container = scrollContainerEl.value;
  if (!container) return;
  const wheelEvent = event as WheelEvent;
  container.scrollLeft += wheelEvent.deltaY || 0;
  handleScrollActivity();
}

function onScroll() {
  handleScrollActivity();
}

function changeScrollPosition() {
  const scrollContainer = document.querySelector('.tab-bar__base-container') as HTMLElement | null;
  scrollContainerEl.value = scrollContainer;
  if (!scrollContainer) return;
  scrollContainer.addEventListener('wheel', onWheel as EventListener);
  scrollContainer.addEventListener('scroll', onScroll as EventListener);
}

onMounted(() => {
  changeScrollPosition();
});

onBeforeUnmount(() => {
  if (scrollContainerEl.value) {
    scrollContainerEl.value.removeEventListener('wheel', onWheel as EventListener);
    scrollContainerEl.value.removeEventListener('scroll', onScroll as EventListener);
  }

  if (scrollDisableTimeoutId !== null) {
    clearTimeout(scrollDisableTimeoutId);
  }
});
</script>

<template>
  <Teleport to=".window-toolbar-primary-teleport-target">
    <div class="tab-bar animate-fade-in">
      <div class="tab-bar__base-container">
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
      </div>

      <Button
        class="tab-bar__add-tab-button"
        variant="ghost"
        size="xs"
        @click="openNewTabGroup()"
      >
        <PlusIcon :size="14" />
      </Button>
    </div>
  </Teleport>
</template>

<style>
.tab-bar {
  display: flex;
  max-width: 100%;
  height: 100%;
  align-items: center;
  gap: 4px;
}

.tab-bar__base-container {
  display: flex;
  overflow: auto;
  align-items: center;
  -webkit-app-region: no-drag;
  scrollbar-width: none;
}

.tab-bar__base {
  display: flex;
  width: fit-content;
  height: calc(var(--window-toolbar-height) - 4px);
  align-items: center;
  justify-content: center;
}

.tab-bar__add-tab-button {
  color: hsl(var(--muted-foreground));
}
</style>
