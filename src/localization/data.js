// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
import en from './locales/en.json'
import ru from './locales/ru.json'
import es from './locales/es.json'
import de from './locales/de.json'
import fr from './locales/fr.json'
import tr from './locales/tr.json'
import ja from './locales/ja.json'
import fa from './locales/fa.json'
import ch from './locales/ch.json'
import vi from './locales/vi.json'
import it from './locales/it.json'

export const locales = {
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
  it,
}

export const languages = [
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
    isCorrected: true,
    isRtl: false,
  },
  {
    name: 'tiếng việt (㗂越)',
    locale: 'vi',
    isCorrected: false,
    isRtl: false,
  },
  {
    name: 'Italiano',
    locale: 'it',
    isCorrected: true,
    isRtl: false,
  },
]

export function getLanguage (locale) {
  return languages.find(item => item.locale === locale)
}
