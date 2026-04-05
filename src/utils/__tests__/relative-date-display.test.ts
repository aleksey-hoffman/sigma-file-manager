// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DateTime } from '@/types/user-settings';
import {
  formatRelativeDateDisplay,
  isRelativeDateDisplayEnabled,
} from '@/utils/relative-date-display';

function createDateTimeOptions(overrides: Partial<DateTime> = {}): DateTime {
  return {
    month: 'short',
    regionalFormat: {
      code: 'en',
      name: 'English',
    },
    autoDetectRegionalFormat: false,
    hour12: false,
    showRelativeDates: true,
    properties: {
      showSeconds: false,
      showMilliseconds: false,
    },
    ...overrides,
  };
}

function translate(key: string, values?: unknown): string {
  if (key === 'relativeTime.secondsAgo') {
    return `${String(values)} sec ago`;
  }

  if (key === 'relativeTime.minutesAgo') {
    return `${String(values)} min ago`;
  }

  if (key === 'relativeTime.hoursAgo') {
    return `${String(values)} hours ago`;
  }

  if (key === 'fileBrowser.listModifiedDate.todayAt') {
    return `Today at ${(values as { time: string }).time}`;
  }

  if (key === 'fileBrowser.listModifiedDate.yesterdayAt') {
    return `Yesterday, ${(values as { time: string }).time}`;
  }

  return key;
}

describe('isRelativeDateDisplayEnabled', () => {
  it('returns true when both the setting and local display flag are enabled', () => {
    expect(isRelativeDateDisplayEnabled(true, true)).toBe(true);
  });

  it('returns false when either the setting or local display flag is disabled', () => {
    expect(isRelativeDateDisplayEnabled(false, true)).toBe(false);
    expect(isRelativeDateDisplayEnabled(true, false)).toBe(false);
  });
});

describe('formatRelativeDateDisplay', () => {
  it('formats recent timestamps as relative labels', () => {
    const result = formatRelativeDateDisplay({
      timestamp: Date.UTC(2026, 3, 5, 12, 0, 30),
      referenceNowMs: Date.UTC(2026, 3, 5, 12, 1, 0),
      dateTimeOptions: createDateTimeOptions(),
      appLocale: 'en',
      translate,
    });

    expect(result).toBe('30 sec ago');
  });

  it('falls back to absolute formatting when relative display is disabled', () => {
    const result = formatRelativeDateDisplay({
      timestamp: Date.UTC(2026, 3, 5, 12, 0, 0),
      referenceNowMs: Date.UTC(2026, 3, 5, 12, 5, 0),
      dateTimeOptions: createDateTimeOptions({ showRelativeDates: false }),
      appLocale: 'en',
      translate,
    });

    expect(result).toContain('2026');
  });
});
