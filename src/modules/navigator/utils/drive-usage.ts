// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION: 磁盘占用可视化（用户 2026-10-20 00:05 附图要求）。
//
// 为什么单独成文件：磁盘的「已用比例」是个**看起来一行、算错就误导**的东西。
// 它同时喂给两处界面（网格卡的背景填充、列表列的数值），两边必须算出同一个数；
// 而它在单测里又是最容易写错的一处（除零、总量为 0、可用量大于总量、
// 老数据没有可用量）。放进 .vue 里这些分支一个都测不到。

/**
 * 已用空间的百分比，0–100。
 *
 * 三种「算不出」都返回 `null`，**不返回 0**：0 会被界面画成「空盘」，
 * 与「读不到」混为一谈 —— 而这两种情况的正确显示完全不同。
 *
 * - `available` 为 null/undefined/负数 → 读不到（老数据、后端没给）
 * - `total` ≤ 0 → 分母为 0（空的可移动盘、网络盘刚挂上）
 * - `available > total` → 快照不一致（用户刚删了大文件、或 `total` 是另一时刻的）
 */
export function getUsedSpacePercent(
  available: number | null | undefined,
  total: number | null | undefined,
): number | null {
  if (typeof available !== 'number' || !Number.isFinite(available) || available < 0) {
    return null;
  }

  if (typeof total !== 'number' || !Number.isFinite(total) || total <= 0) {
    return null;
  }

  if (available > total) {
    return null;
  }

  return ((total - available) / total) * 100;
}

/** 可用空间占比，0–100。算不出与「全满」必须区分开，所以同样返回 `null`。 */
export function getFreeSpacePercent(
  available: number | null | undefined,
  total: number | null | undefined,
): number | null {
  const used = getUsedSpacePercent(available, total);

  return used === null ? null : 100 - used;
}

/**
 * 可用空间是否进入「告警」区间。
 *
 * 阈值 20%（用户 2026-10-20 明确要求）。**低于**而不是**不高于**：
 * 正好 20% 不算告警 —— 边界该算哪边，测试里钉死，免得以后被人改成 `<=`。
 */
export const LOW_FREE_SPACE_PERCENT = 20;

export function isLowFreeSpace(freePercent: number | null): boolean {
  return freePercent !== null && freePercent < LOW_FREE_SPACE_PERCENT;
}

/**
 * 占用配色的强度档位。
 *
 * 用户要求「配色不要太突兀」，所以分三档而不是一条线性渐变 ——
 * 线性渐变会让「刚放了几个 G 的大盘」和「快满的盘」用几乎一样的颜色，
 * 而它们的严重程度完全不同。
 *
 * - `low`：可用 < 20%（用户 2026-10-20 指定），浅红
 * - `notice`：已用 ≥ 60%，开始有存在感，但还不到告警
 * - `calm`：其余，以及**算不出占用**时（不要拿 0% 去画一个假的空盘）
 */
export type DriveFillLevel = 'calm' | 'notice' | 'low';

/** 已用 ≥ 这个百分比就进 `notice` 档。 */
export const NOTICE_USED_PERCENT = 60;

export function getDriveFillLevel(usedPercent: number | null): DriveFillLevel {
  if (usedPercent === null) {
    return 'calm';
  }

  // 可用 < 20% 等价于已用 > 80%。用同一套阈值常量，别再写一遍 20/80。
  if (isLowFreeSpace(100 - usedPercent)) {
    return 'low';
  }

  if (usedPercent >= NOTICE_USED_PERCENT) {
    return 'notice';
  }

  return 'calm';
}
