<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ref, computed, markRaw} from 'vue';
import {FilterInput} from '@/components/app/filter-input';
import {Spacer} from '@/components/ui/spacer';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import type {Tab} from '@/types/workspaces';

interface Props {
  tab: Tab;
}

const props = defineProps<Props>();

const workspacesStore = useWorkspacesStore();

const tabFilterQuery = computed({
  get: () => props.tab.filterQuery,
  set: value => workspacesStore.setTabFilterQuery(props.tab, value)
});

const toolbarItems = ref([
  {
    component: markRaw(Spacer),
    props: {}
  }
]);
</script>

<template>
  <div class="workspace-toolbar">
    <Component
      :is="item.component"
      v-for="(item, index) in toolbarItems"
      :key="index"
      v-bind="item.props"
    />
    <FilterInput v-model="tabFilterQuery" />
  </div>
</template>

<style>
.workspace-toolbar {
  position: relative;
  z-index: 10;
  display: flex;
  width: 100%;
  height: var(--workspace-toolbar-height);
  flex-direction: row;
  align-items: center;
  padding: 0 12px;
  border-color: var(--border-color-lighter-1);
  border-bottom: 1px solid var(--border-color-lighter-1);
  background-color: transparent;
  gap: var(--toolbar-item-gap);
}
</style>