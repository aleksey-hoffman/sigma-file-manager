<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CheckIcon,
  CirclePlusIcon,
  GripVerticalIcon,
  PencilIcon,
  TagIcon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { SortableList } from '@/components/sortable-list';
import type { ItemTag } from '@/types/user-stats';
import type { PopoverContentProps } from 'reka-ui';
import { useTagInlineEditor, stopSpaceKeyPropagation } from '@/composables/use-tag-inline-editor';
import { haveSameKeyOrder, reorderMatchingItems } from '@/utils/reorder-matching-items';
import TagOverflowList from './tag-overflow-list.vue';
import type { TagOverflowItem } from './tag-overflow-list';

const props = withDefaults(defineProps<{
  tags: ItemTag[];
  selectedTagIds: string[];
  allowCreate?: boolean;
  triggerVariant?: 'default' | 'compact' | 'icon';
  fullWidth?: boolean;
  openOnMount?: boolean;
  align?: PopoverContentProps['align'];
  side?: PopoverContentProps['side'];
  alignOffset?: PopoverContentProps['alignOffset'];
  sideOffset?: PopoverContentProps['sideOffset'];
}>(), {
  allowCreate: true,
  triggerVariant: 'default',
  fullWidth: false,
  openOnMount: false,
  align: 'start',
  side: 'bottom',
  alignOffset: 0,
  sideOffset: 4,
});

const emit = defineEmits<{
  'toggle-tag': [tagId: string];
  'create-tag': [name: string];
  'rename-tag': [tagId: string, name: string];
  'update-tag-color': [tagId: string, color: string];
  'reorder-tags': [tags: ItemTag[]];
  'open-change': [open: boolean];
}>();

const { t } = useI18n();
const searchQuery = ref('');
const isOpen = ref(props.openOnMount);
const commandKey = ref(0);

const tagsRef = computed(() => props.tags);

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
  onColorInput,
  onColorBlur,
  resetEditState,
} = useTagInlineEditor({
  tags: tagsRef,
  onRename: (tagId, name) => emit('rename-tag', tagId, name),
  onUpdateColor: (tagId, color) => emit('update-tag-color', tagId, color),
});

const trimmedSearchQuery = computed(() => searchQuery.value.trim());
const selectedTagIdsSet = computed(() => new Set(props.selectedTagIds));

const filteredTags = computed(() => {
  const normalizedSearch = searchQuery.value.trim().toLowerCase();
  if (!normalizedSearch) return props.tags;
  return props.tags.filter(tag => tag.name.toLowerCase().includes(normalizedSearch));
});

const canCreate = computed(() => {
  if (!props.allowCreate) return false;
  const value = trimmedSearchQuery.value;
  if (value.length === 0) return false;
  const normalizedValue = value.toLowerCase();
  return !props.tags.some(tag => tag.name.toLowerCase() === normalizedValue);
});

const selectedTags = computed(() => {
  return props.tags.filter(tag => selectedTagIdsSet.value.has(tag.id));
});

const selectedOverflowTags = computed<TagOverflowItem[]>(() => {
  return selectedTags.value.map(tag => ({
    id: tag.id,
    name: tag.name,
    color: displayColor(tag),
  }));
});

function getTagKey(tag: ItemTag): string {
  return tag.id;
}

function toggleTag(tagId: string) {
  emit('toggle-tag', tagId);
}

function handleTagsReorder(nextVisibleTags: ItemTag[]) {
  const nextTags = reorderMatchingItems(props.tags, nextVisibleTags, getTagKey);

  if (haveSameKeyOrder(props.tags, nextTags, getTagKey)) {
    return;
  }

  emit('reorder-tags', nextTags);
}

function handleTagsDragEnd() {
  function swallowClick(clickEvent: MouseEvent) {
    clickEvent.preventDefault();
    clickEvent.stopPropagation();
    window.removeEventListener('click', swallowClick, true);
  }

  window.addEventListener('click', swallowClick, true);
  window.setTimeout(() => {
    window.removeEventListener('click', swallowClick, true);
  }, 0);
}

