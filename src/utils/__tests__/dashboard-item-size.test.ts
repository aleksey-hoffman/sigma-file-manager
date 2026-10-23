// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/dashboard-item-size.ts`。
// 关键口径：取不到大小一律显示「—」，**不是** 0 B ——
// 「0」会被读成「这是个空文件/空目录」，那是错的信息。

import { describe, expect, it } from 'vitest';
import {
  formatDashboardDirectorySize,
  formatDashboardFileSize,
  UNKNOWN_DASHBOARD_ITEM_SIZE,
} from '@/utils/dashboard-item-size';

describe('formatDashboardFileSize', () => {
  it('formats a known byte count', () => {
    expect(formatDashboardFileSize(0)).toBe('0 B');
    expect(formatDashboardFileSize(1024)).toBe('1.0 KB');
  });

  it('falls back to the placeholder for missing sizes', () => {
    expect(formatDashboardFileSize(null)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardFileSize(undefined)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardFileSize(Number.NaN)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
  });

  it('never reports an unavailable size as zero bytes', () => {
    expect(formatDashboardFileSize(null)).not.toBe('0 B');
  });

  it('never leaks NaN into the rendered label', () => {
    expect(formatDashboardFileSize(Number.NaN)).not.toContain('NaN');
  });
});

describe('formatDashboardDirectorySize', () => {
  it('formats a completed directory size', () => {
    expect(formatDashboardDirectorySize({
      status: 'Complete',
      size: 2048,
    })).toBe('2.0 KB');
  });

  it('falls back to the placeholder while loading or on error', () => {
    expect(formatDashboardDirectorySize({
      status: 'Loading',
      size: 2048,
    }))
      .toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardDirectorySize({
      status: 'Error',
      size: 0,
    }))
      .toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
  });

  it('falls back to the placeholder when there is no entry at all', () => {
    expect(formatDashboardDirectorySize(undefined)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
  });
});
