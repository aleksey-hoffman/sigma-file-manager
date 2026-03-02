<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import FileBrowserCurrentDirMenu from './file-browser-current-dir-menu.vue';
import FileBrowserToolbarAddressBar from './file-browser-toolbar-address-bar.vue';
import FileBrowserToolbarNavButtons from './file-browser-toolbar-nav-buttons.vue';
import FileBrowserToolbarCreateButton from './file-browser-toolbar-create-button.vue';
import FileBrowserToolbarFilter from './file-browser-toolbar-filter.vue';

defineProps<{
  pathInput: string;
  filterQuery: string;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  isLoading: boolean;
  isFilterOpen: boolean;
}>();

const emit = defineEmits<{
  (event: 'update:pathInput', value: string): void;
  (event: 'update:filterQuery', value: string): void;
  (event: 'update:isFilterOpen', value: boolean): void;
  (event: 'goBack'): void;
  (event: 'goForward'): void;
  (event: 'goUp'): void;
  (event: 'goHome'): void;
  (event: 'refresh'): void;
  (event: 'submitPath'): void;
  (event: 'navigateTo', path: string): void;
  (event: 'createNewDirectory'): void;
  (event: 'createNewFile'): void;
}>();

function handleAddressBarNavigate(path: string) {
  emit('update:pathInput', path);
  emit('navigateTo', path);
}
</script>

<template>
  <div class="file-browser-toolbar">
    <FileBrowserToolbarNavButtons
      :can-go-back="canGoBack"
      :can-go-forward="canGoForward"
      :can-go-up="canGoUp"
      :is-loading="isLoading"
      @go-back="emit('goBack')"
      @go-forward="emit('goForward')"
      @go-up="emit('goUp')"
      @go-home="emit('goHome')"
      @refresh="emit('refresh')"
    />

    <div class="file-browser-toolbar__right">
      <FileBrowserToolbarAddressBar
        :current-path="pathInput"
        @navigate="handleAddressBarNavigate"
      />
      <FileBrowserToolbarCreateButton
        @create-new-directory="emit('createNewDirectory')"
        @create-new-file="emit('createNewFile')"
      />
      <FileBrowserToolbarFilter
        :filter-query="filterQuery"
        :is-filter-open="isFilterOpen"
        @update:filter-query="emit('update:filterQuery', $event)"
        @update:is-filter-open="emit('update:isFilterOpen', $event)"
      />
      <FileBrowserCurrentDirMenu />
    </div>
  </div>
</template>

<style scoped>
.file-browser-toolbar {
  display: flex;
  height: 48px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid hsl(var(--border));
  container-type: inline-size;
  gap: 12px;
}

.file-browser-toolbar__right {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 4px;
}
</style>
