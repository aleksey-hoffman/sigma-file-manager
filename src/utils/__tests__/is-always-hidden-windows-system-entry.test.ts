// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { isAlwaysHiddenWindowsSystemEntry } from '@/utils/is-always-hidden-windows-system-entry';

describe('isAlwaysHiddenWindowsSystemEntry', () => {
  it('flags always-hidden entries on any drive root', () => {
    expect(isAlwaysHiddenWindowsSystemEntry('D:/$RECYCLE.BIN')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('C:/Config.Msi')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('D:/System Volume Information')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('D:/DumpStack.log.tmp')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('D:/pagefile.sys')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('C:/OneDriveTemp')).toBe(true);
    expect(isAlwaysHiddenWindowsSystemEntry('C:/Recovery')).toBe(true);
  });

  it('keeps useful hidden directories visible when hidden items are enabled', () => {
    expect(isAlwaysHiddenWindowsSystemEntry('C:/ProgramData')).toBe(false);
    expect(isAlwaysHiddenWindowsSystemEntry('D:/Apps')).toBe(false);
  });

  it('does not flag nested paths or non-drive locations', () => {
    expect(isAlwaysHiddenWindowsSystemEntry('C:/Users/pagefile.sys')).toBe(false);
    expect(isAlwaysHiddenWindowsSystemEntry('/pagefile.sys')).toBe(false);
  });
});
