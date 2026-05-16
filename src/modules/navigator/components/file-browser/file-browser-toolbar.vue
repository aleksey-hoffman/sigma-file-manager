<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import FileBrowserToolbarAddressBar from './file-browser-toolbar-address-bar.vue';
import FileBrowserToolbarNavButtons from './file-browser-toolbar-nav-buttons.vue';
import FileBrowserToolbarCreateButton from './file-browser-toolbar-create-button.vue';
import FileBrowserToolbarFilter from './file-browser-toolbar-filter.vue';

withDefaults(defineProps<{
  pathInput: string;
  filterQuery: string;
  canGoBack: boolean;
  canGoForward: boolean;
  canGoUp: boolean;
  isLoading: boolean;
  isFilterOpen: boolean;
  focusFilterInput: boolean;
  isSplitView?: boolean;
}>(), {
  isSplitView: false,
});

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
  (event: 'openFile', path: string): void;
  (event: 'openAddressEditor'): void;
  (event: 'createNewDirectory'): void;
  (event: 'createNewFile'): void;
  (event: 'filterInputFocused'): void;
}>();

function handleAddressBarNavigate(path: string) {
  emit('update:pathInput', path);
  emit('navigateTo', path);
}
</script>

<template>
  <div class="file-browser-toolbar">
    <div
      class="file-browser-toolbar__layout"
      :class="{ 'file-browser-toolbar__layout--split-view': isSplitView }"
    >
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

      <FileBrowserToolbarAddressBar
        class="file-browser-toolbar__address-bar"
        :current-path="pathInput"
        @navigate="handleAddressBarNavigate"
        @open-file="emit('openFile', $event)"
        @edit="emit('openAddressEditor')"
      />

      <div class="file-browser-toolbar__actions">
        <FileBrowserToolbarCreateButton
          @create-new-directory="emit('createNewDirectory')"
          @create-new-file="emit('createNewFile')"
        />
        <FileBrowserToolbarFilter
          :filter-query="filterQuery"
          :is-filter-open="isFilterOpen"
          :focus-input="focusFilterInput"
          @update:filter-query="emit('update:filterQuery', $event)"
          @update:is-filter-open="emit('update:isFilterOpen', $event)"
          @filter-input-focused="emit('filterInputFocused')"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-browser-toolbar {
  border-bottom: 1px solid hsl(var(--border));
  container-type: inline-size;
}

.file-browser-toolbar__layout {
  display: flex;
  height: 48px;
  align-items: center;
  padding: 8px;
  gap: 12px;
}

.file-browser-toolbar__address-bar {
  min-width: 0;
  flex: 1;
}

.file-browser-toolbar__actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
}

@container (width < 400px) {
  .file-browser-toolbar__layout--split-view {
    height: auto;
    min-height: 48px;
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .file-browser-toolbar__layout--split-view .file-browser-toolbar__address-bar {
    flex-basis: 100%;
    order: 2;
  }

  .file-browser-toolbar__layout--split-view .file-browser-toolbar__actions {
    margin-left: auto;
  }
}
</style>
