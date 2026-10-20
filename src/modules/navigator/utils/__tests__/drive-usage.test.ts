// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 磁盘占用可视化（用户 2026-10-20 00:05 附图要求）：
// 网格视图用背景色填充显示已用空间比例，可用 < 20% 时改浅红。
//
// 这里最有价值的断言是**边界**和**算不出**两类：
// 「正好 20%」算不算告警、「可用 > 总量」怎么办 ——
// 这两处如果写错，界面不会报错，只会画出一条错的进度条，
// 而正常路径的单测（比如 50% 盘）照样全绿。

import { describe, expect, it } from 'vitest';
import {
  LOW_FREE_SPACE_PERCENT,
  NOTICE_USED_PERCENT,
  getDriveFillLevel,
  getFreeSpacePercent,
  getUsedSpacePercent,
  isLowFreeSpace,
} from '../drive-usage';

const GB = 1024 ** 3;

describe('getUsedSpacePercent', () => {
  it('按可用量与总量算出已用百分比', () => {
    expect(getUsedSpacePercent(50 * GB, 100 * GB)).toBe(50);
    expect(getUsedSpacePercent(25 * GB, 100 * GB)).toBe(75);
  });

  it('整空盘是 0%，整满盘是 100%', () => {
    expect(getUsedSpacePercent(100 * GB, 100 * GB)).toBe(0);
    expect(getUsedSpacePercent(0, 100 * GB)).toBe(100);
  });

  // 「算不出」必须返回 null 而不是 0 —— 0 会被画成「空盘」，
  // 与「读不到」混为一谈。这条断言就是把那个区别钉住。
  it('读不到可用量时返回 null 而不是 0', () => {
    expect(getUsedSpacePercent(null, 100 * GB)).toBeNull();
    expect(getUsedSpacePercent(undefined, 100 * GB)).toBeNull();
    expect(getUsedSpacePercent(Number.NaN, 100 * GB)).toBeNull();
    expect(getUsedSpacePercent(-1, 100 * GB)).toBeNull();
    expect(getUsedSpacePercent(Number.POSITIVE_INFINITY, 100 * GB)).toBeNull();
  });

  it('总量非正数时返回 null（分母为 0）', () => {
    expect(getUsedSpacePercent(0, 0)).toBeNull();
    expect(getUsedSpacePercent(10 * GB, 0)).toBeNull();
    expect(getUsedSpacePercent(10 * GB, -5)).toBeNull();
    expect(getUsedSpacePercent(10 * GB, null)).toBeNull();
    expect(getUsedSpacePercent(10 * GB, Number.NaN)).toBeNull();
  });

  // 快照不一致：available 与 total 不是同一时刻的读数。
  // 这种情况下画一条 >100% 的填充条比画空盘更糟，所以返回 null。
  it('可用量大于总量时返回 null', () => {
    expect(getUsedSpacePercent(120 * GB, 100 * GB)).toBeNull();
  });
});

describe('getFreeSpacePercent', () => {
  it('是已用百分比的补数', () => {
    // 25 GB 可用 / 100 GB 总量 = 已用 75%，空闲 25%。
    expect(getFreeSpacePercent(25 * GB, 100 * GB)).toBe(25);
    expect(getFreeSpacePercent(100 * GB, 100 * GB)).toBe(100);
    expect(getFreeSpacePercent(0, 100 * GB)).toBe(0);
  });

  it('已用算不出时同样返回 null', () => {
    expect(getFreeSpacePercent(null, 100 * GB)).toBeNull();
    expect(getFreeSpacePercent(10 * GB, 0)).toBeNull();
  });
});

describe('isLowFreeSpace', () => {
  it('阈值是 20%（用户 2026-10-20 明确要求）', () => {
    expect(LOW_FREE_SPACE_PERCENT).toBe(20);
  });

  // 边界用严格 < ：正好 20% **不**告警。
  // 写成 <= 的话这条会红 —— 这正是它存在的理由。
  it('正好 20% 不算告警，19.9% 算', () => {
    expect(isLowFreeSpace(LOW_FREE_SPACE_PERCENT)).toBe(false);
    expect(isLowFreeSpace(LOW_FREE_SPACE_PERCENT - 0.1)).toBe(true);
    expect(isLowFreeSpace(LOW_FREE_SPACE_PERCENT + 0.1)).toBe(false);
  });

  it('算不出可用占比时不算告警', () => {
    expect(isLowFreeSpace(null)).toBe(false);
  });
});

describe('getDriveFillLevel', () => {
  it('占用算不出时用 calm（不要拿 0% 画一个假的空盘）', () => {
    expect(getDriveFillLevel(null)).toBe('calm');
  });

  it('已用超过 80%（可用 < 20%）进 low 档', () => {
    expect(getDriveFillLevel(80.0001)).toBe('low');
    expect(getDriveFillLevel(95)).toBe('low');
    expect(getDriveFillLevel(100)).toBe('low');
  });

  it('已用正好 80%（可用正好 20%）不进 low 档', () => {
    expect(getDriveFillLevel(80)).toBe('notice');
  });

  it('已用达到 60% 进 notice 档', () => {
    expect(NOTICE_USED_PERCENT).toBe(60);
    expect(getDriveFillLevel(60)).toBe('notice');
    expect(getDriveFillLevel(79)).toBe('notice');
  });

  it('已用低于 60% 是 calm 档', () => {
    expect(getDriveFillLevel(0)).toBe('calm');
    expect(getDriveFillLevel(59.9)).toBe('calm');
  });

  // 端到端一致性：同一个盘，getDriveFillLevel 的档位必须与
  // isLowFreeSpace 的判断一致。阈值常量只应有一处定义。
  it('低空间档位与 isLowFreeSpace 的判断始终一致', () => {
    for (const used of [0, 20, 59.9, 60, 79.9, 80, 80.1, 95, 100]) {
      const free = getFreeSpacePercent(
        Math.round(1000 * (1 - used / 100)),
        1000,
      );

      if (free === null) {
        continue;
      }

      expect(getDriveFillLevel(used) === 'low').toBe(isLowFreeSpace(free));
    }
  });
});
