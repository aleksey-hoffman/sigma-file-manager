// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { computed } from 'vue';
import type { DirEntry } from '@/types/dir-entry';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import type { ItemTag } from '@/types/user-stats';

const tagColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899'];

export function useFileBrowserTags() {
  const userStatsStore = useUserStatsStore();
  const availableTags = computed(() => userStatsStore.tags);
  const tagIdsByPath = computed(() => {
    return new Map(userStatsStore.taggedItems.map(item => [item.path, item.tagIds]));
  });
  const tagsById = computed(() => {
    return new Map(userStatsStore.tags.map(tag => [tag.id, tag]));
  });

  function getEntryTagIds(entry: DirEntry): string[] {
    return tagIdsByPath.value.get(entry.path) ?? [];
  }

  function getEntryTags(entry: DirEntry): ItemTag[] {
    return getEntryTagIds(entry)
      .map(tagId => tagsById.value.get(tagId))
      .filter((tag): tag is ItemTag => !!tag);
  }

  function getEntriesSharedTagIds(entries: DirEntry[]): string[] {
    if (entries.length === 0) return [];

    if (entries.length === 1) {
      return getEntryTagIds(entries[0]);
    }

    const allTagIds = entries.map((entry) => {
      return new Set(getEntryTagIds(entry));
    });

    const firstSet = allTagIds[0] ?? new Set<string>();

    return Array.from(firstSet).filter(tagId =>
      allTagIds.every(tagSet => tagSet.has(tagId)),
    );
  }

  async function toggleTagForEntries(entries: DirEntry[], tagId: string) {
    const isCurrentlySelected = getEntriesSharedTagIds(entries).includes(tagId);

    for (const entry of entries) {
      if (isCurrentlySelected) {
        await userStatsStore.removeTagFromItem(entry.path, tagId);
      }
      else {
        await userStatsStore.addTagToItem(entry.path, tagId, entry.is_file);
      }
    }
  }

  async function createTagForEntries(entries: DirEntry[], name: string) {
    const randomColor = tagColors[Math.floor(Math.random() * tagColors.length)];
    const newTag = await userStatsStore.createTag(name, randomColor);

    for (const entry of entries) {
      await userStatsStore.addTagToItem(entry.path, newTag.id, entry.is_file);
    }
  }

  return {
    availableTags,
    getEntryTagIds,
    getEntryTags,
    getEntriesSharedTagIds,
    toggleTagForEntries,
    createTagForEntries,
    renameTag: userStatsStore.renameTag,
    updateTagColor: userStatsStore.updateTagColor,
  };
}
