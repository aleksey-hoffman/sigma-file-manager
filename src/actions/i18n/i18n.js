// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {i18n} from '@/localization'
import {languages} from '@/localization/data'

const githubLinks = require('@/utils/externalLinks')

export async function loadRemoteTranslations () {
  const translations = await fetchRemoteTranslations()
  translations.forEach(({locale, data}) => {
    i18n.setLocaleMessage(locale, data)
  })
}

export async function fetchRemoteTranslations () {
  const requests = languages.map(async (language) => {
    try {
      const url = `${githubLinks.githubLocalesLink}/${language.locale}.json`
      const response = await fetch(url)
      const data = await response.json()
      return {
        locale: language.locale,
        data,
      }
    }
    catch (error) {
      console.error(`Failed to fetch remote translations for langauge ${language.locale}`, error)
      return null
    }
  })

  const translations = await Promise.allSettled(requests)
  const successfulTranslations = translations
    .filter(result => result.status === 'fulfilled')
    .map(result => result.value)
    .filter(Boolean)
  return successfulTranslations
}
