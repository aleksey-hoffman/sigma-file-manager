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
import type {
  FavoriteItem,
  ItemTag,
  TaggedItem,
  UserStats,
} from '@/types/user-stats';
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

// FORK-MODIFICATION: 反馈 4 —— FavoriteItem 增加了 isFile / categoryId。
function createFavorite(path: string): FavoriteItem {
  return {
    path,
    addedAt: 1,
    isFile: false,
    categoryId: null,
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

// FORK-MODIFICATION: 预批 0（2026-10-15）—— applyStatsRecord 的顶层字段白名单。
//
// 编译期护栏：DEFAULT_USER_STATS 必须覆盖 UserStats 的每一个字段。
// 声明这一行就会实例化 AssertNever，所以给 UserStats 加字段却忘了加默认值时，
// 这里直接是类型错误 —— npm run ts 拦下，不用等运行时丢一次数据才发现。
// 用 export 而不是普通 type alias，避免被当成未使用声明。
type MissingDefaultKeys = Exclude<keyof UserStats, keyof typeof DEFAULT_USER_STATS>;
type AssertNever<TField extends never> = TField;
export type UserStatsDefaultsCoverEveryField = AssertNever<MissingDefaultKeys>;

// 这组测试守的是「静默丢数据」这种不会报错的坏：白名单若又退回
// `key in userStats.value`，给 UserStats 加字段忘了加默认值时，
// 记录里的数据会被无声丢弃，界面上没有任何线索。
describe('user stats top-level field allowlist', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storedValues.clear();
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
  });

  it('applies every field that the stored record actually has', async () => {
    const favorites = [createFavorite('/kept')];
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favorites,
      tags: [createTag('tag-x', 'X')],
    }));

    expect(store.userStats.favorites).toEqual(favorites);
    expect(store.userStats.tags).toEqual([createTag('tag-x', 'X')]);
  });

  it('leaves the default in place for a field the stored record omits', async () => {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({ favorites: [createFavorite('/only-this')] }));

    // 记录里没有的字段必须保持默认值，而不是变成 undefined。
    expect(store.userStats.tags).toEqual(DEFAULT_USER_STATS.tags);
    expect(store.userStats.history).toEqual([]);
    expect(store.userStats.frequentItems).toEqual([]);
  });

  // 判别性用例：白名单若退回 `key in userStats.value`，
  // `categories` 会因为「UserStats 类型里还没有、但记录里带了」而被静默丢在门外，
  // 而这里断言的是它连 key 都不该出现在 state 上 —— 方向反了才对。
  it('ignores a stored field that the schema does not know about', async () => {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      categories: [
        {
          id: 'cat-1',
          name: 'Not In Schema Yet',
        },
      ],
    }));

    expect(Object.keys(store.userStats)).not.toContain('categories');
    expect(store.userStats.favorites).toEqual([]);
  });

  // 判别性用例：`in` 走原型链，旧写法会把 `toString` 这类继承键当成合法字段写进去，
  // 等于把 Object.prototype 的成员换成用户数据里的值。
  it('never lets an inherited key overwrite a prototype member', async () => {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      toString: 'polluted',
      constructor: 'polluted',
    }));

    const state = store.userStats as unknown as Record<string, unknown>;

    expect(Object.prototype.hasOwnProperty.call(state, 'toString')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(state, 'constructor')).toBe(false);
    expect(typeof state.toString).toBe('function');
    expect(typeof state.constructor).toBe('function');
  });
});

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

// ── 反馈 4：收藏分类与收藏编辑 ─────────────────────────────────────────

