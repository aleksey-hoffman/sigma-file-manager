<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useWorkspacesStore } from '@/stores/storage/workspaces';
import type { Tab } from '@/types/workspaces';
import { XIcon } from 'lucide-vue-next';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface Props {
  tabGroup: Tab[];
  previewEnabled: boolean;
}

interface Emits {
  (event: 'close-tab', value: Tab[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  tabGroup: () => ([]),
});

const emit = defineEmits<Emits>();

const workspacesStore = useWorkspacesStore();

const showTabPreview = ref<boolean>(true);
const navigatorTabWidth = ref<number>(100);

const isActive = computed(() => (
  props.tabGroup?.[0]?.id === workspacesStore.currentTab?.id
));

const tabName = computed(() => {
  const firstTab = props.tabGroup?.[0];
  const secondTab = props.tabGroup?.[0];

  if (props.tabGroup?.length === 2) {
    return `${firstTab.name || firstTab.path} | ${secondTab.name || secondTab.path}`;
  }
  else {
    return `${firstTab.name || firstTab.path}`;
  }
});

function tabOnClick(tabGroup: Tab[]) {
  workspacesStore.openTabGroup(tabGroup);
}
</script>

<template>
  <TooltipProvider
    :delay-duration="0"
    :disabled="!(props.previewEnabled && showTabPreview)"
  >
    <Tooltip :key="props.previewEnabled && showTabPreview ? 'enabled' : 'disabled'">
      <TooltipTrigger as-child>
        <div
          v-if="tabGroup.length"
          v-wave
          class="tab"
          :style="{
            '--tab-width': `${props.tabGroup.length === 2 ? navigatorTabWidth * 2 : navigatorTabWidth}px`
          }"
          :is-active="isActive"
          @click.stop="tabOnClick(props.tabGroup)"
        >
          <div class="tab__title">
            <span>
              {{ tabName }}
            </span>
          </div>

          <button
            class="tab__close-button"
            x-small
            icon
            @click.stop="emit('close-tab', props.tabGroup)"
          >
            <XIcon :size="14" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent
        side="bottom"
        class="tab__tooltip-content"
      >
        <span>
          <div
            v-for="(tab, index) in props.tabGroup"
            :key="index"
          >
            <div class="tab__tooltip-title">
              {{ tab.name }}
            </div>
            <div class="tab__tooltip-subtitle">
              {{ tab.path }}
            </div>
          </div>
        </span>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>

<style>
.tab {
  position: relative;
  display: flex;
  width: var(--tab-width, 100px);
  min-width: 0;
  height: var(--tab-height);
  align-items: center;
  padding: 0 10px;
  padding-right: 4px;
  border-radius: var(--radius-sm);
  margin-right: 4px;
  -webkit-app-region: no-drag;
  background-color: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0.9;
  user-select: none;
}

.tab[is-active="true"] {
  background-color: hsl(var(--background-2));
  color: hsl(var(--foreground) / 80%);
  opacity: 1;
}

.tab::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: hsl(var(--background-2) / 0%);
  box-shadow: 0 0 6px hsl(var(--background-2) / 0%);
  content: "";
}

.tab[is-active="true"]::after {
  background-color: hsl(var(--background-2) / 50%);
  box-shadow: 0 0 6px hsl(var(--background-2) / 100%);
}

.tab:hover {
  background-color: hsl(var(--background-2) / 70%);
}

.tab__title {
  overflow: hidden;
  width: calc(100% - 24px);
  font-size: 12px;
  text-overflow: clip;
  white-space: nowrap;
}

.tab__close-button {
  position: absolute;
  right: 4px;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}

.tab__close-button:hover {
  background-color: hsl(var(--background-2));
}

.tab__tooltip-title {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__tooltip-subtitle {
  overflow: hidden;
  color: hsl(var(--foreground) / 50%);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__tooltip-content {
  min-width: 200px;
  max-width: 250px;
}
</style>
