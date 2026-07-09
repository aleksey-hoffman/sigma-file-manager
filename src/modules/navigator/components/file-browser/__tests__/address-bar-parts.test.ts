// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import { buildAddressBarParts } from '../address-bar-parts';

describe('buildAddressBarParts', () => {
  it('builds Locations > / for the unix filesystem root', () => {
    const parts = buildAddressBarParts('/', 'linux', 'Locations');

    expect(parts.map(part => ({ path: part.path, name: part.name }))).toEqual([
      { path: LOCATIONS_VIRTUAL_PATH, name: 'Locations' },
      { path: '/', name: '/' },
    ]);
  });

  it('builds Locations > C: for a windows drive root', () => {
    const parts = buildAddressBarParts('C:/', 'windows', 'Locations');

    expect(parts.map(part => ({ path: part.path, name: part.name }))).toEqual([
      { path: LOCATIONS_VIRTUAL_PATH, name: 'Locations' },
      { path: 'C:/', name: 'C:' },
    ]);
  });
});
