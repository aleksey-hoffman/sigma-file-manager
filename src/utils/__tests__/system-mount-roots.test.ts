// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  isUnderUnixSystemMount,
  isWindowsLocationsMountRoot,
  isWindowsLocationsScopePath,
} from '@/utils/system-mount-roots';

describe('system-mount-roots', () => {
  describe('isWindowsLocationsMountRoot', () => {
    it('detects drive and wsl mount roots', () => {
      expect(isWindowsLocationsMountRoot('C:/')).toBe(true);
      expect(isWindowsLocationsMountRoot('//wsl.localhost/Ubuntu-24.04/')).toBe(true);
      expect(isWindowsLocationsMountRoot('//wsl.localhost')).toBe(true);
    });

    it('does not flag nested paths', () => {
      expect(isWindowsLocationsMountRoot('C:/Users')).toBe(false);
      expect(isWindowsLocationsMountRoot('//wsl.localhost/Ubuntu/home')).toBe(false);
      expect(isWindowsLocationsMountRoot('//server/share')).toBe(false);
    });
  });

  describe('isWindowsLocationsScopePath', () => {
    it('covers drive paths and wsl paths for breadcrumbs', () => {
      expect(isWindowsLocationsScopePath('C:/Users')).toBe(true);
      expect(isWindowsLocationsScopePath('//wsl.localhost/Ubuntu/home')).toBe(true);
      expect(isWindowsLocationsScopePath('//server/share/docs')).toBe(false);
    });
  });

  describe('isUnderUnixSystemMount', () => {
    it('covers paths under unix mount prefixes', () => {
      expect(isUnderUnixSystemMount('/Volumes/MyDisk/Documents')).toBe(true);
      expect(isUnderUnixSystemMount('/home/user')).toBe(false);
    });
  });
});
