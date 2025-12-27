<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, onBeforeUnmount, computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { Tab, TabDraggable } from '.';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@/components/ui/tooltip';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import type { Tab as TabType, TabGroup } from '@/types/workspaces';
import { PlusIcon } from 'lucide-vue-next';

const { t } = useI18n();

const props = withDefaults(defineProps<{
  teleportTarget?: string;
  compact?: boolean;
}>(), {
  teleportTarget: '.window-toolbar-primary-teleport-target',
  compact: false,
});

const workspacesStore = useWorkspacesStore();

const teleportDisabled = computed(() => !props.teleportTarget);
const teleportTo = computed(() => props.teleportTarget || 'body');
const { openNewTabGroup, closeTabGroup, setTabs } = workspacesStore;

const previewEnabled = ref(true);
const scrollContainerRef = ref<HTMLElement | null>(null);
let scrollDisableTimeoutId: number | null = null;

function handleScrollActivity() {
  previewEnabled.value = false;

  if (scrollDisableTimeoutId !== null) {
    clearTimeout(scrollDisableTimeoutId);
  }

  scrollDisableTimeoutId = window.setTimeout(() => {
    previewEnabled.value = true;
  }, 200);
}

function handleWheel(event: WheelEvent) {
  const container = scrollContainerRef.value;
  if (!container) return;
  container.scrollLeft += event.deltaY || event.deltaX || 0;
  handleScrollActivity();
}

function onScroll() {
  handleScrollActivity();
}

onBeforeUnmount(() => {
  if (scrollDisableTimeoutId !== null) {
    clearTimeout(scrollDisableTimeoutId);
  }
});
</script>

<template>
  <Teleport
    :to="teleportTo"
    :disabled="teleportDisabled"
  >
    <div
      class="tab-bar animate-sigma-ui-fade-in"
      :class="{ 'tab-bar--compact': compact }"
    >
      <div
        ref="scrollContainerRef"
        class="tab-bar__base-container"
        @wheel.prevent="handleWheel"
        @scroll="onScroll"
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
      </div>

      <Tooltip>
        <TooltipTrigger as-child>
          <Button
            class="tab-bar__add-tab-button"
            variant="ghost"
            size="xs"
            @click="openNewTabGroup()"
          >
            <PlusIcon :size="14" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          {{ t('tabs.newTab') }}
        </TooltipContent>
      </Tooltip>
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

.tab-bar--compact {
  width: 100%;
  height: 36px;
  padding: 4px 0;
}

.tab-bar--compact .tab-bar__base-container {
  overflow: auto hidden;
  min-width: 0;
  flex: 1;
}

.tab-bar--compact .tab-bar__base {
  height: 28px;
}
</style>
