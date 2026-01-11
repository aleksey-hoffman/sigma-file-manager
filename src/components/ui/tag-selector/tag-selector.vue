<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { CheckIcon, CirclePlusIcon, TagIcon, Trash2Icon } from 'lucide-vue-next';
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

const props = withDefaults(defineProps<{
  tags: ItemTag[];
  selectedTagIds: string[];
  allowCreate?: boolean;
  triggerVariant?: 'default' | 'compact' | 'icon';
  maxBadges?: number;
  fullWidth?: boolean;
}>(), {
  allowCreate: true,
  triggerVariant: 'default',
  maxBadges: 2,
  fullWidth: false,
});

const emit = defineEmits<{
  'toggle-tag': [tagId: string];
  'create-tag': [name: string];
  'delete-tag': [tagId: string];
}>();

const { t } = useI18n();
const searchQuery = ref('');
const isOpen = ref(false);
const commandKey = ref(0);

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

function toggleTag(tagId: string) {
  emit('toggle-tag', tagId);
}

function deleteTag(event: Event, tagId: string) {
  event.stopPropagation();
  emit('delete-tag', tagId);
}

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
        <CirclePlusIcon class="tag-selector__trigger-icon-plus" />
        <span class="tag-selector__label">{{ t('tags.editTags') }}</span>
        <template v-if="selectedTags.length > 0">
          <div class="tag-selector__selected-tags">
            <span
              v-for="tag in selectedTags.slice(0, maxBadges)"
              :key="tag.id"
              class="tag-selector__badge"
              :style="{ backgroundColor: tag.color + '25', color: tag.color }"
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
      align="start"
    >
      <Command :key="commandKey">
        <CommandInput
          v-model="searchQuery"
          :placeholder="t('tags.searchTags')"
          @keydown.esc="clearSearch"
        />
        <CommandList>
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
              @select="() => toggleTag(tag.id)"
            >
              <div
                class="tag-selector__checkbox"
                :data-selected="selectedTagIdsSet.has(tag.id) || undefined"
                :style="selectedTagIdsSet.has(tag.id) ? { borderColor: tag.color + '80', backgroundColor: tag.color + '20' } : undefined"
              >
                <CheckIcon
                  class="tag-selector__check"
                  :style="{ color: tag.color }"
                />
              </div>
              <span
                class="tag-selector__color-dot"
                :style="{ backgroundColor: tag.color }"
              />
              <span class="tag-selector__tag-name">{{ tag.name }}</span>
              <button
                type="button"
                class="tag-selector__delete"
                :title="t('tags.deleteTag')"
                @click="(event) => deleteTag(event, tag.id)"
              >
                <Trash2Icon :size="14" />
              </button>
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
.tag-selector__trigger {
  overflow: hidden;
  border-style: dashed;
  gap: 8px;
}

.tag-selector__trigger--compact {
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

.tag-selector__color-dot {
  width: 10px;
  height: 10px;
  flex-shrink: 0;
  border-radius: 50%;
  margin-right: 8px;
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

.tag-selector__delete {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  border-radius: 4px;
  margin-left: auto;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s, background-color 0.15s;
}

.tag-selector__item:hover .tag-selector__delete {
  opacity: 1;
}

.tag-selector__delete:hover {
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}

.tag-selector__footer {
  padding: 8px;
}
</style>
