// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { useThrottleFn } from '@vueuse/core';
import { nextTick, ref, watch, type Ref } from 'vue';
import type { ItemTag } from '@/types/user-stats';

export function colorHexForPicker(color: string): string {
  const trimmed = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }

  return '#64748b';
}

export function stopSpaceKeyPropagation(event: KeyboardEvent) {
  if (event.key === ' ') {
    event.stopPropagation();
  }
}

export function useTagInlineEditor(options: {
  tags: Ref<ItemTag[]>;
  onRename: (tagId: string, name: string) => void;
  onDelete: (tagId: string) => void;
  onUpdateColor: (tagId: string, color: string) => void;
}) {
  const { tags, onRename, onDelete, onUpdateColor } = options;

  const editingTagId = ref<string | null>(null);
  const editDraft = ref('');
  const renameInputRef = ref<HTMLInputElement | null>(null);
  const previewTagColors = ref<Record<string, string>>({});
  const pendingTagColors = ref<Record<string, string>>({});

  function displayColor(tag: ItemTag): string {
    return previewTagColors.value[tag.id] ?? tag.color;
  }

  function flushPendingColorsToParent() {
    const snapshot = { ...pendingTagColors.value };

    if (Object.keys(snapshot).length === 0) {
      return;
    }

    for (const [tagId, color] of Object.entries(snapshot)) {
      onUpdateColor(tagId, color);

      if (pendingTagColors.value[tagId] === color) {
        delete pendingTagColors.value[tagId];
      }
    }
  }

  const schedulePersistTagColors = useThrottleFn(flushPendingColorsToParent, 1000, true, false);

  function cancelEdit() {
    editingTagId.value = null;
    editDraft.value = '';
  }

  function commitEdit() {
    const activeTagId = editingTagId.value;

    if (activeTagId === null) {
      return;
    }

    const tag = tags.value.find(item => item.id === activeTagId);

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

    onRename(activeTagId, trimmed);
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

  function deleteTag(event: Event, tagId: string) {
    event.stopPropagation();

    if (editingTagId.value === tagId) {
      cancelEdit();
    }

    onDelete(tagId);
  }

  function onColorInput(event: Event, tagId: string) {
    event.stopPropagation();
    const target = event.target as HTMLInputElement;
    const next = target.value;
    const tag = tags.value.find(tagItem => tagItem.id === tagId);

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

  function resetEditState() {
    flushPendingColorsToParent();
    cancelEdit();
  }

  watch(
    tags,
    (nextTags) => {
      const validIds = new Set(nextTags.map(tagItem => tagItem.id));
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

      for (const tag of nextTags) {
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

  return {
    editingTagId,
    editDraft,
    renameInputRef,
    colorHexForPicker,
    displayColor,
    cancelEdit,
    commitEdit,
    startEdit,
    deleteTag,
    onColorInput,
    onColorBlur,
    resetEditState,
  };
}
