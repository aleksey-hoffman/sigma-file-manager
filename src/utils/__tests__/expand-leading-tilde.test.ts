// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import {
  customDirectoryPathForStorage,
  expandCopiedPath,
  expandLeadingTilde,
  isLeadingTildePath,
} from '@/utils/expand-leading-tilde';

const UNIX_HOME = '/home/user';
const UNIX_HOME_WITH_SLASH = '/home/user/';
const WINDOWS_HOME = 'C:/Users/aleks';
const WINDOWS_HOME_WITH_SLASH = 'C:\\Users\\aleks\\';

describe('isLeadingTildePath', () => {
  it('accepts a bare tilde and a tilde slash prefix', () => {
    expect(isLeadingTildePath('~')).toBe(true);
    expect(isLeadingTildePath('~/Desktop')).toBe(true);
    expect(isLeadingTildePath('~\\Desktop')).toBe(true);
    expect(isLeadingTildePath('  ~/Desktop  ')).toBe(true);
  });

  it('rejects other tilde text', () => {
    expect(isLeadingTildePath('~user')).toBe(false);
    expect(isLeadingTildePath('~$Budget.xlsx')).toBe(false);
    expect(isLeadingTildePath('notes~')).toBe(false);
    expect(isLeadingTildePath('/~/Desktop')).toBe(false);
  });
});

