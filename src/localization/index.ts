// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {createI18n} from 'vue-i18n';
import {messages} from './data';
import {pluralRules} from './pluralRules';

export const i18n = createI18n({
  locale: 'en',
  messages,
  pluralRules
});
