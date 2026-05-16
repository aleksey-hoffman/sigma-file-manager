// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { disableWebViewFeatures } from '@/utils/disable-web-view-features';

describe('disableWebViewFeatures', () => {
  it('prevents native Ctrl/Cmd+P print shortcut without blocking Ctrl+Shift+P', () => {
    disableWebViewFeatures();

    const printEvent = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    const commandPaletteChord = new KeyboardEvent('keydown', {
      key: 'p',
      code: 'KeyP',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(printEvent);
    document.dispatchEvent(commandPaletteChord);

    expect(printEvent.defaultPrevented).toBe(true);
    expect(commandPaletteChord.defaultPrevented).toBe(false);
  });

  it('prevents native Alt+arrow history navigation', () => {
    disableWebViewFeatures();

    const backEvent = new KeyboardEvent('keydown', {
      key: 'ArrowLeft',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const forwardEvent = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });
    const upEvent = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      altKey: true,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(backEvent);
    document.dispatchEvent(forwardEvent);
    document.dispatchEvent(upEvent);

    expect(backEvent.defaultPrevented).toBe(true);
    expect(forwardEvent.defaultPrevented).toBe(true);
    expect(upEvent.defaultPrevented).toBe(true);
  });

  it('prevents native mouse button history navigation', () => {
    disableWebViewFeatures();

    const mouseDownEvent = new MouseEvent('mousedown', {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const mouseUpEvent = new MouseEvent('mouseup', {
      button: 3,
      bubbles: true,
      cancelable: true,
    });
    const auxClickEvent = new MouseEvent('auxclick', {
      button: 4,
      bubbles: true,
      cancelable: true,
    });

    document.dispatchEvent(mouseDownEvent);
    document.dispatchEvent(mouseUpEvent);
    document.dispatchEvent(auxClickEvent);

    expect(mouseDownEvent.defaultPrevented).toBe(true);
    expect(mouseUpEvent.defaultPrevented).toBe(true);
    expect(auxClickEvent.defaultPrevented).toBe(true);
  });
});
