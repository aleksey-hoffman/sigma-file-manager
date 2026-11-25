// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { afterEach, describe, expect, it } from 'vitest';
import { blurFocusedDirEntry } from '@/modules/navigator/utils/blur-focused-dir-entry';

function focusEntry(containerClass: string): Element {
  document.body.innerHTML = `
    <div class="${containerClass}">
      <div data-entry-path="C:/folder"><div tabindex="-1"></div></div>
    </div>
  `;
  const entry = document.querySelector<HTMLElement>('[tabindex]')!;
  entry.focus();
  return entry;
}

describe('blurFocusedDirEntry', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('blurs a focused file browser entry', () => {
    focusEntry('file-browser');
    blurFocusedDirEntry();
    expect(document.activeElement).toBe(document.body);
  });

  it('keeps focus in the navigation panel', () => {
    const entry = focusEntry('navigation-panel');
    blurFocusedDirEntry();
    expect(document.activeElement).toBe(entry);
  });
});
