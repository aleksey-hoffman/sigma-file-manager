// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import ch from './messages/ch.json';
import de from './messages/de.json';
import en from './messages/en.json';
import es from './messages/es.json';
import fa from './messages/fa.json';
import fr from './messages/fr.json';
import ja from './messages/ja.json';
import ru from './messages/ru.json';
import tr from './messages/tr.json';
import vi from './messages/vi.json';
import type { LocalizationLanguage } from '@/types/user-settings';

export const messages = {
  en,
  ru,
  es,
  de,
  fr,
  tr,
  ja,
  fa,
  ch,
  vi,
};

export const languages: LocalizationLanguage[] = [
  {
    name: 'English',
    locale: 'en',
    isCorrected: true,
    isRtl: false,
  },
  {
    name: 'Русский',
    locale: 'ru',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'Español',
    locale: 'es',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'Deutsch',
    locale: 'de',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'Français',
    locale: 'fr',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'Türkçe',
    locale: 'tr',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: '日本語 (nihongo)',
    locale: 'ja',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'فارسى (fārsī)',
    locale: 'fa',
    isCorrected: false,
    isRtl: true,
  },
  {
    name: '中文 (zhōngwén)',
    locale: 'ch',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'tiếng việt (㗂越)',
    locale: 'vi',
    isCorrected: false,
    isRtl: false,
  },
] as const;

export function getLanguage(locale: string) {
  return languages.find(item => item.locale === locale);
}
