// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';

vi.mock('@/localization', () => ({ i18n: { global: { t: (key: string) => key } } }));

import { getMovedPathsForToast } from '@/stores/runtime/copy-move-jobs';

describe('getMovedPathsForToast', () => {
  it('shows the full new path of a single moved item', () => {
    expect(getMovedPathsForToast([{
      from: 'C:/one/a.txt',
      to: 'C:/two/a (1).txt',
    }])).toEqual({
      sources: ['C:/one/a.txt'],
      destination: 'C:/two/a (1).txt',
    });
  });

  it('shows the destination folder of several moved items', () => {
    expect(getMovedPathsForToast([
      {
        from: 'C:/one/a.txt',
        to: 'C:/target/a.txt',
      },
      {
        from: 'C:/two/b.txt',
        to: 'C:/target/b.txt',
      },
    ])).toEqual({
      sources: ['C:/one/a.txt', 'C:/two/b.txt'],
      destination: 'C:/target',
    });
  });

  it('shows nothing when no item was moved', () => {
    expect(getMovedPathsForToast([])).toBeUndefined();
  });
});
