<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import type { ItemTag } from '@/types/user-stats';
import { useTagInlineEditor, stopSpaceKeyPropagation } from '@/composables/use-tag-inline-editor';

// FORK-MODIFICATION: 反馈 4 —— canMoveUp / canMoveDown 支撑「标记排序」。
// 用户要的是「在签页可以对已经添加的收藏、标记进行排序」；已标记页的分区就是
// 标记本身，所以排序入口放在分区标题上，而不是卡片上。
const props = defineProps<{
  tag: ItemTag;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}>();

const emit = defineEmits<{
  'rename-tag': [tagId: string, name: string];
  'delete-tag': [tagId: string];
  'update-tag-color': [tagId: string, color: string];
  'move-up': [tagId: string];
  'move-down': [tagId: string];
}>();

const { t } = useI18n();

const tagsRef = computed(() => [props.tag]);

const {
  editingTagId,
  editDraft,
  setRenameInputRef,
  displayColor,
  colorHexForPicker,
  cancelEdit,
  commitEdit,
  startEdit,
  onToggleControlPointerDown,
  onColorClick,
  deleteTag,
  onColorInput,
  onColorBlur,
} = useTagInlineEditor({
  tags: tagsRef,
  onRename: (tagId, name) => emit('rename-tag', tagId, name),
  onDelete: tagId => emit('delete-tag', tagId),
  onUpdateColor: (tagId, color) => emit('update-tag-color', tagId, color),
});
</script>

<template>
  <div class="tag-selector__item dashboard-tag-section-header">
    <label
      class="tag-selector__color-dot-wrap"
      :title="t('tags.tagColor')"
      @click.stop
      @pointerdown.stop
    >
      <div class="tag-selector__color-dot-hitbox">
        <input
          type="color"
          class="tag-selector__color-input"
          :value="colorHexForPicker(displayColor(tag))"
          @click.stop="onColorClick($event, tag)"
          @pointerdown.stop="onToggleControlPointerDown($event, tag)"
          @input="onColorInput($event, tag.id)"
          @blur="onColorBlur"
        >
        <span
          class="tag-selector__color-dot"
          aria-hidden="true"
          :style="{ backgroundColor: displayColor(tag) }"
        />
      </div>
    </label>
    <span
      v-if="editingTagId !== tag.id"
      class="tag-selector__tag-name"
    >{{ tag.name }}</span>
    <input
      v-else
      :ref="setRenameInputRef"
      v-model="editDraft"
      class="sigma-ui-input tag-selector__rename-input"
      autofocus
      @keydown="stopSpaceKeyPropagation"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
      @blur="commitEdit"
      @click.stop
      @pointerdown.stop
    >
    <div class="tag-selector__item-actions">
      <button
        type="button"
        class="tag-selector__edit"
        :disabled="!canMoveUp"
        :title="t('dashboard.actions.moveUp')"
        @click="emit('move-up', tag.id)"
      >
        <ArrowUpIcon :size="16" />
      </button>
      <button
        type="button"
        class="tag-selector__edit"
        :disabled="!canMoveDown"
        :title="t('dashboard.actions.moveDown')"
        @click="emit('move-down', tag.id)"
      >
        <ArrowDownIcon :size="16" />
      </button>
      <button
        type="button"
        class="tag-selector__edit"
        :title="t('tags.renameTag')"
        @pointerdown="onToggleControlPointerDown($event, tag)"
        @click="startEdit($event, tag)"
      >
        <PencilIcon :size="16" />
      </button>
      <button
        type="button"
        class="tag-selector__delete"
        :title="t('tags.deleteTag')"
        @click="deleteTag($event, tag.id)"
      >
        <Trash2Icon :size="14" />
      </button>
    </div>
  </div>
</template>

<style>
.dashboard-tag-section-header {
  display: flex;
  width: 100%;
  max-width: 100%;
  min-height: 28px;
  align-items: center;
  gap: 8px;
  padding-block: 2px;
}

.dashboard-tag-section-header .tag-selector__tag-name {
  min-width: 0;
  flex: 0 1 auto;
}

.dashboard-tag-section-header .tag-selector__item-actions {
  margin-left: 0;
}

.dashboard-tag-section-header .tag-selector__edit,
.dashboard-tag-section-header .tag-selector__delete {
  display: flex;
  width: 28px;
  height: 28px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.dashboard-tag-section-header:hover .tag-selector__edit,
.dashboard-tag-section-header:hover .tag-selector__delete {
  opacity: 1;
}

.dashboard-tag-section-header .tag-selector__edit:hover {
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.dashboard-tag-section-header .tag-selector__delete:hover {
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}

.dashboard-tag-section-header .tag-selector__rename-input {
  min-width: 8rem;
  max-width: min(24rem, 100%);
  height: 24px;
  flex: 0 1 20rem;
}
</style>
