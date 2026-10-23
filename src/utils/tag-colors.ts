// SPDX-License-Identifier: GPL-3.0-or-later
// GNU General Public License v3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// 移植自 upstream `3eca4c17`（仪表盘重设计）里的 `src/utils/tag-colors.ts`。
//
// ## 为什么搬这个
//
// 仪表盘页原本把**同一个 8 色板抄了两遍**：
//
// - `dashboard.vue` 里一个 `TAG_COLOR_PALETTE` 常量（颜色选择器用）；
// - `dashboard.vue` 里另一处一个逐字相同的数组字面量（新建标签时随机取色用）。
//
// 两份拷贝迟早会漂 —— 改了一处忘了另一处，界面上的颜色选择器和实际落库的颜色
// 就对不上了。upstream 把它抽成了这个模块，抽得对，单独搬过来。

export const TAG_COLORS = [
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

/** 从色板里随机取一个颜色，用于新建标签时的默认色。 */
export function pickRandomTagColor(): string {
  return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)] ?? TAG_COLORS[0];
}
