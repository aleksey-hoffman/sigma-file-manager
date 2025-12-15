// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsDuration from 'dayjs/plugin/duration';
import type { DateTime } from '@/types/user-settings';

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsDuration);

export default function toLocalTime(date: Date, options: DateTime, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(options.regionalFormat.code || locale, {
      ...{
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: options.hour12,
        second: options.properties.showSeconds ? 'numeric' : undefined,
        fractionalSecondDigits: options.properties.showMilliseconds ? 3 : undefined,
      },
      ...options,
    })
      .format(new Date(date));
  }
  catch (error) {
    return '';
  }
}
