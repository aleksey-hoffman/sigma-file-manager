// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsDuration from 'dayjs/plugin/duration';

import 'dayjs/locale/en';
import 'dayjs/locale/ru';
import 'dayjs/locale/es';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import 'dayjs/locale/it';
import 'dayjs/locale/pt';
import 'dayjs/locale/tr';
import 'dayjs/locale/ja';
import 'dayjs/locale/fa';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/vi';
import 'dayjs/locale/sl';

import { dayjsLocaleMapping, intlLocaleMapping, type AppLocale } from '@/localization/data';
import type { DateTime } from '@/types/user-settings';

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsDuration);

export function formatDateTime(date: Date, format: string, locale: AppLocale = 'en'): string {
  if (!date) {
    return '';
  }

  try {
    const dayjsLocale = dayjsLocaleMapping[locale] || 'en';
    return dayjs(date).locale(dayjsLocale).format(format);
  }
  catch {
    return '';
  }
}

function toIntlLocale(appLocale: string): string {
  return intlLocaleMapping[appLocale as AppLocale] ?? appLocale;
}

function resolveFormattingLocale(options: DateTime, appLocale: string): string | undefined {
  if (options.autoDetectRegionalFormat) {
    if (typeof navigator !== 'undefined' && navigator.language) {
      return navigator.language;
    }

    return undefined;
  }

  const code = options.regionalFormat?.code;

  if (code && code.length > 0) {
    return toIntlLocale(code);
  }

  return toIntlLocale(appLocale);
}

function monthToIntlOption(month: DateTime['month']): Intl.DateTimeFormatOptions['month'] {
  if (month === 'numeric') {
    return '2-digit';
  }

  if (month === 'long') {
    return 'long';
  }

  return 'short';
}

export function formatDateTimeDisplay(
  date: Date,
  options: DateTime,
  appLocale: string,
  includeTimePart = true,
): string {
  try {
    const localeTag = resolveFormattingLocale(options, appLocale);

    if (!includeTimePart) {
      return new Intl.DateTimeFormat(localeTag, {
        year: 'numeric',
        month: monthToIntlOption(options.month),
        day: 'numeric',
      }).format(date);
    }

    const formatOptions: Intl.DateTimeFormatOptions & { fractionalSecondDigits?: 1 | 2 | 3 } = {
      year: 'numeric',
      month: monthToIntlOption(options.month),
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: options.hour12,
    };

    if (options.properties.showSeconds || options.properties.showMilliseconds) {
      formatOptions.second = 'numeric';
    }

    if (options.properties.showMilliseconds) {
      formatOptions.fractionalSecondDigits = 3;
    }

    return new Intl.DateTimeFormat(localeTag, formatOptions).format(date);
  }
  catch {
    return '';
  }
}

export function toLocalTime(date: Date, options: DateTime, appLocale: string): string {
  return formatDateTimeDisplay(date, options, appLocale);
}
