// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { createI18n } from 'vue-i18n';
import { loadLocaleMessages, messages } from './data';
import { pluralRules } from './plural-rules';

export const i18n = createI18n({
  locale: 'en',
  fallbackLocale: 'en',
  legacy: false,
  messages,
  pluralRules,
});

export async function setAppLocale(locale: string): Promise<void> {
  if (locale !== 'en') {
    const loaded = await loadLocaleMessages(locale);

    if (loaded) {
      i18n.global.setLocaleMessage(locale, loaded);
    }
  }

  i18n.global.locale.value = locale;
}
