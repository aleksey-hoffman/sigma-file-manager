// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.
import en from './locales/en.json'

export const locales = {
  en,
}

export const languages = [
  {
    name: 'English',
    locale: 'en',
    isCorrected: true,
    isRtl: false,
  },
]

export function getLanguage (locale) {
  return languages.find(item => item.locale === locale)
}