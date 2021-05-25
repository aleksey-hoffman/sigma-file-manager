// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// TODO:
// Use V8 Intl module for determining pluralization for quantities:
// https://v8.dev/features/intl-pluralrules
// For example:
// new Intl.PluralRules('en-US').select(2)
// Define all forms and pick the correct one:
// text_one_item: 'item'
// text_few_item: 'items'
// text_many_item: 'items'
// text_other_item: 'items'

import store from '../store'

export function get (key, options = {}) {
  const selectedLocale = store.state.storageData.settings.localization.selectedLanguage.locale
  options = {
    locale: selectedLocale,
    capitalize: true,
    ...options
  }

  const englishData = require('../localization/en.js').data
  const selectedLanguageData = require(`../localization/${options.locale}`).data

  const propertyExistsInLocale = selectedLanguageData[key] !== undefined
  const propertyExistsInEnglish = englishData[key] !== undefined
  const propertyExistsNowhere = !propertyExistsInLocale && !propertyExistsInEnglish

  if (propertyExistsInLocale) {
    return getLocaleValue(selectedLanguageData[key], options)
  }
  else if (propertyExistsInEnglish) {
    return getLocaleValue(englishData[key], options)
  }
  else if (propertyExistsNowhere) {
    return key
  }
}

function getLocaleValue (key, options) {
  if (options.capitalize) {
    return key.replace(/^\p{CWU}/u, char => char.toLocaleUpperCase(options.locale))
  }
  else {
    return key
  }
}
