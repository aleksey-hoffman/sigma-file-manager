<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { PencilIcon, Trash2Icon } from '@lucide/vue';
import type { ItemTag } from '@/types/user-stats';
import { useTagInlineEditor, stopSpaceKeyPropagation } from '@/composables/use-tag-inline-editor';

const props = defineProps<{
  tag: ItemTag;
}>();

const emit = defineEmits<{
  'rename-tag': [tagId: string, name: string];
  'delete-tag': [tagId: string];
  'update-tag-color': [tagId: string, color: string];
}>();

const { t } = useI18n();

const tagsRef = computed(() => [props.tag]);

const {
  editingTagId,
  editDraft,
  renameInputRef,
  displayColor,
  colorHexForPicker,
  cancelEdit,
  commitEdit,
  startEdit,
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
          @click.stop
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
      ref="renameInputRef"
      v-model="editDraft"
      class="sigma-ui-input tag-selector__rename-input"
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
        :title="t('tags.renameTag')"
        @click="startEdit($event, tag)"
      >
        <PencilIcon :size="14" />
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
  height: 24px;
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

.dashboard-tag-section-header .tag-selector__rename-input {
  min-width: 8rem;
  max-width: min(24rem, 100%);
  height: 24px;
  flex: 0 1 20rem;
}
</style>
