<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { useThrottleFn } from '@vueuse/core';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import {
  CheckIcon, CirclePlusIcon, PencilIcon, TagIcon, Trash2Icon,
} from '@lucide/vue';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import type { ItemTag } from '@/types/user-stats';
import type { PopoverContentProps } from 'reka-ui';

const props = withDefaults(defineProps<{
  tags: ItemTag[];
  selectedTagIds: string[];
  allowCreate?: boolean;
  triggerVariant?: 'default' | 'compact' | 'icon';
  maxBadges?: number;
  fullWidth?: boolean;
  align?: PopoverContentProps['align'];
  side?: PopoverContentProps['side'];
  alignOffset?: PopoverContentProps['alignOffset'];
  sideOffset?: PopoverContentProps['sideOffset'];
}>(), {
  allowCreate: true,
  triggerVariant: 'default',
  maxBadges: 2,
  fullWidth: false,
  align: 'start',
});

const emit = defineEmits<{
  'toggle-tag': [tagId: string];
  'create-tag': [name: string];
  'delete-tag': [tagId: string];
  'rename-tag': [tagId: string, name: string];
  'update-tag-color': [tagId: string, color: string];
}>();

const { t } = useI18n();
const searchQuery = ref('');
const isOpen = ref(false);
const commandKey = ref(0);
const editingTagId = ref<string | null>(null);
const editDraft = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);
const previewTagColors = ref<Record<string, string>>({});
const pendingTagColors = ref<Record<string, string>>({});

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

function displayColor(tag: ItemTag): string {
  return previewTagColors.value[tag.id] ?? tag.color;
}

function flushPendingColorsToParent() {
  const snapshot = { ...pendingTagColors.value };

  if (Object.keys(snapshot).length === 0) {
    return;
  }

  for (const [tagId, color] of Object.entries(snapshot)) {
    emit('update-tag-color', tagId, color);

    if (pendingTagColors.value[tagId] === color) {
      delete pendingTagColors.value[tagId];
    }
  }
}

const schedulePersistTagColors = useThrottleFn(flushPendingColorsToParent, 1000, true, false);

function toggleTag(tagId: string) {
  emit('toggle-tag', tagId);
}

function deleteTag(event: Event, tagId: string) {
  event.stopPropagation();

  if (editingTagId.value === tagId) {
    cancelEdit();
  }

  emit('delete-tag', tagId);
}

function cancelEdit() {
  editingTagId.value = null;
  editDraft.value = '';
}

function commitEdit() {
  const activeTagId = editingTagId.value;

  if (activeTagId === null) {
    return;
  }

  const tag = props.tags.find(item => item.id === activeTagId);

  if (!tag) {
    cancelEdit();
    return;
  }

  const trimmed = editDraft.value.trim();

  if (trimmed === '') {
    cancelEdit();
    return;
  }

  if (trimmed === tag.name) {
    cancelEdit();
    return;
  }

  emit('rename-tag', activeTagId, trimmed);
  cancelEdit();
}

function startEdit(event: Event, tag: ItemTag) {
  event.stopPropagation();
  event.preventDefault();

  if (editingTagId.value === tag.id) {
    commitEdit();
    return;
  }

  if (editingTagId.value !== null && editingTagId.value !== tag.id) {
    commitEdit();
  }

  editingTagId.value = tag.id;
  editDraft.value = tag.name;
  void nextTick(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  });
}

function onSelectTag(tag: ItemTag) {
  if (editingTagId.value === tag.id) {
    return;
  }

  toggleTag(tag.id);
}

watch(isOpen, (open) => {
  if (!open) {
    flushPendingColorsToParent();
    cancelEdit();
  }
});