describe('favorite categories (feedback 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storedValues.clear();
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
  });

  // 判别性用例：只断言内存状态（store.favoriteCategories）的用例**抓不到**
  // 这个缺陷。真机验收实测过：分类能建出来、界面下拉里也有，但 user-stats.json
  // 里 favoriteCategories 是 undefined，重启即丢 —— 因为 saveStats 里的 set()
  // 是逐键显式写的，加字段时只改了 DEFAULT_USER_STATS（读白名单）没改写列表。
  // 这里走 mock store 的 entries() 往返，才等于「真的落了盘」。
  it('writes favoriteCategories through to the store on disk', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({ ...DEFAULT_USER_STATS }));

    const created = await store.createFavoriteCategory('Work');

    expect(created).not.toBeNull();
    expect(storedValues.get('favoriteCategories')).toEqual([
      {
        id: created!.id,
        name: 'Work',
        createdAt: created!.createdAt,
      },
    ]);
    expect(lazyStoreSaveMock).toHaveBeenCalled();
  });

  it('keeps favoriteCategories on disk when a favorite is filed under one', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({ ...DEFAULT_USER_STATS }));

    const created = await store.createFavoriteCategory('Work');
    await store.addToFavorites('/work-1', false, created!.id);

    // 改收藏会再次 saveStats()，顺带确认这条路径不会把分类抹掉。
    expect(storedValues.get('favoriteCategories')).toHaveLength(1);
  });

  it('persists a new category and rejects a duplicate name', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({ ...DEFAULT_USER_STATS }));

    const created = await store.createFavoriteCategory('Work');

    expect(created?.name).toBe('Work');
    expect(store.favoriteCategories).toHaveLength(1);
    // 大小写不敏感的重名必须被拒：分类名是用户用来扫视的，Work / work 两份没有意义。
    expect(await store.createFavoriteCategory('work')).toBeNull();
    expect(store.favoriteCategories).toHaveLength(1);
  });

  it('lets a category be renamed back to a name that only conflicts with itself', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({ ...DEFAULT_USER_STATS }));

    const created = await store.createFavoriteCategory('Work');
    await store.renameFavoriteCategory(created!.id, '  Job  ');
    expect(store.favoriteCategories[0].name).toBe('Job');

    // 排除自身后不应与自己冲突
    await store.renameFavoriteCategory(created!.id, 'Job');
    expect(store.favoriteCategories[0].name).toBe('Job');
  });

  // 判别性用例：把「删除分类」写成连带删除收藏（更常见的直觉实现）时，
  // 这里会看到 favorites 变短 —— 那就是静默丢用户数据。
  it('returns the category favorites to uncategorized instead of deleting them', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favoriteCategories: [{
        id: 'cat-1',
        name: 'Work',
        createdAt: 1,
      }],
      favorites: [
        {
          ...createFavorite('/work-1'),
          categoryId: 'cat-1',
        },
        createFavorite('/loose'),
      ],
    }));

    await store.deleteFavoriteCategory('cat-1');

    expect(store.favoriteCategories).toEqual([]);
    expect(store.favorites.map(item => item.path)).toEqual(['/work-1', '/loose']);
    expect(store.favorites[0].categoryId).toBeNull();
  });

  it('moves a favorite to another category', async () => {
    const store = useUserStatsStore();
    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favoriteCategories: [{
        id: 'cat-1',
        name: 'Work',
        createdAt: 1,
      }],
      favorites: [createFavorite('/a')],
    }));

    await store.moveFavoriteToCategory('/a', 'cat-1');
    expect(store.favorites[0].categoryId).toBe('cat-1');

    // 再移一次到同一个分类应当是 no-op，不该白白落盘
    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();
    await store.moveFavoriteToCategory('/a', 'cat-1');
    expect(lazyStoreSetMock).not.toHaveBeenCalled();
  });
});

describe('favorite ordering within a category (feedback 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storedValues.clear();
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
  });

  async function seedTwoCategories() {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      ...DEFAULT_USER_STATS,
      favoriteCategories: [
        {
          id: 'cat-1',
          name: 'Work',
          createdAt: 1,
        },
        {
          id: 'cat-2',
          name: 'Home',
          createdAt: 2,
        },
      ],
      favorites: [
        {
          ...createFavorite('/w1'),
          categoryId: 'cat-1',
        },
        {
          ...createFavorite('/w2'),
          categoryId: 'cat-1',
        },
        {
          ...createFavorite('/h1'),
          categoryId: 'cat-2',
        },
      ],
    }));

    lazyStoreSetMock.mockClear();
    lazyStoreSaveMock.mockClear();
    return store;
  }

  it('swaps a favorite with the previous one in the same category only', async () => {
    const store = await seedTwoCategories();

    await store.moveFavoriteWithinCategory('/w2', -1);

    // 分类内的顺序变了，分类外的那条必须原地不动
    expect(store.favorites.map(item => item.path)).toEqual(['/w2', '/w1', '/h1']);
  });

  it('refuses to move past either end of its own category', async () => {
    const store = await seedTwoCategories();

    await store.moveFavoriteWithinCategory('/w1', -1);
    await store.moveFavoriteWithinCategory('/w2', 1);

    expect(store.favorites.map(item => item.path)).toEqual(['/w1', '/w2', '/h1']);
    expect(lazyStoreSetMock).not.toHaveBeenCalled();
  });

  // 判别性用例：若实现用的是「在 favorites 数组里找相邻元素整体换位」，
  // 分类 2 的 /h1 会跟着被拖动 —— 上面的顺序断言正是防这个。
  it('never lets a move drag an item from another category along', async () => {
    const store = await seedTwoCategories();

    await store.moveFavoriteWithinCategory('/w1', 1);

    expect(store.favorites.map(item => item.categoryId)).toEqual(['cat-1', 'cat-1', 'cat-2']);
  });
});

describe('legacy favorite normalization (feedback 4)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    storedValues.clear();
    lazyStoreSaveMock.mockReset();
    lazyStoreSetMock.mockReset();
  });

  // 老记录没有 isFile / categoryId。归一化必须在**读入**处完成，
  // 否则每个读取点都要自己判 undefined，那个「含点就是文件」的误判会被复制到多处。
  it('fills isFile and categoryId for records written before feedback 4', async () => {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      favorites: [
        {
          path: '/notes.md',
          addedAt: 1,
        },
        {
          path: '/my.folder',
          addedAt: 2,
        },
        {
          path: '/dir/',
          addedAt: 3,
        },
      ],
    } as unknown as Record<string, unknown>));

    expect(store.favorites.map(item => item.isFile)).toEqual([true, true, false]);
    expect(store.favorites.every(item => item.categoryId === null)).toBe(true);
  });

  it('keeps an explicit isFile instead of re-deriving it from the path', async () => {
    const store = useUserStatsStore();

    await store.init(createStatsBootstrap({
      favorites: [{
        path: '/my.folder',
        addedAt: 1,
        isFile: false,
        categoryId: 'cat-x',
      }],
    }));

    expect(store.favorites[0].isFile).toBe(false);
    expect(store.favorites[0].categoryId).toBe('cat-x');
  });
});
