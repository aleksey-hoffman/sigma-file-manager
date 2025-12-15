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
import 'dayjs/locale/tr';
import 'dayjs/locale/ja';
import 'dayjs/locale/fa';
import 'dayjs/locale/zh-cn';
import 'dayjs/locale/vi';

import type { languages } from '@/localization/data';

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsDuration);

type AppLocale = (typeof languages)[number]['locale'];

const localeMapping: Record<AppLocale, string> = {
  en: 'en',
  ru: 'ru',
  es: 'es',
  de: 'de',
  fr: 'fr',
  tr: 'tr',
  ja: 'ja',
  fa: 'fa',
  ch: 'zh-cn',
  vi: 'vi',
};

export default function formatDateTime(date: Date, format: string, locale: AppLocale = 'en'): string {
  if (!date) {
    return '';
  }

  try {
    const dayjsLocale = localeMapping[locale] || 'en';
    return dayjs(date).locale(dayjsLocale).format(format);
  }
  catch (error) {
    return '';
  }
}