function onSelectTag(tag: ItemTag) {
  if (editingTagId.value === tag.id) {
    return;
  }

  toggleTag(tag.id);
}

watch(isOpen, (open) => {
  emit('open-change', open);

  if (!open) {
    resetEditState();
  }
});

function createTag() {
  const name = trimmedSearchQuery.value;
  if (!name) return;
  emit('create-tag', name);
  clearSearch();
  commandKey.value += 1;
}

function clearSearch() {
  searchQuery.value = '';
}

</script>

<template>
  <Popover v-model:open="isOpen">
    <PopoverTrigger as-child>
      <Button
        v-if="triggerVariant === 'icon'"
        variant="ghost"
        size="icon"
        class="tag-selector__trigger-icon"
      >
        <TagIcon :size="16" />
      </Button>
      <Button
        v-else-if="triggerVariant === 'compact'"
        variant="outline"
        size="xs"
        class="tag-selector__trigger tag-selector__trigger--compact"
      >
        <TagIcon :size="14" />
        <span
          v-if="selectedTags.length > 0"
          class="tag-selector__count"
        >
          {{ selectedTags.length }}
        </span>
      </Button>
      <Button
        v-else
        variant="outline"
        size="xs"
        class="tag-selector__trigger"
        :class="{ 'tag-selector__trigger--full-width': fullWidth }"
      >
        <TagIcon class="tag-selector__trigger-icon-plus" />
        <span class="tag-selector__label">{{ t('tags.editTags') }}</span>
        <template v-if="selectedOverflowTags.length > 0">
          <TagOverflowList :tags="selectedOverflowTags" />
        </template>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      class="tag-selector__content"
      :align="align"
      :side="side"
      :align-offset="alignOffset"
      :side-offset="sideOffset"
    >
      <Command :key="commandKey">
        <CommandInput
          v-model="searchQuery"
          :placeholder="t('tags.searchTags')"
          @keydown="stopSpaceKeyPropagation"
          @keydown.esc="clearSearch"
        />
        <CommandList class="tag-selector__command-list">
          <CommandEmpty v-if="filteredTags.length === 0 && !canCreate">
            {{ t('tags.noTagsFound') }}
          </CommandEmpty>
          <div
            v-if="canCreate"
            class="tag-selector__create"
          >
            <Button
              variant="outline"
              size="sm"
              class="tag-selector__create-button"
              @click="createTag"
            >
              <CirclePlusIcon class="tag-selector__create-icon" />
              {{ t('tags.createTag') }} "{{ trimmedSearchQuery }}"
            </Button>
          </div>
          <CommandGroup v-if="filteredTags.length > 0">
            <SortableList
              class="tag-selector__sortable"
              :items="filteredTags"
              :get-key="getTagKey"
              handle-selector=".tag-selector__drag-handle"
              @set="handleTagsReorder"
              @drag-end="handleTagsDragEnd"
            >
              <template #item="{ item: tag }">
                <div class="sigma-ui-command-item tag-selector__item">
                  <button
                    type="button"
                    class="tag-selector__drag-handle"
                    aria-hidden="true"
                    tabindex="-1"
                    @click.stop
                  >
                    <GripVerticalIcon :size="14" />
                  </button>
                  <button
                    type="button"
                    class="tag-selector__checkbox"
                    :data-selected="selectedTagIdsSet.has(tag.id) || undefined"
                    :style="selectedTagIdsSet.has(tag.id) ? { borderColor: displayColor(tag) + '80', backgroundColor: displayColor(tag) + '20' } : undefined"
                    @click.stop="onSelectTag(tag)"
                  >
                    <CheckIcon
                      class="tag-selector__check"
                      :style="{ color: displayColor(tag) }"
                    />
                  </button>
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
                      :title="t('tags.renameTag')"
                      @pointerdown="onToggleControlPointerDown($event, tag)"
                      @click="startEdit($event, tag)"
                    >
                      <PencilIcon :size="16" />
                    </button>
                  </div>
                </div>
              </template>
            </SortableList>
          </CommandGroup>
          <CommandSeparator v-if="$slots.footer" />
          <div
            v-if="$slots.footer"
            class="tag-selector__footer"
          >
            <slot name="footer" />
          </div>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>

