// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { defineStore } from 'pinia';
import { useMcpStore } from '@/stores/runtime/mcp';
import { invoke } from '@tauri-apps/api/core';
import { LazyStore } from '@tauri-apps/plugin-store';
import { ref, computed } from 'vue';
import { useUserPathsStore } from './user-paths';
import type {
  UserStats,
  FavoriteCategory,
  FavoriteItem,
  HistoryItem,
  FrequentItem,
  ItemTag,
  TaggedItem,
} from '@/types/user-stats';
import { DEFAULT_USER_STATS } from '@/types/user-stats';
import {
  canUseStartupStorageFastPath,
  getStartupStorageFile,
  getStartupStorageRecord,
  type StartupStorageFileBootstrap,
} from './utils/startup-storage-bootstrap';
import { i18n } from '@/localization';
import { getTagsByIdsInListOrder } from '@/utils/item-tag-order';
import { reconcileMissingTagDefinitions as mergeTagDefinitionsFromTaggedItems } from '@/utils/reconcile-user-stats-tags';
import { haveSameKeyOrder, haveSameKeys } from '@/utils/reorder-matching-items';
import { isVirtualLocationPath } from '@/utils/virtual-path-constants';

const HISTORY_MAX_ITEMS = 100;
const FREQUENT_ITEMS_MAX = 100;
const PATH_EXISTS_BATCH_SIZE = 4;

// FORK-MODIFICATION: 顶层字段白名单（预批 0，2026-10-15）。
// 原来是 `key in userStats.value` —— 判断对象是**运行时实例**，于是：
//   1) 给 UserStats 加了字段却忘了加进 DEFAULT_USER_STATS，会静默丢数据：
//      不报错、不落盘、界面上没有任何线索，下一轮加 `categories` 时必踩；
//   2) `in` 会走原型链，`toString` / `constructor` 这类继承键能通过判断，
//      顺着写进去就是把原型成员换成用户的脏数据（与 thumbnail-metrics 那次同类）。
// 现在改成从 DEFAULT_USER_STATS 派生白名单，方向反过来了 ——
// 遍历「schema 认为合法的字段」并去记录里取值，两个方向的问题一起消失。
// DEFAULT_USER_STATS 与 UserStats 的字段一致性由
// __tests__/user-stats.test.ts 里的编译期断言守住，漏改会被 npm run ts 拦下。
const USER_STATS_TOP_LEVEL_KEYS = Object.keys(DEFAULT_USER_STATS) as Array<keyof UserStats>;

