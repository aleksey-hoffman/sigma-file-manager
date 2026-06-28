// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { isProtectedSystemPath } from '@/utils/is-protected-system-path';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';

describe('isProtectedSystemPath', () => {
  it('protects the virtual locations path on every platform', () => {
    expect(isProtectedSystemPath(LOCATIONS_VIRTUAL_PATH, 'windows')).toBe(true);
    expect(isProtectedSystemPath(LOCATIONS_VIRTUAL_PATH, 'linux')).toBe(true);
    expect(isProtectedSystemPath(LOCATIONS_VIRTUAL_PATH, null)).toBe(true);
  });

  it('returns false for empty paths', () => {
    expect(isProtectedSystemPath('', 'windows')).toBe(false);
  });

  describe('windows', () => {
    it('protects drive roots', () => {
      expect(isProtectedSystemPath('C:/', 'windows')).toBe(true);
      expect(isProtectedSystemPath('D:', 'windows')).toBe(true);
      expect(isProtectedSystemPath('C:/Users', 'windows')).toBe(false);
    });

    it('protects wsl distribution and host roots', () => {
      expect(isProtectedSystemPath('//wsl.localhost/Ubuntu-24.04/', 'windows')).toBe(true);
      expect(isProtectedSystemPath('//wsl.localhost/docker-desktop', 'windows')).toBe(true);
      expect(isProtectedSystemPath('//wsl.localhost', 'windows')).toBe(true);
      expect(isProtectedSystemPath('//wsl$/Ubuntu-24.04', 'windows')).toBe(true);
      expect(isProtectedSystemPath('//wsl.localhost/Ubuntu-24.04/home', 'windows')).toBe(false);
    });

    it('does not protect arbitrary unc share roots', () => {
      expect(isProtectedSystemPath('//server/share', 'windows')).toBe(false);
    });
  });

  describe('unix', () => {
    it('protects filesystem root', () => {
      expect(isProtectedSystemPath('/', 'linux')).toBe(true);
    });

    it('protects mount roots with platform-specific depth rules', () => {
      expect(isProtectedSystemPath('/Volumes/MyDisk', 'macos')).toBe(true);
      expect(isProtectedSystemPath('/Volumes/MyDisk/Documents', 'macos')).toBe(false);
      expect(isProtectedSystemPath('/media/user/disk', 'linux')).toBe(true);
      expect(isProtectedSystemPath('/media/user/disk/projects', 'linux')).toBe(false);
    });

    it('does not protect regular home paths', () => {
      expect(isProtectedSystemPath('/home/user', 'linux')).toBe(false);
    });
  });
});
