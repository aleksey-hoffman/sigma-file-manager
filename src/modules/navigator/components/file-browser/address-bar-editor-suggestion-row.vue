<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { XIcon } from '@lucide/vue';
import FileBrowserEntryIcon from './file-browser-entry-icon.vue';
import type { AddressBarSuggestion } from './address-bar-editor-utils';

defineProps<{
  itemIndex: number;
  selected: boolean;
  showsPathBesideName: boolean;
  suggestion: AddressBarSuggestion;
  recentEntryRemoveLabel?: string;
}>();

const emit = defineEmits<{
  activate: [];
  removeRecentEntry: [];
}>();

function handleRemoveRecentPointerDown(event: PointerEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function handleRemoveRecentClick(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
  emit('removeRecentEntry');
}
</script>

<template>
  <div
    class="address-bar-editor-suggestion-row"
    :class="{
      'address-bar-editor-suggestion-row--dir': suggestion.entry.is_dir,
      'address-bar-editor-suggestion-row--file': suggestion.entry.is_file,
      'address-bar-editor-suggestion-row--hidden': suggestion.entry.is_hidden,
      'address-bar-editor-suggestion-row--recent-removable':
        recentEntryRemoveLabel && suggestion.historyOpenedAt != null,
    }"
    :data-address-bar-editor-index="itemIndex"
    :data-selected="selected || undefined"
  >
    <div class="address-bar-editor-suggestion-row__overlays">
      <div class="address-bar-editor-suggestion-row__overlay address-bar-editor-suggestion-row__overlay--selected" />
      <div class="address-bar-editor-suggestion-row__overlay address-bar-editor-suggestion-row__overlay--hover" />
    </div>
    <button
      type="button"
      class="address-bar-editor-suggestion-row__activate"
      @mousedown.prevent
      @click="emit('activate')"
    >
      <div class="address-bar-editor-suggestion-row__name">
        <FileBrowserEntryIcon
          :entry="suggestion.entry"
          :size="18"
          class="address-bar-editor-suggestion-row__icon"
          :class="{ 'address-bar-editor-suggestion-row__icon--folder': suggestion.entry.is_dir }"
        />
        <div
          class="address-bar-editor-suggestion-row__name-content"
          :class="{ 'address-bar-editor-suggestion-row__name-content--solo-name': !showsPathBesideName }"
        >
          <span class="address-bar-editor-suggestion-row__name-text">{{ suggestion.name }}</span>
          <span
            v-if="showsPathBesideName"
            class="address-bar-editor-suggestion-row__name-path"
          >{{ suggestion.path }}</span>
        </div>
      </div>
    </button>
    <button
      v-if="recentEntryRemoveLabel && suggestion.historyOpenedAt != null"
      type="button"
      class="address-bar-editor-suggestion-row__remove-recent"
      :aria-label="recentEntryRemoveLabel"
      @pointerdown="handleRemoveRecentPointerDown"
      @click="handleRemoveRecentClick"
    >
      <XIcon
        :size="14"
        aria-hidden="true"
      />
    </button>
  </div>
</template>

<style scoped>
.address-bar-editor-suggestion-row {
  position: relative;
  display: grid;
  width: 100%;
  max-width: 100%;
  min-height: 32px;
  align-items: center;
  padding: var(--address-bar-editor-row-py) var(--address-bar-editor-row-px);
  border-bottom: 1px solid hsl(var(--border) / 50%);
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 13px;
  grid-template-columns: var(--address-bar-editor-grid-columns);
  text-align: left;
  user-select: none;
}

.address-bar-editor-suggestion-row__activate {
  display: flex;
  min-width: 0;
  max-width: 100%;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: default;
  font: inherit;
  text-align: left;
}

.address-bar-editor-suggestion-row__activate:focus-visible {
  outline: none;
}

.address-bar-editor-suggestion-row--hidden {
  opacity: 0.5;
}

.address-bar-editor-suggestion-row__overlays {
  position: absolute;
  z-index: 0;
  inset: 0;
  pointer-events: none;
}

.address-bar-editor-suggestion-row__overlay {
  position: absolute;
  inset: 0;
}

.address-bar-editor-suggestion-row__overlay--selected {
  background-color: hsl(var(--primary) / 12%);
  box-shadow: inset 0 0 0 1px hsl(var(--primary) / 40%);
  opacity: 0;
}

.address-bar-editor-suggestion-row[data-selected] .address-bar-editor-suggestion-row__overlay--selected {
  opacity: 1;
}

.address-bar-editor-suggestion-row__overlay--hover {
  background-color: hsl(var(--foreground) / 5%);
  opacity: 0;
  transition: opacity var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.address-bar-editor-suggestion-row:hover .address-bar-editor-suggestion-row__overlay--hover {
  opacity: 1;
  transition: opacity var(--hover-transition-duration-in);
}

.address-bar-editor-suggestion-row[data-selected]:hover .address-bar-editor-suggestion-row__overlay--hover {
  opacity: 0;
}

.address-bar-editor-suggestion-row__name {
  position: relative;
  z-index: 1;
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 10px;
}

.address-bar-editor-suggestion-row__icon {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
}

.address-bar-editor-suggestion-row__icon--folder {
  color: hsl(var(--primary));
}

.address-bar-editor-suggestion-row__name-content {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  flex-direction: row;
  align-items: baseline;
  gap: 0.375rem;
}

.address-bar-editor-suggestion-row__name-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-bar-editor-suggestion-row__name-content--solo-name .address-bar-editor-suggestion-row__name-text {
  min-width: 0;
  flex: 1 1 0;
}

.address-bar-editor-suggestion-row__name-content:not(.address-bar-editor-suggestion-row__name-content--solo-name) .address-bar-editor-suggestion-row__name-text {
  flex: 0 1 auto;
}

.address-bar-editor-suggestion-row__name-path {
  overflow: hidden;
  min-width: 0;
  flex: 1 1 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.address-bar-editor-suggestion-row--recent-removable {
  padding-inline-end: calc(var(--address-bar-editor-row-px) + 26px);
}

.address-bar-editor-suggestion-row__remove-recent {
  position: absolute;
  z-index: 2;
  top: 50%;
  right: max(6px, calc(var(--address-bar-editor-row-px) - 6px));
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: var(--radius-sm);
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: default;
  transform: translateY(-50%);
}

.address-bar-editor-suggestion-row__remove-recent:hover {
  background-color: hsl(var(--foreground) / 8%);
  color: hsl(var(--foreground));
}
</style>
