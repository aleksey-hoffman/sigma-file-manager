// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import en from './messages/en.json';
import type { LocalizationLanguage } from '@/types/user-settings';

export type LocaleMessages = typeof en;

const localeLoaders: Record<string, () => Promise<{ default: LocaleMessages }>> = {
  ru: () => import('./messages/ru.json'),
  es: () => import('./messages/es.json'),
  de: () => import('./messages/de.json'),
  fr: () => import('./messages/fr.json'),
  tr: () => import('./messages/tr.json'),
  ja: () => import('./messages/ja.json'),
  fa: () => import('./messages/fa.json'),
  ch: () => import('./messages/ch.json'),
  vi: () => import('./messages/vi.json'),
  it: () => import('./messages/it.json'),
  pt: () => import('./messages/pt.json'),
  sl: () => import('./messages/sl.json'),
  hi: () => import('./messages/hi.json'),
  ur: () => import('./messages/ur.json'),
  he: () => import('./messages/he.json'),
  hy: () => import('./messages/hy.json'),
};

export const messages: Record<string, LocaleMessages> = {
  en,
};

export async function loadLocaleMessages(locale: string): Promise<LocaleMessages | undefined> {
  if (messages[locale]) {
    return messages[locale];
  }

  const loader = localeLoaders[locale];

  if (!loader) {
    return undefined;
  }

  const loaded = (await loader()).default;
  messages[locale] = loaded;
  return loaded;
}

export const languages: LocalizationLanguage[] = [
  {
    name: 'English',
    locale: 'en',
    isHumanReviewed: true,
    isRtl: false,
  },
  {
    name: 'Русский',
    locale: 'ru',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Español',
    locale: 'es',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Deutsch',
    locale: 'de',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Français',
    locale: 'fr',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Italiano',
    locale: 'it',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Português',
    locale: 'pt',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Slovenščina',
    locale: 'sl',
    isHumanReviewed: true,
    isRtl: false,
  },
  {
    name: 'Türkçe',
    locale: 'tr',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: '日本語 (nihongo)',
    locale: 'ja',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'فارسى (fārsī)',
    locale: 'fa',
    isHumanReviewed: false,
    isRtl: true,
  },
  {
    name: '中文 (zhōngwén)',
    locale: 'ch',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'Tiếng Việt (Vietnamese)',
    locale: 'vi',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'हिन्दी',
    locale: 'hi',
    isHumanReviewed: false,
    isRtl: false,
  },
  {
    name: 'اردو',
    locale: 'ur',
    isHumanReviewed: false,
    isRtl: true,
  },
  {
    name: 'עברית',
    locale: 'he',
    isHumanReviewed: true,
    isRtl: true,
  },
  {
    name: 'Հայերեն',
    locale: 'hy',
    isHumanReviewed: true,
    isRtl: false,
  },
] as const;

export function getLanguage(locale: string) {
  return languages.find(item => item.locale === locale);
}

export type AppLocale = (typeof languages)[number]['locale'];

export const dayjsLocaleMapping: Record<AppLocale, string> = {
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
  it: 'it',
  pt: 'pt',
  sl: 'sl',
  hi: 'hi',
  ur: 'ur',
  he: 'he',
  hy: 'hy-am',
};

export const intlLocaleMapping: Record<AppLocale, string> = {
  en: 'en',
  ru: 'ru',
  es: 'es',
  de: 'de',
  fr: 'fr',
  tr: 'tr',
  ja: 'ja',
  fa: 'fa',
  ch: 'zh-CN',
  vi: 'vi',
  it: 'it',
  pt: 'pt',
  sl: 'sl',
  hi: 'hi-IN',
  ur: 'ur-PK',
  he: 'he-IL',
  hy: 'hy-AM',
};
