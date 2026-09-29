// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  formatDashboardDirectorySize,
  formatDashboardFileSize,
  UNKNOWN_DASHBOARD_ITEM_SIZE,
} from '@/utils/dashboard-item-size';

describe('formatDashboardFileSize', () => {
  it('formats a known file size', () => {
    expect(formatDashboardFileSize(0)).toBe('0 B');
    expect(formatDashboardFileSize(1536)).toBe('1.5 KB');
  });

  it('uses a dash when the file size is unknown', () => {
    expect(formatDashboardFileSize(undefined)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardFileSize(null)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
  });
});

describe('formatDashboardDirectorySize', () => {
  it('formats a completed directory size', () => {
    expect(formatDashboardDirectorySize({ status: 'Complete', size: 1048576 })).toBe('1.0 MB');
  });

  it('uses a dash while a directory size is still unknown', () => {
    expect(formatDashboardDirectorySize(undefined)).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardDirectorySize({ status: 'Loading', size: 0 })).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
    expect(formatDashboardDirectorySize({ status: 'Error', size: 0 })).toBe(UNKNOWN_DASHBOARD_ITEM_SIZE);
  });
});
