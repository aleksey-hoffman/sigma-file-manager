<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { TagSelector } from '@/components/ui/tag-selector';
import type { ItemTag, TaggedItem } from '@/types/user-stats';

const props = defineProps<{
  item: TaggedItem;
  tags: ItemTag[];
  isSelectorActive: boolean;
}>();

const emit = defineEmits<{
  'open': [];
  'open-change': [open: boolean];
  'toggle-tag': [tagId: string];
  'create-tag': [name: string];
  'rename-tag': [tagId: string, name: string];
  'update-tag-color': [tagId: string, color: string];
}>();

const { t } = useI18n();

const selectedTags = computed(() => {
  return props.item.tagIds
    .map(tagId => props.tags.find(tag => tag.id === tagId))
    .filter((tag): tag is ItemTag => tag !== undefined);
});

const visibleTagBadges = computed(() => selectedTags.value.slice(0, 1));

const hiddenTagCount = computed(() => {
  return Math.max(0, selectedTags.value.length - visibleTagBadges.value.length);
});

const tagSummary = computed(() => {
  if (selectedTags.value.length > 0) {
    return selectedTags.value.map(tag => tag.name).join(', ');
  }

  return t('tags.editTags');
});

function handleOpenChange(open: boolean) {
  emit('open-change', open);
}
</script>

<template>
  <div class="entry-card-tags">
    <div class="entry-card-tags__control">
      <Transition name="entry-card-tags-static">
        <button
          v-if="!isSelectorActive"
          key="static"
          type="button"
          class="entry-card-tags__static entry-card-tags__layer"
          :title="tagSummary"
          @click.stop="emit('open')"
        >
          <template v-if="visibleTagBadges.length > 0">
            <span
              v-for="tag in visibleTagBadges"
              :key="tag.id"
              class="tag-selector__badge entry-card-tags__badge"
              :style="{ backgroundColor: `${tag.color}25`, color: tag.color }"
            >
              {{ tag.name }}
            </span>
            <span
              v-if="hiddenTagCount > 0"
              class="tag-selector__badge tag-selector__badge--more entry-card-tags__badge"
            >
              +{{ hiddenTagCount }}
            </span>
          </template>
          <span
            v-else
            class="entry-card-tags__empty"
          >—</span>
        </button>
      </Transition>

      <Transition name="entry-card-tags-editor">
        <div
          v-if="isSelectorActive"
          key="editor"
          class="entry-card-tags__editor entry-card-tags__layer"
        >
          <TagSelector
            :tags="tags"
            :selected-tag-ids="item.tagIds"
            :allow-create="true"
            :max-badges="1"
            :full-width="true"
            :open-on-mount="true"
            trigger-variant="default"
            align="start"
            side="bottom"
            @toggle-tag="tagId => emit('toggle-tag', tagId)"
            @create-tag="name => emit('create-tag', name)"
            @rename-tag="(tagId, name) => emit('rename-tag', tagId, name)"
            @update-tag-color="(tagId, color) => emit('update-tag-color', tagId, color)"
            @open-change="handleOpenChange"
          />
        </div>
      </Transition>
    </div>
  </div>
</template>

<style>
.entry-card-tags {
  display: flex;
  width: 100%;
  min-width: 0;
}

.entry-card-tags__control {
  position: relative;
  overflow: hidden;
  width: 100%;
  height: 1.75rem;
}

.entry-card-tags__layer {
  position: absolute;
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  inset: 0;
}

.entry-card-tags__editor > * {
  width: 100%;
  height: 100%;
}

.entry-card-tags :deep(.tag-selector__trigger) {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 100%;
  border: none;
  gap: 6px;
}

.entry-card-tags :deep(.tag-selector__trigger--full-width) {
  justify-content: flex-start;
}

