// SPDX-License-Identifier: GPL-3.0-or-later
// GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

// FORK-MODIFICATION 2026-10-19：目录树定位滚动的判定。
//
// 用户真机原话：「点击可以展开，但不会定位到当前打开的目录」。
// 滚动计算被抽成纯函数，正是因为 jsdom 里 `getBoundingClientRect()`
// 一律返回全 0 —— 逻辑写在组件里就只能靠肉眼验。

import { describe, expect, it } from 'vitest';
import { computeRevealScrollTop } from '../tree-reveal';

describe('computeRevealScrollTop', () => {
  it('目标行已经在可视区里 —— 不滚', () => {
    expect(computeRevealScrollTop({
      scrollTop: 0,
      viewportHeight: 400,
      rowTopInViewport: 40,
      rowHeight: 24,
    })).toBeNull();
  });

  it('目标行刚好贴着顶边 —— 不滚', () => {
    expect(computeRevealScrollTop({
      scrollTop: 100,
      viewportHeight: 400,
      rowTopInViewport: 0,
      rowHeight: 24,
    })).toBeNull();
  });

  it('目标行刚好贴着底边 —— 不滚', () => {
    expect(computeRevealScrollTop({
      scrollTop: 100,
      viewportHeight: 400,
      rowTopInViewport: 376,
      rowHeight: 24,
    })).toBeNull();
  });

  it('目标行在可视区上方 —— 把它的顶边滚到顶边', () => {
    // 当前 scrollTop=500，目标行在视口上方 30px，顶边对齐要滚到 470。
    expect(computeRevealScrollTop({
      scrollTop: 500,
      viewportHeight: 400,
      rowTopInViewport: -30,
      rowHeight: 24,
    })).toBe(470);
  });

  it('目标行在可视区下方 —— 滚到刚好露出它的底边', () => {
    // scrollTop=0、视口高 400，行顶在 700、行高 24：
    // 底边 724 超出 400，要滚 324 才能看见底边。
    expect(computeRevealScrollTop({
      scrollTop: 0,
      viewportHeight: 400,
      rowTopInViewport: 700,
      rowHeight: 24,
    })).toBe(324);
  });

  it('目标行横跨整个视口时对齐顶边，而不是算出负数', () => {
    const result = computeRevealScrollTop({
      scrollTop: 100,
      viewportHeight: 50,
      rowTopInViewport: 200,
      rowHeight: 500,
    });

    expect(result).toBe(300);
    expect(result).not.toBeLessThan(0);
  });

  it('输入退化（jsdom 里量到的就是全 0）—— 返回 null 而不是假数字', () => {
    expect(computeRevealScrollTop({
      scrollTop: 0,
      viewportHeight: 0,
      rowTopInViewport: 0,
      rowHeight: 0,
    })).toBeNull();

    expect(computeRevealScrollTop({
      scrollTop: 0,
      viewportHeight: 0,
      rowTopInViewport: 500,
      rowHeight: 24,
    })).toBeNull();
  });

  it('只滚「够看见」的距离，不居中 —— 不冲掉用户手动展开的位置', () => {
    const scrollTop = 1000;
    const viewportHeight = 400;
    const rowTopInViewport = 600;
    const rowHeight = 24;

    const result = computeRevealScrollTop({
      scrollTop,
      viewportHeight,
      rowTopInViewport,
      rowHeight,
    })!;

    // 居中会是 scrollTop + (600 + 12 - 200) = 1412；这里只滚到 1224。
    expect(result).toBe(scrollTop + rowTopInViewport + rowHeight - viewportHeight);
    expect(result).toBeLessThan(scrollTop + rowTopInViewport + rowHeight / 2 - viewportHeight / 2);
  });
});
