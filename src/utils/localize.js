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

export function get (key, options = {}) {
  return key
}
