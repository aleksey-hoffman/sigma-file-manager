// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {locales} from '@/localization/data'

const fs = require('fs')
const path = require('path')
const localeDirPath = path.resolve('src/localization/locales')

async function syncFiles () {
  for (const locale in locales) {
    if (locale !== 'en') {
      let otherLocaleData = locales[locale]
      otherLocaleData = addMissingKeys(locales.en, locales[locale])
      otherLocaleData = removeUneededKeys(locales.en, locales[locale])
      const otherLocalePath = path.join(localeDirPath, `${locale}.json`)
      fs.writeFileSync(otherLocalePath, JSON.stringify(otherLocaleData, null, '\t'))
    }
  }
}

function addMissingKeys (enLocale, otherLocale) {
  for (const key in enLocale) {
    if (!otherLocale[key]) {
      otherLocale[key] = enLocale[key]
    }
    else if (typeof enLocale[key] === 'object') {
      addMissingKeys(enLocale[key], otherLocale[key])
    }
  }
  return otherLocale
}

function removeUneededKeys (enLocale, otherLocale) {
  for (const key in otherLocale) {
    if (!enLocale[key]) {
      delete otherLocale[key]
    }
    else if (typeof otherLocale[key] === 'object') {
      removeUneededKeys(enLocale[key], otherLocale[key])
    }
  }
  return otherLocale
}

syncFiles()