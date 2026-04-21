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

const onWindows = { isWindows: true } as const;
const offWindows = { isWindows: false } as const;

describe('path-slowness', () => {
  describe('isWslPath', () => {
    it('detects normalized wsl.localhost paths', () => {
      expect(isWslPath('//wsl.localhost/Ubuntu-24.04')).toBe(true);
      expect(isWslPath('//wsl.localhost/docker-desktop/var/lib')).toBe(true);
    });

    it('detects backslash-form wsl paths regardless of case', () => {
      expect(isWslPath('\\\\WSL.LOCALHOST\\Ubuntu-24.04')).toBe(true);
      expect(isWslPath('\\\\wsl$\\Ubuntu')).toBe(true);
      expect(isWslPath('\\\\Wsl.LocalHost\\Debian')).toBe(true);
    });

    it('returns false for non-wsl paths', () => {
      expect(isWslPath('C:/Users/aleks')).toBe(false);
      expect(isWslPath('//some-server/share')).toBe(false);
      expect(isWslPath('/home/aleks')).toBe(false);
    });
  });

  describe('isUncNetworkPath', () => {
    it('detects generic UNC network paths on Windows in either separator form', () => {
      expect(isUncNetworkPath('//file-server/shared', onWindows)).toBe(true);
      expect(isUncNetworkPath('\\\\nas01\\backup', onWindows)).toBe(true);
    });

    it('does not classify wsl paths as plain UNC paths', () => {
      expect(isUncNetworkPath('//wsl.localhost/Ubuntu', onWindows)).toBe(false);
      expect(isUncNetworkPath('\\\\wsl$\\Ubuntu', onWindows)).toBe(false);
    });

    it('does not classify any path as UNC on non-Windows platforms', () => {
      expect(isUncNetworkPath('//file-server/shared', offWindows)).toBe(false);
      expect(isUncNetworkPath('\\\\nas01\\backup', offWindows)).toBe(false);
      expect(isUncNetworkPath('//foo/bar', offWindows)).toBe(false);
    });

    it('returns false for local paths on Windows', () => {
      expect(isUncNetworkPath('C:/Users/aleks', onWindows)).toBe(false);
      expect(isUncNetworkPath('/home/aleks', onWindows)).toBe(false);
    });
  });

  describe('isLikelySlowPath', () => {
    it('flags wsl paths as slow on every platform', () => {
      expect(isLikelySlowPath('//wsl.localhost/Ubuntu', onWindows)).toBe(true);
      expect(isLikelySlowPath('//wsl.localhost/Ubuntu', offWindows)).toBe(true);
    });

    it('flags UNC paths as slow only on Windows', () => {
      expect(isLikelySlowPath('//file-server/share', onWindows)).toBe(true);
      expect(isLikelySlowPath('//file-server/share', offWindows)).toBe(false);
      expect(isLikelySlowPath('\\\\file-server\\share', onWindows)).toBe(true);
      expect(isLikelySlowPath('\\\\file-server\\share', offWindows)).toBe(false);
    });

    it('treats local paths as not slow', () => {
      expect(isLikelySlowPath('C:/Users/aleks', onWindows)).toBe(false);
      expect(isLikelySlowPath('/home/aleks/Documents', offWindows)).toBe(false);
    });
  });

  describe('getPathReadTimeoutMs', () => {
    it('returns the slow timeout for slow paths', () => {
      expect(getPathReadTimeoutMs('//wsl.localhost/Ubuntu', onWindows))
        .toBe(SLOW_PATH_READ_TIMEOUT_MS);
      expect(getPathReadTimeoutMs('//file-server/share', onWindows))
        .toBe(SLOW_PATH_READ_TIMEOUT_MS);
    });

    it('returns the fast timeout for local paths', () => {
      expect(getPathReadTimeoutMs('C:/Users/aleks', onWindows)).toBe(FAST_PATH_READ_TIMEOUT_MS);
      expect(getPathReadTimeoutMs('/home/aleks/Documents', offWindows))
        .toBe(FAST_PATH_READ_TIMEOUT_MS);
    });

    it('returns the fast timeout for forward-slash double-leading paths on non-Windows', () => {
      expect(getPathReadTimeoutMs('//file-server/share', offWindows))
        .toBe(FAST_PATH_READ_TIMEOUT_MS);
    });
  });
});
