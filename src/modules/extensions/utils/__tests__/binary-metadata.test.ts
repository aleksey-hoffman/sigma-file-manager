// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  getBinaryDisplayVersion,
  getBinaryLookupVersion,
} from '@/modules/extensions/utils/binary-metadata';

describe('binary metadata helpers', () => {
  it('uses storageVersion for filesystem lookups', () => {
    expect(getBinaryLookupVersion({
      version: '1.2.3',
      storageVersion: '1.2.3',
    })).toBe('1.2.3');

    expect(getBinaryLookupVersion({
      version: '1.2.3',
      storageVersion: null,
    })).toBeUndefined();
  });

  it('prefers the installed version for display', () => {
    expect(getBinaryDisplayVersion({
      version: '1.2.3',
      latestVersion: '1.2.4',
    })).toBe('1.2.3');

    expect(getBinaryDisplayVersion({
      latestVersion: '1.2.4',
    })).toBe('1.2.4');
  });
});
