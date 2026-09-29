<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { TagIcon } from '@lucide/vue';
import type { PopoverContentProps } from 'reka-ui';
import type { ItemTag } from '@/types/user-stats';
import { getTagsByIdsInListOrder } from '@/utils/item-tag-order';
import TagOverflowList from './tag-overflow-list.vue';
import TagSelector from './tag-selector.vue';
import type { TagOverflowItem } from './tag-overflow-list';

const EDITOR_MOTION_MS = 220;

const props = withDefaults(defineProps<{
  tags: ItemTag[];
  selectedTagIds: string[];
  isSelectorMounted: boolean;
  tagSummary?: string;
  allowCreate?: boolean;
  fullWidth?: boolean;
  align?: PopoverContentProps['align'];
  side?: PopoverContentProps['side'];
}>(), {
  allowCreate: true,
  fullWidth: true,
  align: 'end',
  side: 'bottom',
});

const emit = defineEmits<{
  open: [];
  'open-change': [open: boolean];
  'toggle-tag': [tagId: string];
  'create-tag': [name: string];
  'rename-tag': [tagId: string, name: string];
  'update-tag-color': [tagId: string, color: string];
  'reorder-tags': [tags: ItemTag[]];
}>();

const { t } = useI18n();
const showEditor = ref(props.isSelectorMounted);
const isExpanded = ref(false);
let collapseTimeoutId = 0;
let expandFrameId = 0;

const selectedTags = computed(() => {
  return getTagsByIdsInListOrder(props.tags, props.selectedTagIds);
});

const overflowTags = computed<TagOverflowItem[]>(() => {
  return selectedTags.value.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: tag.color,
  }));
});

const resolvedTagSummary = computed(() => {
  if (props.tagSummary) {
    return props.tagSummary;
  }

  if (selectedTags.value.length > 0) {
    return selectedTags.value.map(tag => tag.name).join(', ');
  }

  if (props.selectedTagIds.length > 0) {
    return props.selectedTagIds.join(', ');
  }

  return t('tags.editTags');
});

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

function cancelPendingMotion() {
  window.clearTimeout(collapseTimeoutId);
  window.cancelAnimationFrame(expandFrameId);
}

function expandEditor() {
  expandFrameId = window.requestAnimationFrame(() => {
    expandFrameId = window.requestAnimationFrame(() => {
      if (props.isSelectorMounted) {
        isExpanded.value = true;
      }
    });
  });
}

watch(() => props.isSelectorMounted, (mounted) => {
  cancelPendingMotion();

  if (mounted) {
    showEditor.value = true;
    if (prefersReducedMotion()) {
      isExpanded.value = true;
      return;
    }

    expandEditor();
    return;
  }

  isExpanded.value = false;

  if (!showEditor.value || prefersReducedMotion()) {
    showEditor.value = false;
    return;
  }

  collapseTimeoutId = window.setTimeout(() => {
    if (!props.isSelectorMounted) {
      showEditor.value = false;
    }
  }, EDITOR_MOTION_MS);
}, { immediate: true });

onUnmounted(() => {
  cancelPendingMotion();
});
</script>

<template>
  <div
    class="item-tags-field"
    :class="{ 'item-tags-field--editing': isExpanded }"
    @mousedown.stop
    @mouseup.stop
    @click.stop
    @contextmenu.prevent.stop
  >
    <div
      v-if="showEditor"
      class="item-tags-field__editor"
    >
      <TagSelector
        :tags="tags"
        :selected-tag-ids="selectedTagIds"
        :allow-create="allowCreate"
        :full-width="fullWidth"
        :open-on-mount="true"
        trigger-variant="default"
        :align="align"
        :side="side"
        @toggle-tag="tagId => emit('toggle-tag', tagId)"
        @create-tag="name => emit('create-tag', name)"
        @rename-tag="(tagId, name) => emit('rename-tag', tagId, name)"
        @update-tag-color="(tagId, color) => emit('update-tag-color', tagId, color)"
        @reorder-tags="nextTags => emit('reorder-tags', nextTags)"
        @open-change="open => emit('open-change', open)"
      />
    </div>
    <button
      v-else
      type="button"
      class="item-tags-field__static"
      :title="resolvedTagSummary"
      @click="emit('open')"
    >
        <TagIcon class="tag-selector__trigger-icon-plus" />
        <TagOverflowList
          v-if="overflowTags.length > 0"
          :tags="overflowTags"
        />
    </button>
  </div>
</template>

<style>
.item-tags-field {
  --item-tags-field-motion: 220ms cubic-bezier(0.22, 1, 0.36, 1);

  position: relative;
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  align-items: center;
}

.item-tags-field__editor {
  display: flex;
  width: 100%;
  min-width: 0;
  height: 100%;
  align-items: center;
}

.item-tags-field :deep(.tag-selector__trigger) {
  min-width: 0;
  max-width: 100%;
  height: 100%;
  border-color: transparent;
  gap: 4px;
  padding-inline: 0;
  transition:
    padding-inline var(--item-tags-field-motion),
    border-color var(--item-tags-field-motion);
}

.item-tags-field--editing :deep(.tag-selector__trigger) {
  border-color: hsl(var(--border));
  padding-inline: 0.5rem;
}

.item-tags-field__static {
  display: flex;
  overflow: hidden;
  width: 100%;
  min-width: 0;
  height: 100%;
  align-items: center;
  border: 1px dashed transparent;
  border-radius: 0.25rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 4px;
  padding-block: 0;
  padding-inline: 0;
}

@media (prefers-reduced-motion: reduce) {
  .item-tags-field {
    --item-tags-field-motion: 0ms;
  }
}
</style>
