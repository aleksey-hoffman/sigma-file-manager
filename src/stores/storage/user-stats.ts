// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';
import { ref, computed } from 'vue';
import { useUserPathsStore } from './user-paths';
import type {
  UserStats,
  FavoriteItem,
  HistoryItem,
  FrequentItem,
  ItemTag,
  TaggedItem,
} from '@/types/user-stats';
import { DEFAULT_USER_STATS } from '@/types/user-stats';

const HISTORY_MAX_ITEMS = 200;
const FREQUENT_ITEMS_MAX = 100;

export const useUserStatsStore = defineStore('userStats', () => {
  const userPathsStore = useUserPathsStore();
  const userStatsStorage = ref<LazyStore | null>(null);
  const userStats = ref<UserStats>({ ...DEFAULT_USER_STATS });

  const favorites = computed(() => userStats.value.favorites);
  const tags = computed(() => userStats.value.tags);
  const taggedItems = computed(() => userStats.value.taggedItems);
  const history = computed(() => userStats.value.history);
  const frequentItems = computed(() => userStats.value.frequentItems);

  const sortedHistory = computed(() => {
    return [...userStats.value.history].sort((itemA, itemB) => itemB.openedAt - itemA.openedAt);
  });

  const sortedFrequentItems = computed(() => {
    return [...userStats.value.frequentItems].sort((itemA, itemB) => itemB.openCount - itemA.openCount);
  });

  async function initStorage() {
    try {
      if (!userStatsStorage.value) {
        userStatsStorage.value = await new LazyStore(userPathsStore.customPaths.appUserDataStatsPath);
        await userStatsStorage.value.save();
      }
    }
    catch (error) {
      console.error('Failed to initialize user stats storage:', error);
    }
  }

  async function loadStats() {
    try {
      const storedStats = await userStatsStorage.value?.entries();

      if (!storedStats || storedStats.length === 0) {
        return;
      }

      for (const [key, value] of storedStats) {
        if (key in userStats.value) {
          (userStats.value as Record<string, unknown>)[key] = value;
        }
      }

      await deduplicateHistory();
    }
    catch (error) {
      console.error('Failed to load user stats:', error);
    }
  }

  async function deduplicateHistory() {
    const seenPaths = new Set<string>();
    const deduplicatedHistory: HistoryItem[] = [];

    for (const item of userStats.value.history) {
      if (!seenPaths.has(item.path)) {
        seenPaths.add(item.path);
        deduplicatedHistory.push(item);
      }
    }

    if (deduplicatedHistory.length !== userStats.value.history.length) {
      userStats.value.history = deduplicatedHistory;
      await saveStats();
    }
  }

  async function saveStats() {
    try {
      if (userStatsStorage.value) {
        await userStatsStorage.value.set('favorites', userStats.value.favorites);
        await userStatsStorage.value.set('tags', userStats.value.tags);
        await userStatsStorage.value.set('taggedItems', userStats.value.taggedItems);
        await userStatsStorage.value.set('history', userStats.value.history);
        await userStatsStorage.value.set('frequentItems', userStats.value.frequentItems);
        await userStatsStorage.value.save();
      }
    }
    catch (error) {
      console.error('Failed to save user stats:', error);
    }
  }

  function isFavorite(path: string): boolean {
    return userStats.value.favorites.some(item => item.path === path);
  }

  async function addToFavorites(path: string) {
    if (isFavorite(path)) return;

    const newFavorite: FavoriteItem = {
      path,
      addedAt: Date.now(),
    };

    userStats.value.favorites.push(newFavorite);
    await saveStats();
  }

  async function removeFromFavorites(path: string) {
    const favoriteIndex = userStats.value.favorites.findIndex(item => item.path === path);

    if (favoriteIndex !== -1) {
      userStats.value.favorites.splice(favoriteIndex, 1);
      await saveStats();
    }
  }

  async function toggleFavorite(path: string): Promise<boolean> {
    if (isFavorite(path)) {
      await removeFromFavorites(path);
      return false;
    }
    else {
      await addToFavorites(path);
      return true;
    }
  }

  function getItemTags(path: string): ItemTag[] {
    const taggedItem = userStats.value.taggedItems.find(item => item.path === path);

    if (!taggedItem) return [];

    return userStats.value.tags.filter(tag => taggedItem.tagIds.includes(tag.id));
  }

  async function addTagToItem(path: string, tagId: string, isFile = false) {
    const existingItem = userStats.value.taggedItems.find(item => item.path === path);

    if (existingItem) {
      if (!existingItem.tagIds.includes(tagId)) {
        existingItem.tagIds.push(tagId);
      }
    }
    else {
      const newTaggedItem: TaggedItem = {
        path,
        tagIds: [tagId],
        addedAt: Date.now(),
        isFile,
      };
      userStats.value.taggedItems.push(newTaggedItem);
    }

    await saveStats();
  }

  async function removeTagFromItem(path: string, tagId: string) {
    const existingItem = userStats.value.taggedItems.find(item => item.path === path);

    if (existingItem) {
      existingItem.tagIds = existingItem.tagIds.filter(id => id !== tagId);

      if (existingItem.tagIds.length === 0) {
        const itemIndex = userStats.value.taggedItems.findIndex(item => item.path === path);
        userStats.value.taggedItems.splice(itemIndex, 1);
      }

      await saveStats();
    }
  }

  async function createTag(name: string, color: string): Promise<ItemTag> {
    const newTag: ItemTag = {
      id: `tag-${Date.now()}`,
      name,
      color,
    };

    userStats.value.tags.push(newTag);
    await saveStats();
    return newTag;
  }

  async function deleteTag(tagId: string) {
    const tagIndex = userStats.value.tags.findIndex(tag => tag.id === tagId);

    if (tagIndex !== -1) {
      userStats.value.tags.splice(tagIndex, 1);

      for (const item of userStats.value.taggedItems) {
        item.tagIds = item.tagIds.filter(id => id !== tagId);
      }

      userStats.value.taggedItems = userStats.value.taggedItems.filter(
        item => item.tagIds.length > 0,
      );

      await saveStats();
    }
  }

  async function recordItemOpen(path: string, isFile: boolean) {
    const existingHistoryIndex = userStats.value.history.findIndex(item => item.path === path);

    if (existingHistoryIndex !== -1) {
      userStats.value.history.splice(existingHistoryIndex, 1);
    }

    const historyItem: HistoryItem = {
      path,
      openedAt: Date.now(),
      isFile,
    };

    userStats.value.history.unshift(historyItem);

    if (userStats.value.history.length > HISTORY_MAX_ITEMS) {
      userStats.value.history = userStats.value.history.slice(0, HISTORY_MAX_ITEMS);
    }

    const existingFrequent = userStats.value.frequentItems.find(item => item.path === path);

    if (existingFrequent) {
      existingFrequent.openCount++;
      existingFrequent.lastOpenedAt = Date.now();
    }
    else {
      const newFrequent: FrequentItem = {
        path,
        openCount: 1,
        lastOpenedAt: Date.now(),
        isFile,
      };
      userStats.value.frequentItems.push(newFrequent);
    }

    if (userStats.value.frequentItems.length > FREQUENT_ITEMS_MAX) {
      userStats.value.frequentItems.sort((itemA, itemB) => itemB.openCount - itemA.openCount);
      userStats.value.frequentItems = userStats.value.frequentItems.slice(0, FREQUENT_ITEMS_MAX);
    }

    await saveStats();
  }

  async function clearHistory() {
    userStats.value.history = [];
    await saveStats();
  }

  async function removeFromHistory(path: string, openedAt: number) {
    const historyIndex = userStats.value.history.findIndex(
      item => item.path === path && item.openedAt === openedAt,
    );

    if (historyIndex !== -1) {
      userStats.value.history.splice(historyIndex, 1);
      await saveStats();
    }
  }

  async function clearAllFavorites() {
    userStats.value.favorites = [];
    await saveStats();
  }

  async function clearAllTagged() {
    userStats.value.taggedItems = [];
    await saveStats();
  }

  async function clearAllFrequent() {
    userStats.value.frequentItems = [];
    await saveStats();
  }

  async function handlePathRenamed(oldPath: string, newPath: string) {
    let hasChanges = false;

    for (const item of userStats.value.favorites) {
      const updated = replacePathPrefix(item.path, oldPath, newPath);

      if (updated !== null) {
        item.path = updated;
        hasChanges = true;
      }
    }

    for (const item of userStats.value.taggedItems) {
      const updated = replacePathPrefix(item.path, oldPath, newPath);

      if (updated !== null) {
        item.path = updated;
        hasChanges = true;
      }
    }

    for (const item of userStats.value.history) {
      const updated = replacePathPrefix(item.path, oldPath, newPath);

      if (updated !== null) {
        item.path = updated;
        hasChanges = true;
      }
    }

    for (const item of userStats.value.frequentItems) {
      const updated = replacePathPrefix(item.path, oldPath, newPath);

      if (updated !== null) {
        item.path = updated;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      await saveStats();
    }
  }

  function replacePathPrefix(path: string, oldPrefix: string, newPrefix: string): string | null {
    if (path === oldPrefix) return newPrefix;
    if (path.startsWith(oldPrefix + '/')) return newPrefix + path.slice(oldPrefix.length);
    return null;
  }

  function isPathAffectedByDeletion(path: string, deletedPaths: string[]): boolean {
    return deletedPaths.some(deletedPath =>
      path === deletedPath || path.startsWith(deletedPath + '/'),
    );
  }

  async function handlePathsDeleted(paths: string[]) {
    const originalCounts = {
      favorites: userStats.value.favorites.length,
      taggedItems: userStats.value.taggedItems.length,
      history: userStats.value.history.length,
      frequentItems: userStats.value.frequentItems.length,
    };

    userStats.value.favorites = userStats.value.favorites.filter(
      item => !isPathAffectedByDeletion(item.path, paths),
    );

    userStats.value.taggedItems = userStats.value.taggedItems.filter(
      item => !isPathAffectedByDeletion(item.path, paths),
    );

    userStats.value.history = userStats.value.history.filter(
      item => !isPathAffectedByDeletion(item.path, paths),
    );

    userStats.value.frequentItems = userStats.value.frequentItems.filter(
      item => !isPathAffectedByDeletion(item.path, paths),
    );

    const hasChanges
      = userStats.value.favorites.length !== originalCounts.favorites
        || userStats.value.taggedItems.length !== originalCounts.taggedItems
        || userStats.value.history.length !== originalCounts.history
        || userStats.value.frequentItems.length !== originalCounts.frequentItems;

    if (hasChanges) {
      await saveStats();
    }
  }

  async function removeNonExistentPaths() {
    const allPaths = new Set<string>();

    for (const item of userStats.value.favorites) allPaths.add(item.path);
    for (const item of userStats.value.taggedItems) allPaths.add(item.path);
    for (const item of userStats.value.history) allPaths.add(item.path);
    for (const item of userStats.value.frequentItems) allPaths.add(item.path);

    if (allPaths.size === 0) return;

    const nonExistentPaths = new Set<string>();
    let checkedCount = 0;

    await Promise.allSettled(
      Array.from(allPaths).map(async (path) => {
        try {
          const exists = await invoke<boolean>('path_exists', { path });

          if (!exists) {
            nonExistentPaths.add(path);
          }

          checkedCount++;
        }
        catch {
          checkedCount++;
        }
      }),
    );

    if (nonExistentPaths.size === 0) return;

    if (checkedCount === 0 || nonExistentPaths.size === allPaths.size) {
      return;
    }

    userStats.value.favorites = userStats.value.favorites.filter(
      item => !nonExistentPaths.has(item.path),
    );

    userStats.value.taggedItems = userStats.value.taggedItems.filter(
      item => !nonExistentPaths.has(item.path),
    );

    userStats.value.history = userStats.value.history.filter(
      item => !nonExistentPaths.has(item.path),
    );

    userStats.value.frequentItems = userStats.value.frequentItems.filter(
      item => !nonExistentPaths.has(item.path),
    );

    await saveStats();
  }

  async function init() {
    await initStorage();
    await loadStats();
    removeNonExistentPaths();
  }

  return {
    userStats,
    favorites,
    tags,
    taggedItems,
    history,
    frequentItems,
    sortedHistory,
    sortedFrequentItems,
    init,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    getItemTags,
    addTagToItem,
    removeTagFromItem,
    createTag,
    deleteTag,
    recordItemOpen,
    clearHistory,
    removeFromHistory,
    clearAllFavorites,
    clearAllTagged,
    clearAllFrequent,
    handlePathRenamed,
    handlePathsDeleted,
  };
});
