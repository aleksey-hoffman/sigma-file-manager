<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import {ref, computed} from 'vue';
import {VSpacer} from 'vuetify/components';
import {useWorkspacesStore} from '@/stores/storage/workspaces';
import getVar from '@/utils/getVar';
import {FilterInput} from '@/components/FilterInput';
import {markRaw} from 'vue';
import {Tab} from '@/types/workspaces';

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
    component: markRaw(VSpacer),
    props: {}
  }
]);
</script>

<template>
  <VToolbar
    class="navigator-toolbar"
    flat
    :height="getVar('action-toolbar-height-value')"
  >
    <Component
      :is="item.component"
      v-for="(item, index) in toolbarItems"
      :key="index"
      v-bind="item.props"
    />
    <FilterInput v-model="tabFilterQuery" />
  </VToolbar>
</template>

<style>
#app
  .navigator-toolbar {
    position: relative;
    z-index: 10;
    display: flex;
    height: var(--navigator-toolbar-height);
    flex-direction: row;
    align-items: center;
    padding: 0 12px;
    border-color: var(--border-color-lighter-1);
    border-bottom: 1px solid var(--border-color-lighter-1);
    background-color: transparent;
    gap: var(--toolbar-item-gap);
  }
</style>