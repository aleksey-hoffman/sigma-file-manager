<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {Icon} from '@iconify/vue';
import {ref, computed} from 'vue';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import type {Tab} from '@/types/workspaces';

interface Props {
  tabGroup: Tab[];
  previewEnabled: boolean;
}

interface Emits {
  (event: 'close-tab', value: Tab[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  tabGroup: () => ([])
});

const emit = defineEmits<Emits>();

const workspacesStore = useWorkspacesStore();
const {loadTabGroup} = workspacesStore;

const showTabPreview = ref<boolean>(true);
const navigatorTabWidth = ref<number>(100);

const isActive = computed(() => (
  props.tabGroup[0].id === workspacesStore.currentTab?.id
));

const tabName = computed(() => {
  const firstTab = props.tabGroup?.[0];
  const secondTab = props.tabGroup?.[0];
  if (props.tabGroup?.length === 2) {
    return `${firstTab.name || firstTab.path} | ${secondTab.name || secondTab.path}`;
  } else {
    return `${firstTab.name || firstTab.path}`;
  }
});

function tabOnClick (tabGroup: Tab[]) {
  loadTabGroup(tabGroup);
}
</script>

<template>
  <VTooltip
    :disabled="!(props.previewEnabled && showTabPreview)"
    location="bottom"
    min-width="200px"
    max-width="250px"
  >
    <template #activator="{ props: tooltipProps }">
      <div
        v-ripple
        class="tab"
        :style="{
          '--tab-width': `${props.tabGroup.length === 2 ? navigatorTabWidth * 2 : navigatorTabWidth}px`
        }"
        :is-active="isActive"
        v-bind="tooltipProps"
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
          <Icon
            icon="mdi-close"
            size="14px"
          />
        </button>
      </div>
    </template>
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
  </VTooltip>
</template>

<style>
.tab {
  position: relative;
  display: flex;
  width: var(--tab-width, 100px);
  min-width: 0;
  height: var(--tab-height);
  align-items: center;
  padding: 0 8px;
  padding-right: 4px;
  border: 1px solid var(--border-color);
  margin-right: 4px;
  -webkit-app-region: no-drag;
  background-color: var(--tab-bg-color);
  color: var(--tab-color);
  cursor: pointer;
  user-select: none;
}

.tab[is-active="true"] {
  background-color: var(--tab-bg-color-active);
  color: var(--tab-color-active);
}

.tab::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 1px;
  background-color: rgb(var(--key-color-value) / 0%);
  box-shadow: 0 0 6px rgb(var(--key-color-value) / 0%);
  content: "";
}

.tab[is-active="true"]::after {
  background-color: rgb(var(--key-color-value) / 50%);
  box-shadow: 0 0 6px rgb(var(--key-color-value) / 100%);
}

.tab:hover {
  background-color: var(--tab-bg-color-hover);
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
  right: 0;
  display: flex;
  width: 24px;
  height: 24px;
  align-items: center;
  justify-content: center;
  border-radius: 0;
}

.tab__close-button:hover {
  background-color: var(--tab-close-button-color);
}

.tab__tooltip-title {
  overflow: hidden;
  font-size: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tab__tooltip-subtitle {
  overflow: hidden;
  color: var(--color-darker-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>