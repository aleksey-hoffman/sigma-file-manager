// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { formatDateTimeDisplay } from '@/utils/date-time';
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
