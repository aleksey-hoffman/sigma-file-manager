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

import { dayjsLocaleMapping, type AppLocale } from '@/localization/data';
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

export function toLocalTime(date: Date, options: DateTime, locale = 'en'): string {
  try {
    const formatOptions: Intl.DateTimeFormatOptions & { fractionalSecondDigits?: 1 | 2 | 3 } = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: options.hour12,
      second: options.properties.showSeconds ? 'numeric' : undefined,
      fractionalSecondDigits: options.properties.showMilliseconds ? 3 : undefined,
    };
    return new Intl.DateTimeFormat(options.regionalFormat.code || locale, formatOptions).format(new Date(date));
  }
  catch {
    return '';
  }
}
