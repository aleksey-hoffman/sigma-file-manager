<!-- SPDX-License-Identifier: GPL-3.0-or-later
License: GNU GPLv3 or later. See the license file in the project root for more information.
Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
-->

<script setup lang="ts">
import { computed, ref, type ComponentPublicInstance } from 'vue';
import { useI18n } from 'vue-i18n';
import { GripVerticalIcon, MoreHorizontalIcon, PencilIcon, Trash2Icon } from '@lucide/vue';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { ItemTag } from '@/types/user-stats';
import { useTagInlineEditor, stopSpaceKeyPropagation } from '@/composables/use-tag-inline-editor';

const props = defineProps<{
  tag: ItemTag;
  count: number;
  selected: boolean;
  orphaned?: boolean;
}>();

const emit = defineEmits<{
  'select': [];
  'rename-tag': [tagId: string, name: string];
  'delete-tag': [tagId: string];
  'update-tag-color': [tagId: string, color: string];
}>();

const { t } = useI18n();
const tagsRef = computed(() => [props.tag]);
const isMenuOpen = ref(false);
const renameInput = ref<HTMLInputElement | null>(null);
let renameFocusPending = false;
let suppressRenameBlur = false;

const {
  editingTagId,
  colorEditingTagId,
  editDraft,
  setRenameInputRef,
  displayColor,
  colorHexForPicker,
  cancelEdit,
  commitEdit,
  startEdit,
  onColorPointerDown,
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

function selectTag() {
  emit('select');
}

function setRenameInput(element: Element | ComponentPublicInstance | null) {
  setRenameInputRef(element);
  renameInput.value = element instanceof HTMLInputElement ? element : null;
}

function focusRenameInput() {
  const input = renameInput.value;

  if (!input || editingTagId.value !== props.tag.id) {
    suppressRenameBlur = false;
    return;
  }

  input.focus();
  input.select();
  suppressRenameBlur = false;
}

function focusRenameInputAfterMenuCloses() {
  window.setTimeout(() => {
    window.setTimeout(() => {
      focusRenameInput();
    }, 0);
  }, 0);
}

function onMenuOpenChange(open: boolean) {
  isMenuOpen.value = open;

  if (open || !renameFocusPending) {
    return;
  }

  renameFocusPending = false;
  focusRenameInputAfterMenuCloses();
}

function renameFromMenu() {
  renameFocusPending = true;
  suppressRenameBlur = true;
  startEdit(new Event('click'), props.tag);
}

function onRenameBlur() {
  if (suppressRenameBlur) {
    return;
  }

  commitEdit();
}

function deleteFromMenu() {
  deleteTag(new Event('click'), props.tag.id);
}

const accentStyle = computed(() => {
  if (props.orphaned) {
    return undefined;
  }

  const accentColor = displayColor(props.tag);

  return {
    '--dashboard-tag-accent': accentColor,
    '--dashboard-tag-accent-border': `${accentColor}99`,
    '--dashboard-tag-accent-background': `${accentColor}1a`,
    '--dashboard-tag-accent-background-hover': `${accentColor}26`,
    '--dashboard-tag-accent-count-background': `${accentColor}33`,
  };
});
</script>

<template>
  <div
    class="dashboard-tag-list-item"
    :class="{
      'dashboard-tag-list-item--selected': selected,
      'dashboard-tag-list-item--orphaned': orphaned,
    }"
    :style="accentStyle"
    :aria-current="selected ? 'true' : undefined"
  >
    <button
      v-if="!orphaned"
      type="button"
      class="dashboard-tag-list-item__drag-handle"
      tabindex="-1"
      aria-hidden="true"
      @click.stop
    >
      <GripVerticalIcon :size="14" />
    </button>
    <button
      type="button"
      class="dashboard-tag-list-item__main"
      :class="{ 'dashboard-tag-list-item__main--editing': editingTagId === tag.id }"
      @click="selectTag"
    >
      <Tooltip v-if="!orphaned">
        <TooltipTrigger as-child>
          <label
            class="tag-selector__color-dot-wrap dashboard-tag-list-item__color-wrap"
            @click.stop
            @pointerdown.stop
          >
            <div
              class="tag-selector__color-dot-hitbox"
              :class="{ 'tag-selector__color-dot-hitbox--editing': colorEditingTagId === tag.id }"
            >
              <input
                type="color"
                class="tag-selector__color-input"
                :value="colorHexForPicker(displayColor(tag))"
                @click.stop="onColorClick($event, tag)"
                @pointerdown.stop="onColorPointerDown($event, tag)"
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
        </TooltipTrigger>
        <TooltipContent>
          {{ t('tags.tagColor') }}
        </TooltipContent>
      </Tooltip>
      <span
        v-else
        class="dashboard-tag-list-item__color dashboard-tag-list-item__color--muted"
        aria-hidden="true"
      />
      <span
        v-if="editingTagId !== tag.id"
        class="dashboard-tag-list-item__name"
      >{{ tag.name }}</span>
    </button>
    <input
      v-if="editingTagId === tag.id"
      :ref="setRenameInput"
      v-model="editDraft"
      class="sigma-ui-input dashboard-tag-list-item__rename-input"
      autofocus
      @keydown="stopSpaceKeyPropagation"
      @keydown.enter.prevent="commitEdit"
      @keydown.esc.prevent="cancelEdit"
      @blur="onRenameBlur"
      @click.stop
      @pointerdown.stop
    >
    <span class="dashboard-tag-list-item__count">{{ count }}</span>
    <Tooltip
      v-if="!orphaned"
      :disabled="isMenuOpen"
    >
      <DropdownMenu @update:open="onMenuOpenChange">
        <TooltipTrigger as-child>
          <DropdownMenuTrigger as-child>
            <button
              type="button"
              class="dashboard-tag-list-item__menu-button"
              :aria-label="t('options')"
              @click.stop
              @pointerdown.stop
            >
              <MoreHorizontalIcon :size="16" />
            </button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">
          {{ t('options') }}
        </TooltipContent>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            class="dashboard-tag-list-item__menu-item"
            @select="renameFromMenu"
          >
            <PencilIcon :size="14" />
            <span>{{ t('tags.renameTag') }}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            class="dashboard-tag-list-item__menu-item dashboard-tag-list-item__menu-item--danger"
            @select="deleteFromMenu"
          >
            <Trash2Icon :size="14" />
            <span>{{ t('tags.deleteTag') }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </Tooltip>
  </div>
</template>

<style>
.dashboard-tag-list-item {
  display: flex;
  width: 100%;
  height: 36px;
  align-items: center;
  padding: 0 8px 0 4px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background-color: transparent;
  color: hsl(var(--foreground));
  gap: 4px;
  transition:
    background-color var(--hover-transition-duration-out) var(--hover-transition-easing-out),
    border-color var(--hover-transition-duration-out) var(--hover-transition-easing-out);
}

.dashboard-tag-list-item:hover {
  background-color: hsl(var(--muted));
  transition:
    background-color var(--hover-transition-duration-in),
    border-color var(--hover-transition-duration-in);
}

.dashboard-tag-list-item--selected {
  border-color: var(--dashboard-tag-accent-border, hsl(var(--primary) / 50%));
  background-color: var(--dashboard-tag-accent-background, hsl(var(--primary) / 10%));
}

.dashboard-tag-list-item--selected:hover {
  background-color: var(--dashboard-tag-accent-background-hover, hsl(var(--primary) / 15%));
}

.dashboard-tag-list-item__drag-handle {
  display: flex;
  width: 18px;
  height: 100%;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: grab;
  opacity: 0;
}

.dashboard-tag-list-item:hover .dashboard-tag-list-item__drag-handle,
.dashboard-tag-list-item--selected .dashboard-tag-list-item__drag-handle {
  opacity: 1;
}

.dashboard-tag-list-item__main {
  display: flex;
  min-width: 0;
  height: 100%;
  flex: 1;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  gap: 8px;
  text-align: left;
}

.dashboard-tag-list-item__main--editing {
  flex: 0 0 auto;
}

.dashboard-tag-list-item__color-wrap {
  margin-right: 0;
}

.dashboard-tag-list-item .tag-selector__color-dot,
.dashboard-tag-list-item__color {
  width: 16px;
  height: 16px;
}

.dashboard-tag-list-item__color {
  flex-shrink: 0;
  border-radius: 50%;
  background-color: hsl(var(--muted-foreground) / 50%);
}

.dashboard-tag-list-item__name {
  overflow: hidden;
  min-width: 0;
  flex: 1;
  font-size: 0.875rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dashboard-tag-list-item__rename-input {
  min-width: 0;
  height: 24px;
  flex: 1;
  padding: 0 6px;
}

.dashboard-tag-list-item__menu-button {
  display: flex;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.dashboard-tag-list-item__menu-button:hover,
.dashboard-tag-list-item__menu-button[data-state="open"] {
  background-color: hsl(var(--primary) / 10%);
  color: hsl(var(--foreground));
}

.dashboard-tag-list-item__menu-item {
  gap: 8px;
}

.sigma-ui-dropdown-menu-item.dashboard-tag-list-item__menu-item--danger {
  color: hsl(var(--destructive));
}

.sigma-ui-dropdown-menu-item.dashboard-tag-list-item__menu-item--danger:focus {
  background-color: hsl(var(--destructive) / 10%);
  color: hsl(var(--destructive));
}

.dashboard-tag-list-item__count {
  display: flex;
  min-width: 20px;
  height: 20px;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  padding: 0 6px;
  border-radius: 10px;
  background-color: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
}

.dashboard-tag-list-item--selected .dashboard-tag-list-item__count {
  background-color: var(--dashboard-tag-accent-count-background, hsl(var(--primary) / 20%));
  color: var(--dashboard-tag-accent, hsl(var(--primary)));
}
</style>
