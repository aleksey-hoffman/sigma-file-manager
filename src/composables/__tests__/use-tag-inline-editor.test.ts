// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useTagInlineEditor } from '@/composables/use-tag-inline-editor';
import type { ItemTag } from '@/types/user-stats';

function createTag(id: string): ItemTag {
  return {
    id,
    name: id,
    color: '#3b82f6',
  };
}

function createEditor(tags: ItemTag[] = [createTag('work')]) {
  return useTagInlineEditor({
    tags: ref(tags),
    onRename: vi.fn(),
    onUpdateColor: vi.fn(),
  });
}

function createCancelableEvent() {
  return new Event('click', {
    bubbles: true,
    cancelable: true,
  });
}

describe('useTagInlineEditor', () => {
  it('opens the rename input from the edit button', () => {
    const editor = createEditor();
    const tag = createTag('work');

    editor.startEdit(createCancelableEvent(), tag);

    expect(editor.editingTagId.value).toBe('work');
    expect(editor.editDraft.value).toBe('work');
  });

  it('closes the rename input when the edit button is pressed again', () => {
    const editor = createEditor();
    const tag = createTag('work');

    editor.startEdit(createCancelableEvent(), tag);
    editor.onToggleControlPointerDown(createCancelableEvent(), tag);
    editor.startEdit(createCancelableEvent(), tag);

    expect(editor.editingTagId.value).toBeNull();
  });

  it('closes the rename input when the color control is pressed again', () => {
    const editor = createEditor();
    const tag = createTag('work');
    const colorClick = createCancelableEvent();

    editor.startEdit(createCancelableEvent(), tag);
    editor.onToggleControlPointerDown(createCancelableEvent(), tag);
    editor.onColorClick(colorClick, tag);

    expect(editor.editingTagId.value).toBeNull();
    expect(colorClick.defaultPrevented).toBe(true);
  });

  it('opens the rename input from the color control', () => {
    const editor = createEditor();
    const tag = createTag('work');
    const colorClick = createCancelableEvent();

    editor.onColorClick(colorClick, tag);

    expect(editor.editingTagId.value).toBe('work');
    expect(colorClick.defaultPrevented).toBe(false);
  });
});
