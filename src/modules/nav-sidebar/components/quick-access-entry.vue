<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import QuickAccessItemIcon from './quick-access-item-icon.vue';
import { DirEntryInteractive } from '@/components/dir-entry-interactive';
import { getPathDisplayName } from '@/utils/normalize-path';

const props = defineProps<{
  path: string;
  isFile: boolean;
  isCurrentDirectoryContext: boolean;
}>();

const emit = defineEmits<{
  open: [];
}>();

const { t } = useI18n();

const itemName = computed(() => {
  if (!props.path) {
    return '';
  }

  return getPathDisplayName(props.path, t) || props.path;
});
</script>

<template>
  <DirEntryInteractive
    :path="props.path"
    :is-file="props.isFile"
    :is-current-directory-context="props.isCurrentDirectoryContext"
  >
    <div
      class="quick-access-panel__item"
      role="button"
      tabindex="0"
      @click="emit('open')"
      @keydown.enter.prevent="emit('open')"
      @keydown.space.prevent="emit('open')"
    >
      <QuickAccessItemIcon
        :path="props.path"
        :is-file="props.isFile"
        :size="14"
      />
      <span class="quick-access-panel__item-name">{{ itemName }}</span>
    </div>
  </DirEntryInteractive>
</template>

<style scoped>
.quick-access-panel__item {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 6px 12px;
  border: none;
  border-radius: var(--radius-sm);
  background: none;
  cursor: pointer;
  gap: 8px;
  text-align: start;
  transition: background-color 0.15s ease;
}

.quick-access-panel__item:hover {
  background-color: hsl(var(--foreground) / 5%);
}

.quick-access-panel__item-name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  color: hsl(var(--foreground));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style>
.dir-entry-interactive[data-drag-over] > .quick-access-panel__item {
  background-color: var(--drop-target-background);
  outline: var(--drop-target-outline);
  outline-offset: var(--drop-target-outline-offset);
}
</style>
