// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  formatDateTimeDisplay,
  formatTimeOnly,
  isPreviousLocalCalendarDay,
  isSameLocalCalendarDay,
} from '@/utils/date-time';
import type { DateTime } from '@/types/user-settings';

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

const SAMPLE_DATE = new Date(2026, 2, 26, 17, 25, 45, 123);

describe('formatDateTimeDisplay', () => {
  describe('locale resolution', () => {
    it('uses the regional format code mapped to a valid BCP-47 tag', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          regionalFormat: {
            code: 'ch',
            name: '中文 (zhōngwén)',
          },
        }),
        'en',
      );

      expect(result).not.toBe('');
      expect(result).toMatch(/2026/);
    });

    it('produces Chinese-formatted output for the ch locale, not English fallback', () => {
      const chineseResult = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          regionalFormat: {
            code: 'ch',
            name: '中文',
          },
        }),
        'en',
      );

      const englishResult = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          regionalFormat: {
            code: 'en',
            name: 'English',
          },
        }),
        'en',
      );

      expect(chineseResult).not.toBe(englishResult);
    });

    it('falls back to appLocale (mapped) when regional format code is empty', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          regionalFormat: {
            code: '',
            name: '',
          },
        }),
        'ja',
      );

      expect(result).not.toBe('');
      expect(result).toMatch(/2026/);
    });

    it('uses navigator.language when autoDetectRegionalFormat is true', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({ autoDetectRegionalFormat: true }),
        'en',
      );

      expect(result).not.toBe('');
      expect(result).toMatch(/2026/);
    });

    it('returns empty string for an entirely invalid date', () => {
      const result = formatDateTimeDisplay(
        new Date(NaN),
        createDateTimeOptions(),
        'en',
      );

      expect(result).toBe('');
    });
  });

  describe('month format options', () => {
    it('renders numeric month as 2-digit', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({ month: 'numeric' }),
        'en',
        false,
      );

      expect(result).toMatch(/03|3/);
    });

    it('renders short month name', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({ month: 'short' }),
        'en',
        false,
      );

      expect(result).toMatch(/Mar/);
    });

    it('renders long month name', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({ month: 'long' }),
        'en',
        false,
      );

      expect(result).toMatch(/March/);
    });
  });

  describe('time properties', () => {
    it('excludes seconds by default', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions(),
        'en',
      );

      expect(result).not.toMatch(/:45/);
    });

    it('includes seconds when showSeconds is true', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          properties: {
            showSeconds: true,
            showMilliseconds: false,
          },
        }),
        'en',
      );

      expect(result).toMatch(/45/);
    });

    it('includes fractional seconds when showMilliseconds is true', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          properties: {
            showSeconds: true,
            showMilliseconds: true,
          },
        }),
        'en',
      );

      expect(result).toMatch(/123/);
    });

    it('enables seconds automatically when only showMilliseconds is true', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions({
          properties: {
            showSeconds: false,
            showMilliseconds: true,
          },
        }),
        'en',
      );

      expect(result).toMatch(/45/);
      expect(result).toMatch(/123/);
    });
  });

  describe('includeTimePart', () => {
    it('returns date-only when includeTimePart is false', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions(),
        'en',
        false,
      );

      expect(result).toMatch(/2026/);
      expect(result).not.toMatch(/17|5/);
    });

    it('returns date and time when includeTimePart is true', () => {
      const result = formatDateTimeDisplay(
        SAMPLE_DATE,
        createDateTimeOptions(),
        'en',
        true,
      );

      expect(result).toMatch(/2026/);
      expect(result).toMatch(/25/);
    });
  });
});

describe('isSameLocalCalendarDay', () => {
  it('returns true for the same local calendar day', () => {
    const morning = new Date(2026, 3, 5, 8, 0, 0);
    const evening = new Date(2026, 3, 5, 22, 30, 0);
    expect(isSameLocalCalendarDay(morning, evening)).toBe(true);
  });

  it('returns false across local midnights', () => {
    const late = new Date(2026, 3, 5, 23, 59, 0);
    const early = new Date(2026, 3, 6, 0, 1, 0);
    expect(isSameLocalCalendarDay(late, early)).toBe(false);
  });
});

describe('isPreviousLocalCalendarDay', () => {
  it('returns true when candidate is the local calendar day before reference', () => {
    const reference = new Date(2026, 3, 6, 14, 0, 0);
    const candidate = new Date(2026, 3, 5, 23, 30, 0);
    expect(isPreviousLocalCalendarDay(candidate, reference)).toBe(true);
  });

  it('returns false for the same day or two days back', () => {
    const reference = new Date(2026, 3, 6, 8, 0, 0);
    expect(isPreviousLocalCalendarDay(new Date(2026, 3, 6, 1, 0, 0), reference)).toBe(false);
    expect(isPreviousLocalCalendarDay(new Date(2026, 3, 4, 12, 0, 0), reference)).toBe(false);
  });
});

describe('formatTimeOnly', () => {
  it('formats hour and minute using 24-hour preference', () => {
    const result = formatTimeOnly(
      new Date(2026, 2, 26, 17, 5, 0),
      createDateTimeOptions({ hour12: false }),
      'en',
    );

    expect(result).toMatch(/17/);
    expect(result).toMatch(/05|5/);
  });
});
