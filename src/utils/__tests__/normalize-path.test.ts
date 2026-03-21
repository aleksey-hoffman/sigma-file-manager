// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import normalizePath, {
  getParentPath,
  getPathLeafName,
  getPathSegments,
  isUncPath,
} from '@/utils/normalize-path';

describe('normalizePath', () => {
  it('normalizes Windows separators', () => {
    expect(normalizePath('C:\\Users\\aleks\\Documents')).toBe('C:/Users/aleks/Documents');
  });

  it('detects UNC paths', () => {
    expect(isUncPath('\\\\wsl.localhost\\Ubuntu')).toBe(true);
    expect(isUncPath('C:/Users/aleks')).toBe(false);
  });

  it('extracts path segments from UNC paths', () => {
    expect(getPathSegments('//wsl.localhost/Ubuntu/home')).toEqual([
      'wsl.localhost',
      'Ubuntu',
      'home',
    ]);
  });

  it('returns the leaf name for UNC roots and child paths', () => {
    expect(getPathLeafName('//wsl.localhost')).toBe('wsl.localhost');
    expect(getPathLeafName('//wsl.localhost/Ubuntu')).toBe('Ubuntu');
  });

  it('returns parents for UNC paths without dropping the UNC prefix', () => {
    expect(getParentPath('//wsl.localhost')).toBeNull();
    expect(getParentPath('//wsl.localhost/Ubuntu')).toBe('//wsl.localhost');
    expect(getParentPath('//wsl.localhost/Ubuntu/home')).toBe('//wsl.localhost/Ubuntu');
  });

  it('returns parents for local Windows paths', () => {
    expect(getParentPath('C:/Users/aleks/Documents')).toBe('C:/Users/aleks');
    expect(getParentPath('C:/Users')).toBe('C:/');
  });
});
