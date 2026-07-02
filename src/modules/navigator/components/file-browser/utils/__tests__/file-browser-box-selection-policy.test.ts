// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  applyBoxSelectionMode,
  invertBoxSelection,
  mergeBoxSelection,
  resolveBoxSelectionModeFromPointerEvent,
  shouldClearSelectionOnBoxPointerUp,
  shouldPreserveBaseSelectionForBoxMode,
} from '../file-browser-box-selection-policy';

function createEntry(path: string): DirEntry {
  return {
    name: path.split('/').pop() ?? path,
    path,
    is_dir: false,
    is_file: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    item_count: null,
    ext: null,
    mime: null,
  };
}

describe('resolveBoxSelectionModeFromPointerEvent', () => {
  it('returns replace when no modifiers are pressed', () => {
    expect(resolveBoxSelectionModeFromPointerEvent({
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
    })).toBe('replace');
  });

  it('returns append for ctrl, meta, or shift without alt', () => {
    expect(resolveBoxSelectionModeFromPointerEvent({
      altKey: false,
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
    })).toBe('append');
    expect(resolveBoxSelectionModeFromPointerEvent({
      altKey: false,
      ctrlKey: false,
      metaKey: true,
      shiftKey: false,
    })).toBe('append');
    expect(resolveBoxSelectionModeFromPointerEvent({
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: true,
    })).toBe('append');
  });

  it('returns invert for alt even when append modifiers are pressed', () => {
    expect(resolveBoxSelectionModeFromPointerEvent({
      altKey: true,
      ctrlKey: true,
      metaKey: true,
      shiftKey: true,
    })).toBe('invert');
  });
});

describe('mergeBoxSelection', () => {
  it('adds box entries without duplicating base entries', () => {
    const baseEntries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
    ];
    const boxEntries = [
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
    ];

    expect(mergeBoxSelection(baseEntries, boxEntries).map(entry => entry.path)).toEqual([
      '/tmp/a',
      '/tmp/b',
      '/tmp/c',
    ]);
  });
});

describe('invertBoxSelection', () => {
  it('toggles selection for items inside the box and keeps items outside unchanged', () => {
    const baseEntries = [
      createEntry('/tmp/a'),
      createEntry('/tmp/b'),
      createEntry('/tmp/c'),
    ];
    const boxEntries = [
      createEntry('/tmp/b'),
      createEntry('/tmp/d'),
    ];

    expect(invertBoxSelection(baseEntries, boxEntries).map(entry => entry.path)).toEqual([
      '/tmp/a',
      '/tmp/c',
      '/tmp/d',
    ]);
  });
});

describe('applyBoxSelectionMode', () => {
  it('replaces the selection in replace mode', () => {
    const baseEntries = [createEntry('/tmp/a')];
    const boxEntries = [createEntry('/tmp/b')];

    expect(applyBoxSelectionMode(baseEntries, boxEntries, 'replace').map(entry => entry.path)).toEqual([
      '/tmp/b',
    ]);
  });

  it('merges the selection in append mode', () => {
    const baseEntries = [createEntry('/tmp/a')];
    const boxEntries = [createEntry('/tmp/b')];

    expect(applyBoxSelectionMode(baseEntries, boxEntries, 'append').map(entry => entry.path)).toEqual([
      '/tmp/a',
      '/tmp/b',
    ]);
  });
});

describe('shouldPreserveBaseSelectionForBoxMode', () => {
  it('preserves base selection only for append and invert modes', () => {
    expect(shouldPreserveBaseSelectionForBoxMode('replace')).toBe(false);
    expect(shouldPreserveBaseSelectionForBoxMode('append')).toBe(true);
    expect(shouldPreserveBaseSelectionForBoxMode('invert')).toBe(true);
  });
});

describe('shouldClearSelectionOnBoxPointerUp', () => {
  it('clears selection only for a replace click without an active box', () => {
    expect(shouldClearSelectionOnBoxPointerUp(false, 'replace', 0)).toBe(true);
    expect(shouldClearSelectionOnBoxPointerUp(true, 'replace', 0)).toBe(false);
    expect(shouldClearSelectionOnBoxPointerUp(false, 'append', 0)).toBe(false);
    expect(shouldClearSelectionOnBoxPointerUp(false, 'replace', 1)).toBe(false);
  });
});
