// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { sortFileBrowserEntries } from '../file-browser-sort';

function createEntry(overrides: Partial<DirEntry>): DirEntry {
  return {
    name: 'item',
    ext: null,
    path: `/items/${overrides.name ?? 'item'}`,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: true,
    is_dir: false,
    is_symlink: false,
    is_hidden: false,
    ...overrides,
  };
}

describe('sortFileBrowserEntries', () => {
  it('keeps directories in existing order for size sort', () => {
    const entries = [
      createEntry({
        name: 'small-folder',
        path: '/small-folder',
        is_file: false,
        is_dir: true,
      }),
      createEntry({
        name: 'large-folder',
        path: '/large-folder',
        is_file: false,
        is_dir: true,
      }),
    ];
    const sorted = sortFileBrowserEntries(entries, 'size', 'desc', true);

    expect(sorted.map(entry => entry.name)).toEqual(['small-folder', 'large-folder']);
  });

  it('sorts tags by normalized tag name lists', () => {
    const entries = [
      createEntry({
        path: '/zeta',
        name: 'zeta.txt',
      }),
      createEntry({
        path: '/untagged-b',
        name: 'untagged-b.txt',
      }),
      createEntry({
        path: '/untagged-a',
        name: 'untagged-a.txt',
      }),
      createEntry({
        path: '/alpha-beta',
        name: 'alpha-beta.txt',
      }),
      createEntry({
        path: '/alpha',
        name: 'alpha.txt',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'tags', 'asc', true, {
      tags: [
        {
          id: 'beta',
          name: 'Beta',
          color: '#3b82f6',
        },
        {
          id: 'alpha',
          name: 'Alpha',
          color: '#ef4444',
        },
        {
          id: 'zeta',
          name: 'Zeta',
          color: '#22c55e',
        },
      ],
      taggedItems: [
        {
          path: '/alpha-beta',
          tagIds: ['beta', 'alpha'],
          addedAt: 0,
          isFile: true,
        },
        {
          path: '/zeta',
          tagIds: ['zeta'],
          addedAt: 0,
          isFile: true,
        },
        {
          path: '/alpha',
          tagIds: ['alpha'],
          addedAt: 0,
          isFile: true,
        },
      ],
    });

    expect(sorted.map(entry => entry.path)).toEqual([
      '/untagged-a',
      '/untagged-b',
      '/alpha',
      '/alpha-beta',
      '/zeta',
    ]);
  });

  it('sorts files by kind', () => {
    const entries = [
      createEntry({
        name: 'shortcut',
        link_type: 'shortcut',
      }),
      createEntry({
        name: 'normal',
      }),
      createEntry({
        name: 'hardlink',
        link_type: 'hardlink',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'kind', 'asc', true);

    expect(sorted.map(entry => entry.name)).toEqual(['normal', 'hardlink', 'shortcut']);
  });

  it('sorts files by hard link count', () => {
    const entries = [
      createEntry({
        name: 'two',
        hard_link_count: 2,
      }),
      createEntry({
        name: 'one',
        hard_link_count: 1,
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc', true);

    expect(sorted.map(entry => entry.name)).toEqual(['one', 'two']);
  });

  it('sorts link columns from metadata context without mutating entries', () => {
    const entries = [
      createEntry({
        name: 'two',
      }),
      createEntry({
        name: 'one',
      }),
    ];
    const hardLinkCountsByName = new Map([
      ['two', 2],
      ['one', 1],
    ]);

    const sorted = sortFileBrowserEntries(entries, 'links', 'asc', true, {
      tags: [],
      taggedItems: [],
      getLinkSortFields: entry => ({
        link_type: null,
        link_status: null,
        hard_link_count: hardLinkCountsByName.get(entry.name) ?? null,
      }),
    });

    expect(sorted.map(entry => entry.name)).toEqual(['one', 'two']);
    expect(entries.every(entry => entry.hard_link_count === undefined)).toBe(true);
  });

  it('sorts files by link status', () => {
    const entries = [
      createEntry({
        name: 'valid',
        link_type: 'symlink',
        link_status: 'valid',
      }),
      createEntry({
        name: 'broken',
        link_type: 'symlink',
        link_status: 'broken',
      }),
    ];

    const sorted = sortFileBrowserEntries(entries, 'linkStatus', 'asc', true);

    expect(sorted.map(entry => entry.name)).toEqual(['broken', 'valid']);
  });
});

describe('sortFileBrowserEntries foldersFirst', () => {
  function mkEntry(name: string, isDir: boolean): DirEntry {
    return {
      name,
      is_dir: isDir,
      path: `C:/d/${name}`,
    } as DirEntry;
  }

  function mkTimedEntry(name: string, isDir: boolean, modifiedTime: number): DirEntry {
    return {
      name,
      is_dir: isDir,
      modified_time: modifiedTime,
      path: `C:/d/${name}`,
    } as DirEntry;
  }

  it('places folders before files when foldersFirst is true', () => {
    // 夹具里的文件夹名（m_folder）刻意排在文件名之后：若夹具用 a_folder，
    // 「文件夹置顶」与「纯按名称排序」结果相同，这条用例就成了恒真断言，
    // 把置顶逻辑整个删掉也照样绿。
    const entries = [
      mkEntry('a.txt', false),
      mkEntry('m_folder', true),
      mkEntry('z.txt', false),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', true);
    expect(sorted.map(e => e.name)).toEqual(['m_folder', 'a.txt', 'z.txt']);
  });

  it('interleaves folders and files by the sort column when foldersFirst is false', () => {
    const entries = [
      mkEntry('b_folder', true),
      mkEntry('a.txt', false),
      mkEntry('a_folder', true),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', false);
    // 期望值说明：名称列用的是 Intl.Collator(undefined, { numeric: true })，
    // 主序比较下 'a_folder' 与 'a.txt' 比的是 "afolder" 与 "atxt"，所以
    // a_folder 排在 a.txt 前面。夹带的判别点是 b_folder 落在末尾（索引 2）——
    // 若文件夹被整体提前，结果会是 ['a_folder', 'b_folder', 'a.txt']。
    expect(sorted.map(e => e.name)).toEqual(['a_folder', 'a.txt', 'b_folder']);
  });

  it('leaves a later-sorting folder interleaved when foldersFirst is false', () => {
    const entries = [
      mkEntry('a.txt', false),
      mkEntry('b_folder', true),
      mkEntry('c.txt', false),
    ];
    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', false);
    expect(sorted.map(e => e.name)).toEqual(['a.txt', 'b_folder', 'c.txt']);
  });

  // 下面两条覆盖上游 #529/#481/#482 的真实动机：按「修改时间」排序时，
  // 文件夹置顶会遮挡最近修改的文件（目录的 mtime 常常比文件新）。
  // 夹具刻意让两个目录的 mtime 分别夹在两个文件之间。
  it('interleaves folders by modified time when foldersFirst is false', () => {
    const entries = [
      mkTimedEntry('a.txt', false, 400),
      mkTimedEntry('docs', true, 300),
      mkTimedEntry('b.txt', false, 200),
      mkTimedEntry('photos', true, 100),
    ];
    const sorted = sortFileBrowserEntries(entries, 'modified', 'desc', false);
    expect(sorted.map(e => e.name)).toEqual(['a.txt', 'docs', 'b.txt', 'photos']);
  });

  it('matches pre-change folders-first behavior on the modified column when foldersFirst is true', () => {
    const entries = [
      mkTimedEntry('a.txt', false, 400),
      mkTimedEntry('docs', true, 300),
      mkTimedEntry('b.txt', false, 200),
      mkTimedEntry('photos', true, 100),
    ];

    // 独立实现「改动前」的排序作为参照物：先按时间降序，再把文件夹整体提到
    // 最前（同组内保持时间序）。Array.prototype.sort 自 ES2019 起稳定，
    // 两次排序等价于「时间降序 + 按 is_dir 分区」。
    // 断言等于这个参照物，就把「true 时行为与改动前逐字节一致」钉成了
    // 可执行断言，而不是只靠论证。
    const preChangeOrder = [...entries]
      .sort((entryA, entryB) => entryB.modified_time - entryA.modified_time)
      .sort((entryA, entryB) => Number(entryB.is_dir) - Number(entryA.is_dir));

    const sorted = sortFileBrowserEntries(entries, 'modified', 'desc', true);

    expect(sorted.map(e => e.name)).toEqual(['docs', 'photos', 'a.txt', 'b.txt']);
    expect(sorted.map(e => e.name)).toEqual(preChangeOrder.map(e => e.name));
  });
});

// FORK-MODIFICATION: 验收反馈 2026-10-13 — locations 视图按盘符序号排序。
// 用户原话:"请默认采用磁盘序号排序,即 C → D →E → F → ……这种排序方式"。
// 判别点是"按显示名排会得到完全不同的顺序":显示名里 'photos (G:)' 的 p 排在
// 'Win (C:)' 的 W 之前(Intl.Collator 大小写不敏感),所以按名排会得到 G 在最前。
describe('sortFileBrowserEntries — locations drive letter order', () => {
  function mkDriveEntry(name: string, path: string, driveLetterIndex: number): DirEntry {
    return {
      name,
      path,
      is_file: false,
      is_dir: true,
      size: 100,
      item_count: null,
      created_time: 0,
      modified_time: 0,
      accessed_time: 0,
      ext: null,
      mime: null,
      is_hidden: false,
      is_symlink: false,
      drive_metadata: {
        drive_type: 'HDD',
        is_removable: false,
        is_mounted: true,
        mount_point: path,
        device_path: `\\\\.\\${path[0]}:`,
        available_space: 50,
        drive_letter_index: driveLetterIndex,
      },
    } as unknown as DirEntry;
  }

  it('orders drives by letter (C → D → E → F → G), not by display name', () => {
    // 故意让显示名顺序与盘符顺序相反:'photos' (p) < 'Win' (W) < '数据'(Z)。
    const entries = [
      mkDriveEntry('photos (G:)', 'G:/', 7),
      mkDriveEntry('Win (C:)', 'C:/', 3),
      mkDriveEntry('数据 (F:)', 'F:/', 6),
      mkDriveEntry('Office (E:)', 'E:/', 5),
      mkDriveEntry('Program (D:)', 'D:/', 4),
    ];

    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', true);

    expect(sorted.map(e => e.name)).toEqual([
      'Win (C:)',
      'Program (D:)',
      'Office (E:)',
      '数据 (F:)',
      'photos (G:)',
    ]);
  });

  it('keeps non-letter entries (WSL / UNC) after lettered drives', () => {
    const entries = [
      mkDriveEntry('//wsl.localhost/Ubuntu', '//wsl.localhost/Ubuntu', 0),
      mkDriveEntry('Win (C:)', 'C:/', 3),
      mkDriveEntry('Data (D:)', 'D:/', 4),
    ];

    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', true);

    expect(sorted.map(e => e.name)).toEqual([
      'Win (C:)',
      'Data (D:)',
      '//wsl.localhost/Ubuntu',
    ]);
  });

  it('reverses letter order when direction is desc', () => {
    const entries = [
      mkDriveEntry('Win (C:)', 'C:/', 3),
      mkDriveEntry('Program (D:)', 'D:/', 4),
      mkDriveEntry('Office (E:)', 'E:/', 5),
    ];

    const sorted = sortFileBrowserEntries(entries, 'name', 'desc', true);

    expect(sorted.map(e => e.name)).toEqual(['Office (E:)', 'Program (D:)', 'Win (C:)']);
  });

  it('does not apply letter order when entries are not drives', () => {
    // 判别性反例:没有 drive_metadata 的普通目录必须仍按显示名排。
    const entries = [
      { name: 'zzz', path: '/zzz', is_dir: true } as unknown as DirEntry,
      { name: 'aaa', path: '/aaa', is_dir: true } as unknown as DirEntry,
    ];

    const sorted = sortFileBrowserEntries(entries, 'name', 'asc', true);

    expect(sorted.map(e => e.name)).toEqual(['aaa', 'zzz']);
  });
});
