// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import dayjs from 'dayjs';
import dayjsCustomParseFormat from 'dayjs/plugin/customParseFormat';
import dayjsDuration from 'dayjs/plugin/duration';

dayjs.extend(dayjsCustomParseFormat);
dayjs.extend(dayjsDuration);

export default async function formatDateTime (date: Date, format: string, locale = 'en'): Promise<string> {
  if (!date) {
    return '';
  }

  try {
    let _locale = await import(`dayjs/locale/${locale}`);
    return dayjs(date).locale(_locale).format(format);
  } catch (error) {
    return '';
  }
}