watch(
  () => props.tags,
  (tags) => {
    const validIds = new Set(tags.map(tagItem => tagItem.id));
    const preview = { ...previewTagColors.value };
    const pending = { ...pendingTagColors.value };

    for (const tagId of Object.keys(preview)) {
      if (!validIds.has(tagId)) {
        delete preview[tagId];
      }
    }

    for (const tagId of Object.keys(pending)) {
      if (!validIds.has(tagId)) {
        delete pending[tagId];
      }
    }

    for (const tag of tags) {
      const previewed = preview[tag.id];

      if (
        previewed
        && colorHexForPicker(tag.color).toLowerCase() === previewed.toLowerCase()
      ) {
        delete preview[tag.id];
      }
    }

    previewTagColors.value = preview;
    pendingTagColors.value = pending;
  },
  { deep: true },
);

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

function stopSpaceFromReachingCombobox(event: KeyboardEvent) {
  if (event.key === ' ') {
    event.stopPropagation();
  }
}

function colorHexForPicker(color: string): string {
  const trimmed = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return '#64748b';
}

function onColorInput(event: Event, tagId: string) {
  event.stopPropagation();
  const target = event.target as HTMLInputElement;
  const next = target.value;
  const tag = props.tags.find(tagItem => tagItem.id === tagId);

  if (!tag) {
    return;
  }

  const effectiveCurrent = previewTagColors.value[tagId] ?? tag.color;

  if (
    colorHexForPicker(effectiveCurrent).toLowerCase() === next.toLowerCase()
  ) {
    return;
  }

  previewTagColors.value = {
    ...previewTagColors.value,
    [tagId]: next,
  };
  pendingTagColors.value = {
    ...pendingTagColors.value,
    [tagId]: next,
  };
  void schedulePersistTagColors();
}

function onColorBlur(event: Event) {
  event.stopPropagation();
  flushPendingColorsToParent();
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
        <template v-if="selectedTags.length > 0">
          <div class="tag-selector__selected-tags">
            <span
              v-for="tag in selectedTags.slice(0, maxBadges)"
              :key="tag.id"
              class="tag-selector__badge"
              :style="{ backgroundColor: displayColor(tag) + '25', color: displayColor(tag) }"
            >
              {{ tag.name }}
            </span>
            <span
              v-if="selectedTags.length > maxBadges"
              class="tag-selector__badge tag-selector__badge--more"
            >
              +{{ selectedTags.length - maxBadges }}
            </span>
          </div>
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
          @keydown="stopSpaceFromReachingCombobox"
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
            <CommandItem
              v-for="tag in filteredTags"
              :key="tag.id"
              :value="tag.name"
              class="tag-selector__item"
              @select="() => onSelectTag(tag)"
            >
              <div
                class="tag-selector__checkbox"
                :data-selected="selectedTagIdsSet.has(tag.id) || undefined"
                :style="selectedTagIdsSet.has(tag.id) ? { borderColor: displayColor(tag) + '80', backgroundColor: displayColor(tag) + '20' } : undefined"
              >
                <CheckIcon
                  class="tag-selector__check"
                  :style="{ color: displayColor(tag) }"
                />
              </div>
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
                @keydown="stopSpaceFromReachingCombobox"
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
                  @click="(event) => startEdit(event, tag)"
                >
                  <PencilIcon :size="14" />
                </button>
                <button
                  type="button"
                  class="tag-selector__delete"
                  :title="t('tags.deleteTag')"
                  @click="(event) => deleteTag(event, tag.id)"
                >
                  <Trash2Icon :size="14" />
                </button>
              </div>
            </CommandItem>
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

.tag-selector__selected-tags {
  display: flex;
  overflow: hidden;
  min-width: 0;
  flex: 1;
  gap: 4px;
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
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
  margin-right: 8px;
  opacity: 0.6;
}

.tag-selector__checkbox:not([data-selected]) .tag-selector__check {
  visibility: hidden;
}

.tag-selector__checkbox[data-selected] {
  opacity: 1;
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
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 6px;
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

.tag-selector__item {
  position: relative;
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

.tag-selector__edit,
.tag-selector__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.tag-selector__item:hover .tag-selector__edit,
.tag-selector__item:hover .tag-selector__delete {
  opacity: 1;
}

.tag-selector__edit:hover {
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--primary));
}

.tag-selector__delete:hover {
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}

.tag-selector__footer {
  padding: 8px;
}
</style>
