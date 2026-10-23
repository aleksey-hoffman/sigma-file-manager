// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 门禁：标签色板必须**只有一份**，且新建标签时取到的颜色必须来自这份色板。
//
// 背景：仪表盘页曾经把同一个 8 色板抄了两遍（颜色选择器一份、随机取色一份）。
// 两份拷贝迟早漂移 —— 改一处忘一处，界面上的颜色和实际落库的颜色就对不上，
// 而且这种不一致**没有任何测试会发现**。

import { describe, expect, it } from 'vitest';
import { pickRandomTagColor, TAG_COLORS } from '@/utils/tag-colors';

describe('tag colors', () => {
  it('has a non-empty palette of distinct hex colors', () => {
    expect(TAG_COLORS.length).toBeGreaterThan(0);
    expect(new Set(TAG_COLORS).size).toBe(TAG_COLORS.length);

    for (const color of TAG_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('always picks a color from the palette', () => {
    for (let attempt = 0; attempt < 50; attempt += 1) {
      expect(TAG_COLORS).toContain(pickRandomTagColor());
    }
  });
});
