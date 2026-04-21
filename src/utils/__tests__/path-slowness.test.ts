// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  FAST_PATH_READ_TIMEOUT_MS,
  SLOW_PATH_READ_TIMEOUT_MS,
  getPathReadTimeoutMs,
  isLikelySlowPath,
  isUncNetworkPath,
  isWslPath,
} from '@/utils/path-slowness';

describe('path-slowness', () => {
  describe('isWslPath', () => {
    it('detects normalized wsl.localhost paths', () => {
      expect(isWslPath('//wsl.localhost/Ubuntu-24.04')).toBe(true);
      expect(isWslPath('//wsl.localhost/docker-desktop/var/lib')).toBe(true);
    });

    it('detects backslash-form wsl paths regardless of case', () => {
      expect(isWslPath('\\\\WSL.LOCALHOST\\Ubuntu-24.04')).toBe(true);
      expect(isWslPath('\\\\wsl$\\Ubuntu')).toBe(true);
    });

    it('returns false for non-wsl paths', () => {
      expect(isWslPath('C:/Users/aleks')).toBe(false);
      expect(isWslPath('//some-server/share')).toBe(false);
      expect(isWslPath('/home/aleks')).toBe(false);
    });
  });

  describe('isUncNetworkPath', () => {
    it('detects generic UNC network paths', () => {
      expect(isUncNetworkPath('//file-server/shared')).toBe(true);
      expect(isUncNetworkPath('\\\\nas01\\backup')).toBe(true);
    });

    it('does not classify wsl paths as plain UNC paths', () => {
      expect(isUncNetworkPath('//wsl.localhost/Ubuntu')).toBe(false);
      expect(isUncNetworkPath('\\\\wsl$\\Ubuntu')).toBe(false);
    });

    it('returns false for local paths', () => {
      expect(isUncNetworkPath('C:/Users/aleks')).toBe(false);
      expect(isUncNetworkPath('/home/aleks')).toBe(false);
    });
  });

  describe('isLikelySlowPath', () => {
    it('flags wsl and UNC paths as slow', () => {
      expect(isLikelySlowPath('//wsl.localhost/Ubuntu')).toBe(true);
      expect(isLikelySlowPath('//file-server/share')).toBe(true);
    });

    it('treats local paths as not slow', () => {
      expect(isLikelySlowPath('C:/Users/aleks')).toBe(false);
      expect(isLikelySlowPath('/home/aleks/Documents')).toBe(false);
    });
  });

  describe('getPathReadTimeoutMs', () => {
    it('returns the slow timeout for slow paths', () => {
      expect(getPathReadTimeoutMs('//wsl.localhost/Ubuntu')).toBe(SLOW_PATH_READ_TIMEOUT_MS);
      expect(getPathReadTimeoutMs('//file-server/share')).toBe(SLOW_PATH_READ_TIMEOUT_MS);
    });

    it('returns the fast timeout for local paths', () => {
      expect(getPathReadTimeoutMs('C:/Users/aleks')).toBe(FAST_PATH_READ_TIMEOUT_MS);
      expect(getPathReadTimeoutMs('/home/aleks/Documents')).toBe(FAST_PATH_READ_TIMEOUT_MS);
    });
  });
});
