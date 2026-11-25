// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { shortenPath } from '@/utils/shorten-path';

describe('shortenPath', () => {
  it('keeps short paths as they are', () => {
    expect(shortenPath('C:/Users/me/notes.txt')).toBe('C:/Users/me/notes.txt');
    expect(shortenPath('/')).toBe('/');
  });

  it('keeps the first directory, the parent directory and the name', () => {
    expect(shortenPath('C:/Users/me/Documents/projects/2026/client/reports/summary.txt'))
      .toBe('C:/…/reports/summary.txt');
    expect(shortenPath('/home/me/Documents/projects/2026/client/reports/summary.txt'))
      .toBe('/home/…/reports/summary.txt');
    expect(shortenPath('//server/share/projects/2026/client/reports/summary.txt'))
      .toBe('//server/share/…/reports/summary.txt');
  });

  it('shortens long names but keeps the extension and the length limit', () => {
    const shortened = shortenPath(`C:/one/two/${'p'.repeat(60)}/${'n'.repeat(60)}.txt`);

    expect(shortened).toMatch(/^C:\/…\/p+…p+\/n+…n+\.txt$/);
    expect(shortened.length).toBe(44);
    expect(shortenPath(`C:/${'n'.repeat(60)}.txt`)).toMatch(/^C:\/n+…n+\.txt$/);
    expect(shortenPath(`C:/${'n'.repeat(60)}.txt`).length).toBe(44);
  });

  it('gives the name the space a short parent does not need', () => {
    expect(shortenPath('C:/one/two/three/four/docs/a-long-but-still-fitting-name.txt'))
      .toBe('C:/…/docs/a-long-but-still-fitting-name.txt');
  });
});
