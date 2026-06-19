// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { beforeEach, describe, expect, it } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useContextMenuItems } from '@/modules/navigator/components/file-browser/composables/use-context-menu-items';
import { usePlatformStore } from '@/stores/runtime/platform';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

function createDirectoryEntry(path: string): DirEntry {
  return {
    name: path,
    path,
    is_file: false,
    is_dir: true,
    is_hidden: false,
    is_symlink: false,
    size: 0,
    item_count: null,
    created_time: 0,
    modified_time: 0,
    accessed_time: 0,
    ext: null,
    mime: null,
  };
}

describe('useContextMenuItems virtual locations', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    usePlatformStore().currentPlatform = 'windows';
  });

  it('delegates visibility rules to the shared action visibility helper', () => {
    const selectedEntries = ref([createDirectoryEntry(LOCATIONS_VIRTUAL_PATH)]);
    const { isActionVisible } = useContextMenuItems(selectedEntries);

    expect(isActionVisible('toggle-favorite')).toBe(true);
    expect(isActionVisible('delete')).toBe(false);
  });
});
