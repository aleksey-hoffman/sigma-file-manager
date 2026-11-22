// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { filterNavigatorView } from '@/utils/view-filter';
import type { DirEntry } from '@/types/dir-entry';
import type { ViewFilterProperty } from '@/types/view-filter';

function createEntry(path: string, overrides: Partial<DirEntry> = {}): DirEntry {
  const name = path.split('/').pop() ?? path;
  const extIndex = name.lastIndexOf('.');

  return {
    name,
    ext: extIndex > 0 ? name.slice(extIndex + 1) : null,
    path,
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

const properties: ViewFilterProperty[] = [
  {
    name: 'name',
    title: 'name',
    prefix: 'name',
    itemPropertyPath: 'name',
  },
  {
    name: 'path',
    title: 'path',
    prefix: 'path',
    itemPropertyPath: 'path',
  },
];

const items = [
  createEntry('/home/user/report.pdf'),
  createEntry('/home/user/photo.JPG'),
  createEntry('/home/user/docs/notes.txt'),
  createEntry('/home/user/docs/deep/archive.tar.gz'),
  createEntry('/home/user/Folder', {
    is_file: false,
    is_dir: true,
  }),
  createEntry('/home/user/.hidden.txt', { is_hidden: true }),
  createEntry('C:/Users/user/Desktop/todo.txt'),
];

function filterNames(query: string, options: {
  glob?: boolean;
  showHiddenItems?: boolean;
} = {}) {
  return filterNavigatorView({
    query,
    items,
    properties,
    showHiddenItems: options.showHiddenItems ?? false,
    options: { glob: options.glob ?? true },
  }).map(item => item.name);
}

describe('filterNavigatorView', () => {
  it('returns every item for an empty query', () => {
    expect(filterNavigatorView({
      query: '',
      items,
      properties,
      showHiddenItems: false,
      options: { glob: true },
    })).toEqual(items);
  });

  it('matches by substring when glob is off', () => {
    expect(filterNames('NOTES', { glob: false })).toEqual(['notes.txt']);
    expect(filterNames('name:.txt', { glob: false })).toEqual(['notes.txt', 'todo.txt']);
  });

  it('skips hidden items unless they are shown', () => {
    expect(filterNames('name:hidden', { glob: false })).toEqual([]);
    expect(filterNames('name:hidden', {
      glob: false,
      showHiddenItems: true,
    })).toEqual(['.hidden.txt']);
  });

  it('treats a lone or doubled star as match all', () => {
    const visibleNames = items.filter(item => !item.is_hidden).map(item => item.name);
    expect(filterNames('*')).toEqual(visibleNames);
    expect(filterNames('**')).toEqual(visibleNames);
  });

  it('matches quoted names with wildcards, character classes and braces', () => {
    expect(filterNames('name:"*.pdf"')).toEqual(['report.pdf']);
    expect(filterNames('name:"photo.???"')).toEqual(['photo.JPG']);
    expect(filterNames('name:"*.{txt,pdf}"')).toEqual(['report.pdf', 'notes.txt', 'todo.txt']);
    expect(filterNames('name:"[a-n]*"')).toEqual(['notes.txt', 'archive.tar.gz', 'Folder']);
    expect(filterNames('name:"*.gz"')).toEqual(['archive.tar.gz']);
  });

  it('does not match unquoted glob patterns against the stored value', () => {
    expect(filterNames('name:report.pdf')).toEqual([]);
  });

  it('keeps single stars inside one path segment and lets globstar cross folders', () => {
    expect(filterNames('path:"/home/user/*.txt"')).toEqual([]);
    expect(filterNames('path:"/home/user/*/*.txt"')).toEqual(['notes.txt']);
    expect(filterNames('path:"/home/user/**/*.txt"')).toEqual(['notes.txt']);
    expect(filterNames('path:"/home/**/*.gz"')).toEqual(['archive.tar.gz']);
    expect(filterNames('path:"*/users/*/desktop/*.txt"')).toEqual(['todo.txt']);
  });

  it('supports negated patterns', () => {
    expect(filterNames('name:!"*.txt"')).toEqual(['report.pdf', 'photo.JPG', 'archive.tar.gz', 'Folder']);
  });

  it('ignores queries with more than one prefix separator', () => {
    expect(filterNames('path:"c:/users/*/desktop/*.txt"')).toEqual(items.map(item => item.name));
  });

  it('finishes quickly on brace-heavy patterns', () => {
    const startedAt = performance.now();
    filterNames(`name:${'{a,b}'.repeat(12)}`);
    expect(performance.now() - startedAt).toBeLessThan(2000);
  });
});
