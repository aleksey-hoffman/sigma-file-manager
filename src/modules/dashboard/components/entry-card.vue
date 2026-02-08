<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, useSlots } from 'vue';
import { FolderIcon, FileIcon } from 'lucide-vue-next';

const props = defineProps<{
  path: string;
  isFile?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

const slots = useSlots();

const hasFooter = computed(() => !!slots.footer);

const itemName = computed(() => {
  if (!props.path) return '';
  const segments = props.path.split('/').filter(Boolean);
  return segments[segments.length - 1] || props.path;
});

const itemDirectory = computed(() => {
  if (!props.path) return '';
  const lastSlashIndex = props.path.lastIndexOf('/');
  return lastSlashIndex > 0 ? props.path.substring(0, lastSlashIndex) : props.path;
});

const isDirectory = computed(() => {
  if (props.isFile !== undefined) {
    return !props.isFile;
  }

  return props.path.endsWith('/') || !props.path.includes('.');
});

function handleClick() {
  emit('click');
}
</script>

<template>
  <div
    class="entry-card"
    :class="{ 'entry-card--with-footer': hasFooter }"
  >
    <button
      type="button"
      class="entry-card__main"
      @click="handleClick"
    >
      <div class="entry-card__icon">
        <FolderIcon
          v-if="isDirectory"
          :size="20"
        />
        <FileIcon
          v-else
          :size="20"
        />
      </div>
      <div class="entry-card__content">
        <span class="entry-card__name">{{ itemName }}</span>
        <span class="entry-card__path">{{ itemDirectory }}</span>
      </div>
      <slot />
    </button>
    <div
      v-if="hasFooter"
      class="entry-card__footer"
    >
      <slot name="footer" />
    </div>
  </div>
</template>

<style>
.entry-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius);
  background-color: hsl(var(--card));
  transition: all 0.15s ease;
}

.entry-card:hover {
  background-color: hsl(var(--muted));
}

.entry-card:hover .entry-card__action {
  opacity: 1;
}

.entry-card__main {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 12px 16px;
  border: none;
  background: none;
  cursor: pointer;
  gap: 12px;
  text-align: left;
}

.entry-card__icon {
  display: flex;
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.entry-card__content {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.entry-card__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 0.9rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-card__path {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.entry-card__footer {
  display: flex;
  width: 100%;
  align-items: center;
  padding: 0 16px;
  padding-bottom: 8px;
  gap: 8px;
}

.entry-card__action {
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}

.entry-card__action:hover {
  color: hsl(var(--destructive));
}

.entry-card__stats {
  display: flex;
  flex-shrink: 0;
  align-items: center;
}

.entry-card__badge {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
  font-weight: 500;
}

.entry-card__time {
  flex-shrink: 0;
  color: hsl(var(--muted-foreground));
  font-size: 0.8rem;
}

.entry-card__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.entry-card__tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}
</style>
