// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-19：目录树「定位到当前目录」的滚动计算。
//
// 为什么单独抽成纯函数：DOM 上量到的都是 `getBoundingClientRect()`，
// 而 jsdom 里它一律返回全 0 —— 逻辑写在组件里就只能靠肉眼验。
// 这里把「该不该滚、滚多少」变成纯算术，组件只负责喂数字。
//
// 用户真机原话（2026-10-19）：「点击可以展开，但不会定位到当前打开的目录」。
// 远程树的深度远大于本地（`vol1/@team/study_platform/wp_root/wp-content` 有 5 层），
// 当前目录往往在折叠区之外，**渲染出来 ≠ 用户看得到**。

export interface RevealScrollInput {
  /** 滚动容器当前的 scrollTop。 */
  scrollTop: number;
  /** 滚动容器的可视高度。 */
  viewportHeight: number;
  /** 目标行顶边相对滚动容器**可视区顶边**的偏移（向下为正）。 */
  rowTopInViewport: number;
  /** 目标行高度。 */
  rowHeight: number;
}

/**
 * 把目标行滚进可视区所需的 `scrollTop`。
 *
 * 返回 `null` 表示**不需要滚**。两种情况：
 *   - 目标行已经完整落在可视区内；
 *   - 输入退化（高度为 0，jsdom 里就是这种情况）—— 此时算出来的值没有意义，
 *     返回 null 比返回一个假数字安全。
 *
 * 只需要「最少滚动量」，不做居中：居中会把用户手动展开过的浏览位置冲掉，
 * 而他们点开树通常只是想确认当前目录高亮在哪。
 */
export function computeRevealScrollTop(input: RevealScrollInput): number | null {
  const { scrollTop, viewportHeight, rowTopInViewport, rowHeight } = input;

  if (viewportHeight <= 0 || rowHeight <= 0) {
    return null;
  }

  const rowBottomInViewport = rowTopInViewport + rowHeight;

  const isAboveView = rowTopInViewport < 0;
  const isBelowView = rowBottomInViewport > viewportHeight;

  if (!isAboveView && !isBelowView) {
    return null;
  }

  if (isAboveView) {
    return scrollTop + rowTopInViewport;
  }

  // 整行太高放不下时（viewport 比行还矮），对齐顶边而不是底边，
  // 否则会算出负数把 scrollTop 拉过界。
  if (rowHeight >= viewportHeight) {
    return scrollTop + rowTopInViewport;
  }

  return scrollTop + (rowBottomInViewport - viewportHeight);
}
