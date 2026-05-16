// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  describe, it, expect, vi, afterEach,
} from 'vitest';
import {
  arePathsEquivalent,
  normalizePathForComparison,
} from '@/utils/file-operation-paths';
import * as pathComparisonCache from '@/utils/path-comparison-volume-cache';

describe('file-operation-paths', () => {
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
