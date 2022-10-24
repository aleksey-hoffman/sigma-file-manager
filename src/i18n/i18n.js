// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import Vue from 'vue'
import VueI18n from 'vue-i18n'
import {locales} from './locales'

Vue.use(VueI18n)

export const i18n = new VueI18n({
  legacy: false,
  locale: 'en',
  messages: locales,
  fallbackWarn: process.env.NODE_ENV === 'development',
  missingWarn: process.env.NODE_ENV === 'development',
})
