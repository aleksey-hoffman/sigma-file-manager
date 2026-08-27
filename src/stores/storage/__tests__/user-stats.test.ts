// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { StartupStorageFileBootstrap } from '@/stores/storage/utils/startup-storage-bootstrap';
import { useUserStatsStore } from '@/stores/storage/user-stats';
import { DEFAULT_USER_STATS } from '@/types/user-stats';
import type { FavoriteItem, ItemTag, TaggedItem } from '@/types/user-stats';
import { reorderMatchingItems } from '@/utils/reorder-matching-items';

const {
  lazyStoreSaveMock,
  lazyStoreSetMock,
  storedValues,
} = vi.hoisted(() => ({
  lazyStoreSaveMock: vi.fn(),
  lazyStoreSetMock: vi.fn(),
  storedValues: new Map<string, unknown>(),
}));

vi.mock('@tauri-apps/plugin-store', () => ({
  LazyStore: class {
    async save(): Promise<void> {
      await lazyStoreSaveMock();
    }

    async set(key: string, value: unknown): Promise<void> {
      storedValues.set(key, value);
      await lazyStoreSetMock(key, value);
    }

    async entries(): Promise<[string, unknown][]> {
      return Array.from(storedValues.entries());
    }
  },
}));

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@/stores/storage/user-paths', () => ({
  useUserPathsStore: () => ({
    customPaths: {
      appUserDataStatsPath: '/tmp/user-data/user-stats.json',
    },
  }),
}));

vi.mock('@/localization', () => ({
  i18n: {
    global: {
      t: (key: string) => key,
    },
  },
}));

function createFavorite(path: string): FavoriteItem {
  return {
    path,
    addedAt: 1,
  };
}

function createTag(id: string, name: string): ItemTag {
  return {
    id,
    name,
    color: '#000000',
  };
}

function createTaggedItem(path: string, tagIds: string[]): TaggedItem {
  return {
    path,
    tagIds,
    addedAt: 1,
    isFile: false,
  };
}

function createStatsBootstrap(data: Record<string, unknown>): StartupStorageFileBootstrap {
  return {
    path: '/tmp/user-data/user-stats.json',
    status: 'ready',
    data,
    schemaVersion: 1,
    error: null,
  };
}

describe('user stats reorder setters', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storedValues.clear();
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
  });

  it('saves favorites in the UI order', async () => {
    const favorites = [
      createFavorite('/a'),
      createFavorite('/b'),
      createFavorite('/c'),
    ];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favorites,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    const nextFavorites = [favorites[2], favorites[0], favorites[1]];
    await store.setFavorites(nextFavorites);

    expect(store.favorites.map(item => item.path)).toEqual(['/c', '/a', '/b']);
    expect(lazyStoreSetMock).toHaveBeenCalledWith('favorites', nextFavorites);
    expect(lazyStoreSaveMock).toHaveBeenCalled();
  });

  it('does not save favorites when membership changes or order is unchanged', async () => {
    const favorites = [createFavorite('/a'), createFavorite('/b')];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favorites,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    await store.setFavorites([createFavorite('/a'), createFavorite('/other')]);
    await store.setFavorites(favorites);

    expect(store.favorites.map(item => item.path)).toEqual(['/a', '/b']);
    expect(lazyStoreSetMock).not.toHaveBeenCalled();
  });

  it('saves tagged items in the merged UI order', async () => {
    const tags = [
      createTag('tag-work', 'Work'),
      createTag('tag-personal', 'Personal'),
    ];
    const taggedItems = [
      createTaggedItem('/work-1', ['tag-work']),
      createTaggedItem('/personal-1', ['tag-personal']),
      createTaggedItem('/work-2', ['tag-work']),
    ];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      tags,
      taggedItems,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    const nextTaggedItems = [taggedItems[2], taggedItems[1], taggedItems[0]];
    await store.setTaggedItems(nextTaggedItems);

    expect(store.taggedItems.map(item => item.path)).toEqual([
      '/work-2',
      '/personal-1',
      '/work-1',
    ]);
    expect(lazyStoreSetMock).toHaveBeenCalledWith('taggedItems', nextTaggedItems);
  });

  it('persists a tag-group item reorder as a subset merge', async () => {
    const tags = [
      createTag('tag-work', 'Work'),
      createTag('tag-personal', 'Personal'),
    ];
    const taggedItems = [
      createTaggedItem('/work-1', ['tag-work']),
      createTaggedItem('/personal-1', ['tag-personal']),
      createTaggedItem('/work-2', ['tag-work']),
    ];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      tags,
      taggedItems,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    const workItems = [taggedItems[2], taggedItems[0]];
    const nextTaggedItems = reorderMatchingItems(
      store.taggedItems,
      workItems,
      item => item.path,
    );
    await store.setTaggedItems(nextTaggedItems);

    expect(store.taggedItems.map(item => item.path)).toEqual([
      '/work-2',
      '/personal-1',
      '/work-1',
    ]);
    expect(lazyStoreSetMock).toHaveBeenCalledWith('taggedItems', nextTaggedItems);
  });

  it('saves tags in the UI order', async () => {
    const tags = [
      createTag('tag-work', 'Work'),
      createTag('tag-personal', 'Personal'),
      createTag('tag-archive', 'Archive'),
    ];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      tags,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    const nextTags = [tags[2], tags[0], tags[1]];
    await store.setTags(nextTags);

    expect(store.tags.map(tag => tag.id)).toEqual([
      'tag-archive',
      'tag-work',
      'tag-personal',
    ]);
    expect(lazyStoreSetMock).toHaveBeenCalledWith('tags', nextTags);
    expect(lazyStoreSaveMock).toHaveBeenCalled();
  });

  it('does not save tags when membership changes or order is unchanged', async () => {
    const tags = [
      createTag('tag-work', 'Work'),
      createTag('tag-personal', 'Personal'),
    ];
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      tags,
    }));
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();

    await store.setTags([createTag('tag-work', 'Work'), createTag('tag-other', 'Other')]);
    await store.setTags(tags);

    expect(store.tags.map(tag => tag.id)).toEqual(['tag-work', 'tag-personal']);
    expect(lazyStoreSetMock).not.toHaveBeenCalled();
  });
});
