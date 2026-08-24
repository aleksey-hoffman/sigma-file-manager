// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getScrollLeftToRevealInFadedContainer } from '@/composables/get-scroll-left-to-reveal-in-faded-container';
import { DEFAULT_HORIZONTAL_SCROLL_FADE_WIDTH } from '@/composables/use-horizontal-scroll-fade';

const FADE_WIDTH = DEFAULT_HORIZONTAL_SCROLL_FADE_WIDTH;
const CONTAINER_CLIENT_WIDTH = 200;
const CONTAINER_SCROLL_WIDTH = 800;
const MAX_SCROLL_LEFT = CONTAINER_SCROLL_WIDTH - CONTAINER_CLIENT_WIDTH;

function reveal(overrides: Partial<Parameters<typeof getScrollLeftToRevealInFadedContainer>[0]>) {
  return getScrollLeftToRevealInFadedContainer({
    containerScrollLeft: 200,
    containerClientWidth: CONTAINER_CLIENT_WIDTH,
    containerScrollWidth: CONTAINER_SCROLL_WIDTH,
    elementOffsetLeft: 250,
    elementWidth: 80,
    fadeWidth: FADE_WIDTH,
    ...overrides,
  });
}

describe('getScrollLeftToRevealInFadedContainer', () => {
  it('keeps the current scroll when the element is already fully outside both fades', () => {
    expect(reveal({
      containerScrollLeft: 200,
      elementOffsetLeft: 250,
      elementWidth: 80,
    })).toBe(200);
  });

  it('scrolls left so a tab under the left fade clears the fade', () => {
    expect(reveal({
      containerScrollLeft: 200,
      elementOffsetLeft: 210,
      elementWidth: 80,
    })).toBe(186);
  });

  it('scrolls right so a tab under the right fade clears the fade', () => {
    expect(reveal({
      containerScrollLeft: 200,
      elementOffsetLeft: 320,
      elementWidth: 80,
    })).toBe(224);
  });

  it('scrolls to the start so the first tab is not covered by a left fade', () => {
    expect(reveal({
      containerScrollLeft: 200,
      elementOffsetLeft: 0,
      elementWidth: 80,
    })).toBe(0);
  });

  it('scrolls to the end so the last tab is not covered by a right fade', () => {
    expect(reveal({
      containerScrollLeft: 200,
      elementOffsetLeft: 720,
      elementWidth: 80,
    })).toBe(MAX_SCROLL_LEFT);
  });

  it('does not scroll past the start or end', () => {
    expect(reveal({
      containerScrollLeft: 0,
      containerScrollWidth: CONTAINER_CLIENT_WIDTH,
      elementOffsetLeft: 0,
      elementWidth: 80,
    })).toBe(0);
  });
});
