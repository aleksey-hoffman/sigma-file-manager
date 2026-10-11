// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 只测纯函数，不测 invoke。
//
// 规则求值、冲突检测全在 Rust 侧，前端这里只有「参数搬运」。
// 真正容易出错的就是搬运本身：时区符号、目录名切分、字段名对应。

import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  getDirectoryName,
  getUtcOffsetMinutes,
  toBatchRenameRuleEntries,
} from '@/composables/use-batch-rename';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getUtcOffsetMinutes', () => {
  // 这一条守的是符号方向，不是数值。
  // Rust 侧要的是「本地时间减 UTC」，而 JS 的 getTimezoneOffset 返回的是反的。
  // 符号写反不会报错，只会让 {date} 在东八区整整差一天 —— 肉眼很难发现。
  it('inverts the sign of getTimezoneOffset', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-480);
    expect(getUtcOffsetMinutes()).toBe(480);

    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(330);
    expect(getUtcOffsetMinutes()).toBe(-330);
  });

  it('is zero for a UTC-only host', () => {
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(0);
    expect(getUtcOffsetMinutes()).toBe(0);
  });
});

describe('getDirectoryName', () => {
  it('handles Windows, POSIX and trailing separators', () => {
    expect(getDirectoryName('D:\\docs\\photos')).toBe('photos');
    expect(getDirectoryName('D:\\docs\\photos\\')).toBe('photos');
    expect(getDirectoryName('/home/user/docs')).toBe('docs');
    expect(getDirectoryName('\\\\server\\share\\docs')).toBe('docs');
  });

  it('returns an empty string when there is no directory segment', () => {
    expect(getDirectoryName('')).toBe('');
    expect(getDirectoryName('C:\\')).toBe('C:');
  });
});

describe('toBatchRenameRuleEntries', () => {
  const directory = 'D:\\docs\\photos';

  function createFileEntry(name: string, size: number, modifiedTime: number): DirEntry {
    return {
      name,
      path: `${directory}\\${name}`,
      is_file: true,
      is_dir: false,
      is_hidden: false,
      is_symlink: false,
      size,
      item_count: null,
      created_time: 0,
      modified_time: modifiedTime,
      accessed_time: 0,
      ext: null,
      mime: null,
    };
  }

  it('maps the field names the Rust side expects', () => {
    const entries = toBatchRenameRuleEntries(
      [createFileEntry('a.txt', 1024, 1_700_000_000_000)],
      directory,
    );

    // Rust 的 RuleEntry 是 camelCase 的 sizeBytes / modifiedMs，
    // 这里写错成 snake_case 的话，serde 会静默填默认值 0 ——
    // 表现为「{size} 和 {date} 永远是空的」，而不是报错。
    expect(entries[0]).toEqual({
      name: 'a.txt',
      parent: 'photos',
      sizeBytes: 1024,
      modifiedMs: 1_700_000_000_000,
    });
  });

  it('passes modified_time through as milliseconds without rescaling', () => {
    // dir_reader 的 metadata_times_unix_ms 产出的是毫秒。
    // 这里若再乘 1000，{date} 会落到几万年后。
    const entries = toBatchRenameRuleEntries(
      [createFileEntry('a.txt', 0, 1_700_000_000_000)],
      directory,
    );

    expect(entries[0].modifiedMs).toBe(1_700_000_000_000);
  });

  it('coerces missing size and timestamp fields to zero', () => {
    const entry = {
      ...createFileEntry('a.txt', 5, 10),
      size: undefined as unknown as number,
      modified_time: undefined as unknown as number,
    };

    const entries = toBatchRenameRuleEntries([entry], directory);

    expect(entries[0].sizeBytes).toBe(0);
    expect(entries[0].modifiedMs).toBe(0);
  });
});