describe('expandLeadingTilde', () => {
  it('returns the trimmed slash-normalized input when home is empty', () => {
    expect(expandLeadingTilde('~/Desktop', '')).toBe('~/Desktop');
    expect(expandLeadingTilde('~', '')).toBe('~');
    expect(expandLeadingTilde('~/', '')).toBe('~/');
    expect(expandLeadingTilde('~\\x', '')).toBe('~/x');
    expect(expandLeadingTilde('~/Desktop', '   ')).toBe('~/Desktop');
  });

  it('expands a bare tilde to the home directory without a trailing slash', () => {
    expect(expandLeadingTilde('~', UNIX_HOME)).toBe('/home/user');
    expect(expandLeadingTilde('~', UNIX_HOME_WITH_SLASH)).toBe('/home/user');
    expect(expandLeadingTilde('~', WINDOWS_HOME)).toBe('C:/Users/aleks');
    expect(expandLeadingTilde('~', WINDOWS_HOME_WITH_SLASH)).toBe('C:/Users/aleks');
    expect(expandLeadingTilde('  ~  ', UNIX_HOME)).toBe('/home/user');
  });

  it('keeps a trailing slash so ~/ browses inside home', () => {
    expect(expandLeadingTilde('~/', UNIX_HOME)).toBe('/home/user/');
    expect(expandLeadingTilde('~/', UNIX_HOME_WITH_SLASH)).toBe('/home/user/');
    expect(expandLeadingTilde('~/', WINDOWS_HOME)).toBe('C:/Users/aleks/');
    expect(expandLeadingTilde('~\\', WINDOWS_HOME_WITH_SLASH)).toBe('C:/Users/aleks/');
  });

  it('joins the remainder without doubling a slash from home', () => {
    expect(expandLeadingTilde('~/Desktop', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(expandLeadingTilde('~/Desktop', UNIX_HOME_WITH_SLASH)).toBe('/home/user/Desktop');
    expect(expandLeadingTilde('~/Desktop/', UNIX_HOME_WITH_SLASH)).toBe('/home/user/Desktop/');
    expect(expandLeadingTilde('~\\Desktop', WINDOWS_HOME)).toBe('C:/Users/aleks/Desktop');
    expect(expandLeadingTilde('~\\Desktop', WINDOWS_HOME_WITH_SLASH)).toBe('C:/Users/aleks/Desktop');
    expect(expandLeadingTilde('~/docs/notes', UNIX_HOME_WITH_SLASH)).toBe('/home/user/docs/notes');
  });

  it('leaves non-leading tilde text unchanged', () => {
    expect(expandLeadingTilde('~user', UNIX_HOME)).toBe('~user');
    expect(expandLeadingTilde('~$Budget.xlsx', WINDOWS_HOME)).toBe('~$Budget.xlsx');
    expect(expandLeadingTilde('notes~', UNIX_HOME)).toBe('notes~');
    expect(expandLeadingTilde('~otheruser/docs', UNIX_HOME)).toBe('~otheruser/docs');
    expect(expandLeadingTilde('$HOME/Desktop', UNIX_HOME)).toBe('$HOME/Desktop');
    expect(expandLeadingTilde('%USERPROFILE%\\Desktop', WINDOWS_HOME)).toBe('%USERPROFILE%/Desktop');
  });
});

describe('expandCopiedPath', () => {
  it('strips one pair of matching quotes before expanding', () => {
    expect(expandCopiedPath('"~/Desktop"', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(expandCopiedPath('\'~/Desktop\'', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(expandCopiedPath('`~/Desktop`', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(expandCopiedPath('  "~/docs"  ', UNIX_HOME_WITH_SLASH)).toBe('/home/user/docs');
    expect(expandCopiedPath('" ~/Desktop "', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(expandCopiedPath('"C:\\Users\\a"', WINDOWS_HOME)).toBe('C:/Users/a');
  });

  it('strips only one pair and does not expand environment variables', () => {
    expect(expandCopiedPath('\'"~/Desktop"\'', UNIX_HOME)).toBe('"~/Desktop"');
    expect(expandCopiedPath('"~/Desktop', UNIX_HOME)).toBe('"~/Desktop');
    expect(expandCopiedPath('"$HOME/Desktop"', UNIX_HOME)).toBe('$HOME/Desktop');
    expect(expandCopiedPath('"%USERPROFILE%\\Desktop"', WINDOWS_HOME)).toBe('%USERPROFILE%/Desktop');
    expect(expandCopiedPath('"~/Desktop"', '')).toBe('~/Desktop');
    expect(expandCopiedPath('""', UNIX_HOME)).toBe('');
  });
});

describe('customDirectoryPathForStorage', () => {
  it('stores ~ and ~/ as the same canonical directory', () => {
    expect(customDirectoryPathForStorage('~', UNIX_HOME)).toBe('/home/user');
    expect(customDirectoryPathForStorage('~/', UNIX_HOME)).toBe('/home/user');
    expect(customDirectoryPathForStorage('~/', UNIX_HOME_WITH_SLASH)).toBe('/home/user');
    expect(customDirectoryPathForStorage('~/Desktop/', UNIX_HOME)).toBe('/home/user/Desktop');
  });

  it('keeps a trailing slash for a drive root or UNC share root', () => {
    expect(customDirectoryPathForStorage('~', 'C:/')).toBe('C:/');
    expect(customDirectoryPathForStorage('~/', 'C:/')).toBe('C:/');
    expect(customDirectoryPathForStorage('~', '//server/share')).toBe('//server/share/');
    expect(customDirectoryPathForStorage('~/', '//server/share/')).toBe('//server/share/');
  });

  it('strips one pair of quotes before expanding', () => {
    expect(customDirectoryPathForStorage('"~/Desktop"', UNIX_HOME)).toBe('/home/user/Desktop');
    expect(customDirectoryPathForStorage('\'~/Desktop\'', WINDOWS_HOME)).toBe('C:/Users/aleks/Desktop');
    expect(customDirectoryPathForStorage('\'"~/Desktop"\'', UNIX_HOME)).toBe('"~/Desktop"');
  });

  it('leaves an unexpanded path unchanged, including a trailing slash', () => {
    expect(customDirectoryPathForStorage('~/Desktop', '')).toBe('~/Desktop');
    expect(customDirectoryPathForStorage('~/', '')).toBe('~/');
    expect(customDirectoryPathForStorage('D:/Work/', UNIX_HOME)).toBe('D:/Work/');
    expect(customDirectoryPathForStorage('~user', UNIX_HOME)).toBe('~user');
  });
});