.entry-card-tags :deep(.tag-selector__trigger-icon-plus) {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.entry-card-tags :deep(.tag-selector__label) {
  overflow: hidden;
  max-width: 8rem;
  flex-shrink: 0;
  white-space: nowrap;
}

.entry-card-tags :deep(.tag-selector__selected-tags) {
  min-width: 0;
  flex: 1;
}

.entry-card-tags__static {
  overflow: hidden;
  min-width: 0;
  padding: 0;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  gap: 4px;
  text-align: left;
}

.entry-card-tags__empty {
  color: hsl(var(--muted-foreground));
  font-size: 0.75rem;
}

.entry-card-tags-static-enter-active,
.entry-card-tags-static-leave-active,
.entry-card-tags-editor-enter-active,
.entry-card-tags-editor-leave-active {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.entry-card-tags-static-enter-active .entry-card-tags__badge,
.entry-card-tags-static-enter-active .entry-card-tags__empty,
.entry-card-tags-static-leave-active .entry-card-tags__badge,
.entry-card-tags-static-leave-active .entry-card-tags__empty {
  transition:
    opacity 200ms ease,
    transform 200ms ease;
}

.entry-card-tags-static-enter-active .entry-card-tags__badge,
.entry-card-tags-static-enter-active .entry-card-tags__empty {
  transition-delay: 50ms;
}

.entry-card-tags-static-enter-from {
  opacity: 0;
  transform: translateX(12px);
}

.entry-card-tags-static-enter-from .entry-card-tags__badge,
.entry-card-tags-static-enter-from .entry-card-tags__empty {
  opacity: 0;
  transform: translateX(10px);
}

.entry-card-tags-static-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.entry-card-tags-static-leave-to .entry-card-tags__badge,
.entry-card-tags-static-leave-to .entry-card-tags__empty {
  opacity: 0;
  transform: translateX(-10px);
}

.entry-card-tags-editor-enter-active :deep(.tag-selector__trigger-icon-plus),
.entry-card-tags-editor-enter-active :deep(.tag-selector__label),
.entry-card-tags-editor-enter-active :deep(.tag-selector__badge),
.entry-card-tags-editor-leave-active :deep(.tag-selector__trigger-icon-plus),
.entry-card-tags-editor-leave-active :deep(.tag-selector__label),
.entry-card-tags-editor-leave-active :deep(.tag-selector__badge) {
  transition:
    opacity 200ms ease,
    transform 200ms ease,
    max-width 200ms ease;
}

.entry-card-tags-editor-enter-active :deep(.tag-selector__label) {
  transition-delay: 40ms;
}

.entry-card-tags-editor-enter-active :deep(.tag-selector__badge) {
  transition-delay: 20ms;
}

.entry-card-tags-editor-leave-active :deep(.tag-selector__label) {
  transition-delay: 0ms;
}

.entry-card-tags-editor-leave-active :deep(.tag-selector__badge) {
  transition-delay: 30ms;
}

.entry-card-tags-editor-enter-from {
  opacity: 0;
  transform: translateX(-12px);
}

.entry-card-tags-editor-enter-from :deep(.tag-selector__trigger-icon-plus) {
  opacity: 0;
  transform: translateX(-10px);
}

.entry-card-tags-editor-enter-from :deep(.tag-selector__label) {
  max-width: 0;
  opacity: 0;
  transform: translateX(-10px);
}

.entry-card-tags-editor-enter-from :deep(.tag-selector__badge) {
  opacity: 0;
  transform: translateX(10px);
}

.entry-card-tags-editor-leave-to {
  opacity: 0;
  transform: translateX(-12px);
}

.entry-card-tags-editor-leave-to :deep(.tag-selector__trigger-icon-plus) {
  opacity: 0;
  transform: translateX(-10px);
}

.entry-card-tags-editor-leave-to :deep(.tag-selector__label) {
  max-width: 0;
  opacity: 0;
  transform: translateX(-10px);
}

.entry-card-tags-editor-leave-to :deep(.tag-selector__badge) {
  opacity: 0;
  transform: translateX(10px);
}
</style>
