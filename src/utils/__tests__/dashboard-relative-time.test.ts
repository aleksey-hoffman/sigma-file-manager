// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/dashboard-relative-time.ts`。
// 翻译函数由调用方注入，所以这里直接断言「用了哪个 key、传了几个 count」。

import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';
import { formatDashboardRelativeTime } from '@/utils/dashboard-relative-time';

const NOW = new Date('2026-10-23T12:00:00Z').getTime();

function createTranslate() {
  return vi.fn((key: string, count?: number) => (count === undefined ? key : `${key}:${count}`));
}

describe('formatDashboardRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports "just now" below one minute', () => {
    const translate = createTranslate();

    expect(formatDashboardRelativeTime(NOW - 30_000, translate)).toBe('dashboard.justNow');
    expect(translate).toHaveBeenCalledWith('dashboard.justNow');
  });

  it('reports minutes below one hour', () => {
    const translate = createTranslate();

    expect(formatDashboardRelativeTime(NOW - 5 * 60_000, translate)).toBe('dashboard.minutesAgo:5');
    expect(translate).toHaveBeenCalledWith('dashboard.minutesAgo', 5);
  });

  it('reports hours below one day', () => {
    const translate = createTranslate();

    expect(formatDashboardRelativeTime(NOW - 3 * 3_600_000, translate)).toBe('dashboard.hoursAgo:3');
    expect(translate).toHaveBeenCalledWith('dashboard.hoursAgo', 3);
  });

  it('reports days from one day onwards', () => {
    const translate = createTranslate();

    expect(formatDashboardRelativeTime(NOW - 2 * 86_400_000, translate)).toBe('dashboard.daysAgo:2');
    expect(translate).toHaveBeenCalledWith('dashboard.daysAgo', 2);
  });

  it('switches from minutes to hours at the 60 minute boundary', () => {
    const translate = createTranslate();

    formatDashboardRelativeTime(NOW - 59 * 60_000, translate);
    expect(translate).toHaveBeenCalledWith('dashboard.minutesAgo', 59);

    translate.mockClear();
    formatDashboardRelativeTime(NOW - 60 * 60_000, translate);
    expect(translate).toHaveBeenCalledWith('dashboard.hoursAgo', 1);
  });

  it('switches from hours to days at the 24 hour boundary', () => {
    const translate = createTranslate();

    formatDashboardRelativeTime(NOW - 23 * 3_600_000, translate);
    expect(translate).toHaveBeenCalledWith('dashboard.hoursAgo', 23);

    translate.mockClear();
    formatDashboardRelativeTime(NOW - 24 * 3_600_000, translate);
    expect(translate).toHaveBeenCalledWith('dashboard.daysAgo', 1);
  });
});
