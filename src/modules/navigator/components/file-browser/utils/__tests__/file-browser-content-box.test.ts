// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import {
  afterEach, describe, expect, it, vi,
} from 'vitest';
import {
  getElementContentBoxClientRect,
  getElementContentBoxInsets,
  getElementContentBoxWidth,
} from '../file-browser-content-box';

describe('file-browser-content-box', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns content-box width excluding horizontal padding', () => {
    const element = document.createElement('div');

    Object.defineProperty(element, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '20px',
      paddingRight: '20px',
    } as CSSStyleDeclaration);

    expect(getElementContentBoxWidth(element)).toBe(860);
  });

  it('returns a content-box client rect inset by padding and border', () => {
    const element = document.createElement('div');

    Object.defineProperty(element, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(element, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 940, 620));
    vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '20px',
      paddingRight: '20px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderLeftWidth: '0px',
      borderTopWidth: '0px',
    } as CSSStyleDeclaration);

    expect(getElementContentBoxClientRect(element)).toEqual(new DOMRect(120, 200, 860, 600));
  });

  it('reuses supplied content-box insets without reading computed style', () => {
    const element = document.createElement('div');

    Object.defineProperty(element, 'clientWidth', {
      value: 900,
      configurable: true,
    });
    Object.defineProperty(element, 'clientHeight', {
      value: 600,
      configurable: true,
    });
    vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 200, 940, 620));
    const getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
      paddingLeft: '20px',
      paddingRight: '20px',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderLeftWidth: '0px',
      borderTopWidth: '0px',
    } as CSSStyleDeclaration);
    const insets = getElementContentBoxInsets(element);

    getComputedStyleSpy.mockClear();

    expect(getElementContentBoxClientRect(element, insets)).toEqual(new DOMRect(120, 200, 860, 600));
    expect(getComputedStyleSpy).not.toHaveBeenCalled();
  });
});
