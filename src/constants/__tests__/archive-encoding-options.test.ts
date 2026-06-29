// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_ZIP_ENCODING_LABELS,
  createArchiveEncodingSelectOptions,
  getSelectableArchiveEncodingValues,
} from '@/constants/archive-encoding-options';

describe('archive-encoding-options', () => {
  it('includes every detectable encoding label in the selectable options', () => {
    const options = createArchiveEncodingSelectOptions(key => key);
    const selectableValues = getSelectableArchiveEncodingValues(options);

    for (const encodingLabel of ARCHIVE_ZIP_ENCODING_LABELS) {
      expect(selectableValues.has(encodingLabel)).toBe(true);
    }
  });
});
