// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import { classifyRenameConflict, getRenameConflictError } from '@/utils/rename-conflict';
import * as pathComparisonCache from '@/utils/path-comparison-volume-cache';

describe('classifyRenameConflict', () => {
  it('allows a case-only change of the source when folding', () => {
    expect(classifyRenameConflict(['file.txt', 'other.txt'], 'file.txt', 'File.txt', true)).toBe('case-only-source');
  });

  it('rejects another entry that matches when case is folded', () => {
    expect(classifyRenameConflict(['file.txt', 'Other.txt'], 'file.txt', 'other.txt', true)).toBe('other-entry');
  });

  it('keeps a different-case entry as a conflict when folding is off', () => {
    expect(classifyRenameConflict(['file.txt', 'File.txt'], 'file.txt', 'File.txt', false)).toBe('other-entry');
  });

  it('allows a case-only target when folding is off and no exact entry exists', () => {
    expect(classifyRenameConflict(['file.txt'], 'file.txt', 'File.txt', false)).toBe('none');
  });

  it('does not treat the exact same name as a case-only change', () => {
    expect(classifyRenameConflict(['file.txt'], 'file.txt', 'file.txt', true)).toBe('none');
  });
});

describe('getRenameConflictError', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for a case-only rename of the source', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(getRenameConflictError(['file.txt'], 'file.txt', 'File.txt', 'C:/Notes')).toBeNull();
  });

  it('returns the existing-name error for another entry', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(getRenameConflictError(['file.txt', 'Other.txt'], 'file.txt', 'other.txt', 'C:/Notes')).toBe(
      'A file or folder with the name \'other.txt\' already exists',
    );
  });

  it('returns null when the directory listing does not show a conflicting name', () => {
    vi.spyOn(pathComparisonCache, 'shouldFoldPathCaseForComparison').mockReturnValue(true);

    expect(getRenameConflictError([], 'file.txt', 'Other.txt', 'C:/Notes')).toBeNull();
  });
});
