// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import type { DateTime } from '@/types/user-settings';
import {
  formatDateTimeDisplay,
  formatTimeOnly,
  isPreviousLocalCalendarDay,
  isSameLocalCalendarDay,
} from '@/utils/date-time';

const RECENT_RELATIVE_DATE_WINDOW_MS = 6 * 60 * 60 * 1000;

export type RelativeDateDisplayTranslate = (key: string, values?: unknown) => string;

export function isRelativeDateDisplayEnabled(showRelativeDates: boolean | undefined, relativeDisplay = true): boolean {
  return relativeDisplay && (showRelativeDates ?? true);
}

export function formatAbsoluteDateDisplay(
  timestamp: number,
  dateTimeOptions: DateTime,
  appLocale: string,
  includeTimePart = true,
): string {
  if (!timestamp) {
    return '-';
  }

  return formatDateTimeDisplay(
    new Date(timestamp),
    dateTimeOptions,
    appLocale,
    includeTimePart,
  );
}

export function formatRelativeDateDisplay(params: {
  timestamp: number;
  referenceNowMs: number;
  dateTimeOptions: DateTime;
  appLocale: string;
  translate: RelativeDateDisplayTranslate;
  relativeDisplay?: boolean;
}): string {
  const {
    timestamp,
    referenceNowMs,
    dateTimeOptions,
    appLocale,
    translate,
    relativeDisplay = true,
  } = params;

  if (!timestamp) {
    return '-';
  }

  if (!isRelativeDateDisplayEnabled(dateTimeOptions.showRelativeDates, relativeDisplay)) {
    return formatAbsoluteDateDisplay(timestamp, dateTimeOptions, appLocale);
  }

  const modifiedDate = new Date(timestamp);
  const referenceDate = new Date(referenceNowMs);
  const elapsedMs = referenceNowMs - timestamp;

  if (elapsedMs < 0) {
    return formatDateTimeDisplay(modifiedDate, dateTimeOptions, appLocale);
  }

  if (elapsedMs < RECENT_RELATIVE_DATE_WINDOW_MS) {
    const totalSeconds = Math.floor(elapsedMs / 1000);

    if (totalSeconds < 60) {
      return translate('relativeTime.secondsAgo', totalSeconds);
    }

    const totalMinutes = Math.floor(totalSeconds / 60);

    if (totalMinutes < 60) {
      return translate('relativeTime.minutesAgo', totalMinutes);
    }

    const totalHours = Math.floor(totalMinutes / 60);
    return translate('relativeTime.hoursAgo', totalHours);
  }

  if (isSameLocalCalendarDay(modifiedDate, referenceDate)) {
    const timeLabel = formatTimeOnly(modifiedDate, dateTimeOptions, appLocale);
    return translate('fileBrowser.listModifiedDate.todayAt', { time: timeLabel });
  }

  if (isPreviousLocalCalendarDay(modifiedDate, referenceDate)) {
    const timeLabel = formatTimeOnly(modifiedDate, dateTimeOptions, appLocale);
    return translate('fileBrowser.listModifiedDate.yesterdayAt', { time: timeLabel });
  }

  return formatDateTimeDisplay(modifiedDate, dateTimeOptions, appLocale);
}
