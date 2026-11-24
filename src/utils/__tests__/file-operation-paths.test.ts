// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import {
  arePathsEquivalent,
  createMovedPathResolver,
  isDestinationInsideAnySourceDirectory,
  normalizePathForComparison,
  remapDirEntry,
  replacePathPrefix,
} from '@/utils/file-operation-paths';
import * as pathComparisonCache from '@/utils/path-comparison-volume-cache';

function createEntry(path: string, name: string): DirEntry {
  return {
    name,
    ext: null,
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
  };
}

describe('file-operation-paths', () => {
  describe('createMovedPathResolver', () => {
    it('resolves moved items, their children, and prefers the closest moved ancestor', () => {
      const resolveMovedPath = createMovedPathResolver([
        {
          from: '/home/Docs',
          to: '/mnt/Docs',
        },
        {
          from: '/home/Docs/notes.txt',
          to: '/mnt/Docs/notes (1).txt',
        },
      ]);

      expect(resolveMovedPath('/home/Docs')).toBe('/mnt/Docs');
      expect(resolveMovedPath('/home/Docs/sub/a.txt')).toBe('/mnt/Docs/sub/a.txt');
      expect(resolveMovedPath('/home/Docs/notes.txt')).toBe('/mnt/Docs/notes (1).txt');
      expect(resolveMovedPath('/home/Docs2/a.txt')).toBeNull();
      expect(resolveMovedPath('/')).toBeNull();
    });
  });

  describe('normalizePathForComparison', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('lowercases when folding is enabled for the path', () => {
      vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);
      expect(normalizePathForComparison('C:/Data/Test')).toBe('c:/data/test');
    });

    it('preserves case when folding is disabled for the path', () => {
      vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);
      expect(normalizePathForComparison('/tmp/Foo')).toBe('/tmp/Foo');
    });

    it('preserves the unix filesystem root instead of collapsing to empty', () => {
      vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);
      expect(normalizePathForComparison('/')).toBe('/');
      expect(normalizePathForComparison('///')).toBe('/');
      expect(arePathsEquivalent('/', '')).toBe(false);
    });
  });

  describe('arePathsEquivalent', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('treats paths as equivalent when folding collapses case', () => {
      vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);
      expect(arePathsEquivalent('C:/A', 'c:/a')).toBe(true);
    });

    it('does not treat distinct case paths as equivalent when folding is off', () => {
      vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);
      expect(arePathsEquivalent('/tmp/Foo', '/tmp/foo')).toBe(false);
    });
  });
});

describe('isDestinationInsideAnySourceDirectory', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('treats a directory as inside itself', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(isDestinationInsideAnySourceDirectory(
      'C:/Users/aleks/test/mapped-drive',
      ['C:/Users/aleks/test/mapped-drive'],
      [true],
    )).toBe(true);
  });

  it('does not block copying a directory to its parent directory', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(isDestinationInsideAnySourceDirectory(
      'C:/Users/aleks/test',
      ['C:/Users/aleks/test/mapped-drive'],
      [true],
    )).toBe(false);
  });

  it('ignores file sources when checking nested destinations', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(isDestinationInsideAnySourceDirectory(
      'C:/Users/aleks/test/file.txt',
      ['C:/Users/aleks/test/file.txt'],
      [false],
    )).toBe(false);
  });

  it('treats child paths as nested under the unix filesystem root', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);

    expect(isDestinationInsideAnySourceDirectory(
      '/home',
      ['/'],
      [true],
    )).toBe(true);

    expect(isDestinationInsideAnySourceDirectory(
      '/',
      ['/'],
      [true],
    )).toBe(true);
  });
});

describe('replacePathPrefix', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the original suffix when a folded prefix changes case', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(replacePathPrefix('C:/Notes/file.txt', 'C:/notes', 'C:/Notes')).toBe('C:/Notes/file.txt');
  });

  it('returns the new path when the stored path matches exactly and folding is off', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);

    expect(replacePathPrefix('/tmp/draft.txt', '/tmp/draft.txt', '/tmp/Draft.txt')).toBe('/tmp/Draft.txt');
  });

  it('leaves a different-case path unchanged when folding is off', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);

    expect(replacePathPrefix('/tmp/Draft.txt', '/tmp/draft.txt', '/tmp/Notes.txt')).toBeNull();
  });

  it('does not treat foo as a prefix of foobar', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(replacePathPrefix('C:/foobar', 'C:/foo', 'C:/baz')).toBeNull();
    expect(replacePathPrefix('C:/foo/bar', 'C:/foo', 'C:/baz')).toBe('C:/baz/bar');
  });

  it('does not slice a prefix whose case fold changes length', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(replacePathPrefix('C:/\u0130/file.txt', 'C:/i\u0307', 'C:/Notes')).toBeNull();
  });
});

describe('remapDirEntry', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('updates the renamed entry name and only the path of a child', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);
    const file = createEntry('C:/Notes/file.txt', 'file.txt');
    const child = createEntry('C:/Notes/folder/child.txt', 'child.txt');

    expect(remapDirEntry(file, 'C:/Notes/file.txt', 'C:/Notes/File.txt')).toMatchObject({
      name: 'File.txt',
      path: 'C:/Notes/File.txt',
    });
    expect(remapDirEntry(child, 'C:/Notes', 'C:/notes')).toMatchObject({
      name: 'child.txt',
      path: 'C:/notes/folder/child.txt',
    });
  });

  it('returns the same entry when a second case-insensitive remap does not change it', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);
    const file = createEntry('C:/Notes/file.txt', 'file.txt');
    const renamed = remapDirEntry(file, 'C:/Notes/file.txt', 'C:/Notes/File.txt');

    expect(remapDirEntry(renamed, 'C:/Notes/file.txt', 'C:/Notes/File.txt')).toBe(renamed);
  });

  it('returns the same entry when the path is outside the rename', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(false);
    const file = createEntry('/tmp/other.txt', 'other.txt');

    expect(remapDirEntry(file, '/tmp/draft.txt', '/tmp/Draft.txt')).toBe(file);
  });
});

describe('path-comparison-volume-cache keys', () => {
  it('uses drive prefix for Windows-style paths', () => {
    expect(pathComparisonCache.getVolumeCacheKeyForNormalizedPath('d:/Projects/a')).toBe('D:/');
  });

  it('uses /Volumes mount segment when present', () => {
    expect(pathComparisonCache.getVolumeCacheKeyForNormalizedPath('/Volumes/MyDisk/x')).toBe(
      '/Volumes/MyDisk',
    );
  });

  it('uses filesystem root for other absolute unix paths', () => {
    expect(pathComparisonCache.getVolumeCacheKeyForNormalizedPath('/home/user')).toBe('/');
  });
});