export const useUserStatsStore = defineStore('userStats', () => {
  const userPathsStore = useUserPathsStore();
  const userStatsStorage = ref<LazyStore | null>(null);
  const userStats = ref<UserStats>(structuredClone(DEFAULT_USER_STATS));
  let deferredMaintenancePromise: Promise<void> | null = null;

  const favorites = computed(() => userStats.value.favorites);
  // FORK-MODIFICATION: 反馈 4 —— 收藏分类。
  const favoriteCategories = computed(() => userStats.value.favoriteCategories);
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

      applyStatsRecord(storedStats ? Object.fromEntries(storedStats) : null);
      await deduplicateHistory();
    }
    catch (error) {
      console.error('Failed to load user stats:', error);
    }
  }

  function applyStatsRecord(statsRecord: Record<string, unknown> | null) {
    if (!statsRecord) {
      return;
    }

    for (const key of USER_STATS_TOP_LEVEL_KEYS) {
      if (Object.hasOwn(statsRecord, key)) {
        (userStats.value as Record<string, unknown>)[key] = statsRecord[key];
      }
    }

    // FORK-MODIFICATION: 反馈 4 —— 收藏条目新增 isFile / categoryId 后，老记录
    // 缺这两个键。归一化放在这里（读入的唯一入口）而不是各读取点，
    // 保证内存里的 FavoriteItem 形状永远一致。
    userStats.value.favorites = normalizeFavorites(userStats.value.favorites);
    userStats.value.favoriteCategories = normalizeFavoriteCategories(
      userStats.value.favoriteCategories,
    );
  }

  async function loadStatsFromBootstrap(bootstrapFile?: StartupStorageFileBootstrap): Promise<boolean> {
    if (!canUseStartupStorageFastPath(bootstrapFile)) {
      return false;
    }

    applyStatsRecord(getStartupStorageRecord(bootstrapFile));
    await deduplicateHistory();
    return true;
  }

  async function reconcileMissingTagDefinitions() {
    const didChange = mergeTagDefinitionsFromTaggedItems(
      userStats.value.tags,
      userStats.value.taggedItems,
      (tagId) => {
        const labelSource = tagId.startsWith('tag-') ? tagId.slice(4) : tagId;
        return String(i18n.global.t('tags.recoveredTag', { id: labelSource }));
      },
    );

    if (didChange) {
      await saveStats();
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

  function enforceUserStatsListLimits() {
    if (userStats.value.history.length > HISTORY_MAX_ITEMS) {
      const sortedByNewest = [...userStats.value.history].sort(
        (itemA, itemB) => itemB.openedAt - itemA.openedAt,
      );
      userStats.value.history = sortedByNewest.slice(0, HISTORY_MAX_ITEMS);
    }

    if (userStats.value.frequentItems.length > FREQUENT_ITEMS_MAX) {
      userStats.value.frequentItems.sort((itemA, itemB) => itemB.openCount - itemA.openCount);
      userStats.value.frequentItems = userStats.value.frequentItems.slice(
        0,
        FREQUENT_ITEMS_MAX,
      );
    }
  }

  async function saveStats() {
    try {
      enforceUserStatsListLimits();

      if (userStatsStorage.value) {
        await userStatsStorage.value.set('favorites', userStats.value.favorites);
        // FORK-MODIFICATION: 反馈 4 —— 这一行是修一个已发出去的数据丢失缺陷。
        // 加 favoriteCategories 到 DEFAULT_USER_STATS 只修好了「读」这一侧
        // （USER_STATS_TOP_LEVEL_KEYS 由它派生），写这一侧是下面这串显式的
        // set()，漏掉它就变成：新建分类 -> 界面出现 -> 刷新/重启后消失，
        // 不报错、不落盘。加新顶层字段时读白名单和写列表要一起改。
        await userStatsStorage.value.set('favoriteCategories', userStats.value.favoriteCategories);
        await userStatsStorage.value.set('tags', userStats.value.tags);
        await userStatsStorage.value.set('taggedItems', userStats.value.taggedItems);
        await userStatsStorage.value.set('history', userStats.value.history);
        await userStatsStorage.value.set('frequentItems', userStats.value.frequentItems);
        await userStatsStorage.value.save();
      }

      // FORK-MODIFICATION: MCP —— 把收藏分类推给 Rust 侧的 MCP 工具。
      // 收藏文件的位置用户可以自定义，Rust 自己拼路径会读错文件，所以由前端给。
      // 同步失败只记 warn：MCP 是可选功能，不能让它把收藏保存带崩。
      await useMcpStore().syncFavorites(
        userStats.value.favoriteCategories.map(category => ({
          id: category.id,
          name: category.name,
          items: userStats.value.favorites
            .filter(item => item.categoryId === category.id)
            .map(item => item.path),
        })),
      );
    }
    catch (error) {
      console.error('Failed to save user stats:', error);
    }
  }

  function isFavorite(path: string): boolean {
    return userStats.value.favorites.some(item => item.path === path);
  }

  // FORK-MODIFICATION: 反馈 4 —— 老收藏记录没有 isFile / categoryId。
  // 在**读入一处**补齐，而不是让每个读取点判 undefined：仪表盘原来把
  // 「路径含 `.`」当文件判定，复制到多处就等于把这个误判复制到多处。
  // 老数据只能按老规则兜底（拿不到别的信息），新数据一律用调用方给的 isFile。
  function inferLegacyFavoriteIsFile(path: string): boolean {
    return !path.endsWith('/') && path.includes('.');
  }

  function normalizeFavorites(favorites: unknown): FavoriteItem[] {
    if (!Array.isArray(favorites)) {
      return [];
    }

    const normalized: FavoriteItem[] = [];

    for (const rawItem of favorites) {
      if (!rawItem || typeof rawItem !== 'object') {
        continue;
      }

      const record = rawItem as Record<string, unknown>;

      if (typeof record.path !== 'string' || record.path.length === 0) {
        continue;
      }

      normalized.push({
        path: record.path,
        addedAt: typeof record.addedAt === 'number' ? record.addedAt : 0,
        isFile: typeof record.isFile === 'boolean'
          ? record.isFile
          : inferLegacyFavoriteIsFile(record.path),
        categoryId: typeof record.categoryId === 'string' ? record.categoryId : null,
      });
    }

    return normalized;
  }

  function normalizeFavoriteCategories(categories: unknown): FavoriteCategory[] {
    if (!Array.isArray(categories)) {
      return [];
    }

    const knownIds = new Set<string>();
    const normalized: FavoriteCategory[] = [];

    for (const rawItem of categories) {
      if (!rawItem || typeof rawItem !== 'object') {
        continue;
      }

      const record = rawItem as Record<string, unknown>;

      if (typeof record.id !== 'string' || record.id.length === 0) {
        continue;
      }

      if (typeof record.name !== 'string' || record.name.trim().length === 0) {
        continue;
      }

      // 重复 id 会让「按分类过滤」把同一条收藏显示两遍，直接丢掉后来的。
      if (knownIds.has(record.id)) {
        continue;
      }

      knownIds.add(record.id);
      normalized.push({
        id: record.id,
        name: record.name,
        createdAt: typeof record.createdAt === 'number' ? record.createdAt : 0,
      });
    }

    return normalized;
  }

  async function addToFavorites(path: string, isFile = false, categoryId: string | null = null) {
    if (isFavorite(path)) return;

    const newFavorite: FavoriteItem = {
      path,
      addedAt: Date.now(),
      isFile,
      categoryId,
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

  async function toggleFavorite(path: string, isFile = false): Promise<boolean> {
    if (isFavorite(path)) {
      await removeFromFavorites(path);
      return false;
    }
    else {
      await addToFavorites(path, isFile);
      return true;
    }
  }

  // FORK-MODIFICATION: 反馈 4 —— 收藏的编辑能力（排序 / 改归属分类）。

  /**
   * 在**当前分类内**把收藏上移/下移一位。
   *
   * 为什么在分类内而不是整个列表：仪表盘收藏是 grid 布局，跨分类移动会让
   * 卡片「跳」到另一个分组里，用户预期是「在我这组里挪一格」。分类之间要挪
   * 用 `moveFavoriteToCategory`。
   */
  async function moveFavoriteWithinCategory(path: string, direction: -1 | 1) {
    const favorites = userStats.value.favorites;
    const index = favorites.findIndex(item => item.path === path);

    if (index === -1) {
      return;
    }

    const currentCategoryId = favorites[index].categoryId;
    const siblingIndexes = favorites
      .map((item, itemIndex) => (item.categoryId === currentCategoryId ? itemIndex : -1))
      .filter(itemIndex => itemIndex !== -1);

    const positionInCategory = siblingIndexes.indexOf(index);

    if (positionInCategory === -1) {
      return;
    }

    const targetPosition = positionInCategory + direction;

    if (targetPosition < 0 || targetPosition >= siblingIndexes.length) {
      return;
    }

    const targetIndex = siblingIndexes[targetPosition];
    const moved = favorites[index];
    const displaced = favorites[targetIndex];

    favorites[index] = displaced;
    favorites[targetIndex] = moved;

    await saveStats();
  }

  async function moveFavoriteToCategory(path: string, categoryId: string | null) {
    const favorite = userStats.value.favorites.find(item => item.path === path);

    if (!favorite || favorite.categoryId === categoryId) {
      return;
    }

    favorite.categoryId = categoryId;
    await saveStats();
  }

  function hasFavoriteCategoryNameConflict(name: string, excludedId: string | null = null): boolean {
    const normalizedName = name.trim().toLowerCase();

    return userStats.value.favoriteCategories.some(
      category => category.id !== excludedId && category.name.toLowerCase() === normalizedName,
    );
  }

  async function createFavoriteCategory(name: string): Promise<FavoriteCategory | null> {
    const trimmed = name.trim();

    if (!trimmed || hasFavoriteCategoryNameConflict(trimmed)) {
      return null;
    }

    const newCategory: FavoriteCategory = {
      id: `favcat-${Date.now()}`,
      name: trimmed,
      createdAt: Date.now(),
    };

    userStats.value.favoriteCategories.push(newCategory);
    await saveStats();
    return newCategory;
  }

  async function renameFavoriteCategory(categoryId: string, name: string) {
    const trimmed = name.trim();
    const category = userStats.value.favoriteCategories.find(item => item.id === categoryId);

    if (!category || !trimmed || hasFavoriteCategoryNameConflict(trimmed, categoryId)) {
      return;
    }

    category.name = trimmed;
    await saveStats();
  }

  /**
   * 删除分类。**其下的收藏回到「未分类」，不连带删除。**
   *
   * 连带删除会静默丢用户数据，而且是不可逆的（收藏没法恢复）；回到未分类
   * 完全可逆 —— 用户重新建一个同名分类就能复原布局。
   */
  async function deleteFavoriteCategory(categoryId: string) {
    const categoryIndex = userStats.value.favoriteCategories.findIndex(item => item.id === categoryId);

    if (categoryIndex === -1) {
      return;
    }

    userStats.value.favoriteCategories.splice(categoryIndex, 1);

    for (const favorite of userStats.value.favorites) {
      if (favorite.categoryId === categoryId) {
        favorite.categoryId = null;
      }
    }

    await saveStats();
  }

  function getItemTags(path: string): ItemTag[] {
    const taggedItem = userStats.value.taggedItems.find(item => item.path === path);

    if (!taggedItem) return [];

    return getTagsByIdsInListOrder(userStats.value.tags, taggedItem.tagIds);
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

  async function renameTag(tagId: string, name: string) {
    const trimmed = name.trim();

    if (!trimmed) {
      return;
    }

    const tagIndex = userStats.value.tags.findIndex(tag => tag.id === tagId);

    if (tagIndex === -1) {
      return;
    }

    const hasConflict = userStats.value.tags.some(
      (tag, index) =>
        index !== tagIndex && tag.name.toLowerCase() === trimmed.toLowerCase(),
    );

    if (hasConflict) {
      return;
    }

    userStats.value.tags[tagIndex].name = trimmed;
    await saveStats();
  }

  async function replaceListIfMembershipMatches<T>(
    currentItems: T[],
    nextItems: T[],
    getKey: (item: T) => string,
    assign: (items: T[]) => void,
  ) {
    if (!haveSameKeys(currentItems, nextItems, getKey)) {
      return;
    }

    if (haveSameKeyOrder(currentItems, nextItems, getKey)) {
      return;
    }

    assign(nextItems);
    await saveStats();
  }

  async function setFavorites(nextFavorites: FavoriteItem[]) {
    await replaceListIfMembershipMatches(
      userStats.value.favorites,
      nextFavorites,
      item => item.path,
      (items) => {
        userStats.value.favorites = items;
      },
    );
  }

  async function setTaggedItems(nextTaggedItems: TaggedItem[]) {
    await replaceListIfMembershipMatches(
      userStats.value.taggedItems,
      nextTaggedItems,
      item => item.path,
      (items) => {
        userStats.value.taggedItems = items;
      },
    );
  }

  async function setTags(nextTags: ItemTag[]) {
    await replaceListIfMembershipMatches(
      userStats.value.tags,
      nextTags,
      tag => tag.id,
      (items) => {
        userStats.value.tags = items;
      },
    );
  }

  async function updateTagColor(tagId: string, color: string) {
    const tag = userStats.value.tags.find(tagItem => tagItem.id === tagId);

    if (!tag) {
      return;
    }

    tag.color = color;
    await saveStats();
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

  function isPathAffectedByDeletion(path: string | null, deletedPaths: string[]): boolean {
    if (path == null) return true;
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
    let resolvedCheckCount = 0;
    const pathsToCheck = Array.from(allPaths).filter(path => !isVirtualLocationPath(path));

    if (pathsToCheck.length === 0) return;

    for (let startIndex = 0; startIndex < pathsToCheck.length; startIndex += PATH_EXISTS_BATCH_SIZE) {
      const batchPaths = pathsToCheck.slice(startIndex, startIndex + PATH_EXISTS_BATCH_SIZE);
      const batchResults = await Promise.all(batchPaths.map(async (path) => {
        try {
          const exists = await invoke<boolean | null>('path_exists_with_timeout', {
            path,
          });
          return {
            path,
            exists,
          };
        }
        catch {
          return {
            path,
            exists: null,
          };
        }
      }));

      for (const batchResult of batchResults) {
        if (batchResult.exists === false) {
          nonExistentPaths.add(batchResult.path);
        }

        if (batchResult.exists !== null) {
          resolvedCheckCount++;
        }
      }
    }

    if (nonExistentPaths.size === 0) return;

    if (resolvedCheckCount === 0 || nonExistentPaths.size === allPaths.size) {
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

  async function init(bootstrapFile?: StartupStorageFileBootstrap) {
    const resolvedBootstrapFile = bootstrapFile ?? await getStartupStorageFile('userStats');
    await initStorage();
    const loadedFromBootstrap = await loadStatsFromBootstrap(resolvedBootstrapFile);

    if (!loadedFromBootstrap) {
      await loadStats();
    }

    await reconcileMissingTagDefinitions();
  }

  async function runDeferredMaintenance() {
    if (!deferredMaintenancePromise) {
      deferredMaintenancePromise = removeNonExistentPaths().finally(() => {
        deferredMaintenancePromise = null;
      });
    }

    await deferredMaintenancePromise;
  }

  return {
    userStats,
    favorites,
    favoriteCategories,
    tags,
    taggedItems,
    history,
    frequentItems,
    sortedHistory,
    sortedFrequentItems,
    init,
    runDeferredMaintenance,
    isFavorite,
    addToFavorites,
    removeFromFavorites,
    toggleFavorite,
    // FORK-MODIFICATION: 反馈 4 —— 收藏分类与收藏的编辑能力。
    moveFavoriteWithinCategory,
    moveFavoriteToCategory,
    createFavoriteCategory,
    renameFavoriteCategory,
    deleteFavoriteCategory,
    getItemTags,
    addTagToItem,
    removeTagFromItem,
    createTag,
    deleteTag,
    renameTag,
    setFavorites,
    setTaggedItems,
    setTags,
    updateTagColor,
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