<style>
.tag-selector__command-list {
  height: 200px;
}

.tag-selector__trigger {
  overflow: hidden;
  border-style: dashed;
  color: hsl(var(--popover-foreground));
  gap: 8px;
}

.tag-selector__trigger:hover {
  color: hsl(var(--popover-foreground) / 80%);
}

.tag-selector__trigger--compact {
  flex-shrink: 0;
  padding: 4px 8px;
  gap: 4px;
}

.tag-selector__trigger--full-width {
  width: 100%;
  justify-content: flex-start;
}

.tag-selector__trigger-icon-plus {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

.tag-selector__label {
  flex-shrink: 0;
  font-weight: 400;
}

.tag-selector__label:hover {
  color: hsl(var(--popover-foreground) / 80%);
}

.tag-selector__count {
  display: inline-flex;
  min-width: 16px;
  height: 16px;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  border-radius: 4px;
  background-color: hsl(var(--primary) / 20%);
  color: hsl(var(--primary));
  font-size: 11px;
  font-weight: 600;
}

.tag-selector__badge {
  display: inline-flex;
  overflow: hidden;
  max-width: 100%;
  height: 18px;
  align-items: center;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-selector__badge--more {
  flex-shrink: 0;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.tag-selector__content {
  width: 280px;
  padding: 0;
}

.tag-selector__create {
  padding: 8px;
}

.tag-selector__create-button {
  width: 100%;
  justify-content: flex-start;
  gap: 8px;
}

.tag-selector__create-icon {
  width: 16px;
  height: 16px;
}

.tag-selector__checkbox {
  display: flex;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 1.5px solid hsl(var(--muted-foreground) / 70%);
  border-radius: 4px;
  margin-right: 8px;
  background: transparent;
  cursor: pointer;
}

.tag-selector__checkbox:not([data-selected]) .tag-selector__check {
  visibility: hidden;
}

.tag-selector__check {
  width: 14px;
  height: 14px;
}

.tag-selector__color-dot-wrap {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-right: 8px;
  cursor: pointer;
}

.tag-selector__color-dot-hitbox {
  position: relative;
  display: flex;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
}

.tag-selector__color-input {
  position: absolute;
  width: 100%;
  height: 100%;
  padding: 0;
  margin: 0;
  cursor: pointer;
  inset: 0;
  opacity: 0;
}

.tag-selector__color-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  pointer-events: none;
}

.tag-selector__tag-name {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-selector__sortable :deep(.sortable-list__items) {
  display: flex;
  flex-direction: column;
}

.tag-selector__item {
  position: relative;
}

.tag-selector__item:hover {
  background-color: hsl(var(--secondary));
  color: hsl(var(--popover-foreground) / 80%);
}

.tag-selector__drag-handle {
  display: inline-flex;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: var(--radius-sm);
  margin-right: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  touch-action: none;
}

.tag-selector__drag-handle:hover {
  background-color: hsl(var(--muted) / 40%);
  color: hsl(var(--foreground));
}

.tag-selector__drag-handle:active {
  cursor: grabbing;
}

.tag-selector__rename-input {
  min-width: 0;
  height: 1.75rem;
  flex: 1;
  font-size: 0.8125rem;
  padding-block: 0.125rem;
  padding-inline: 0.375rem;
}

.tag-selector__item-actions {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  margin-left: auto;
  gap: 2px;
}

.tag-selector__edit {
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

.tag-selector__item:hover .tag-selector__edit {
  opacity: 1;
}

.tag-selector__edit:hover {
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.tag-selector__footer {
  padding: 8px;
}
</style>
