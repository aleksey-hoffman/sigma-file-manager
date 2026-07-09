// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { createPathAPI } from '@/modules/extensions/api/create-path-api';

describe('createPathAPI', () => {
  const pathApi = createPathAPI();

  it('treats unix roots like Node basename/extname empty and dirname /', () => {
    expect(pathApi.dirname('/')).toBe('/');
    expect(pathApi.dirname('//')).toBe('/');
    expect(pathApi.dirname('///')).toBe('/');
    expect(pathApi.basename('/')).toBe('');
    expect(pathApi.basename('//')).toBe('');
    expect(pathApi.basename('///')).toBe('');
    expect(pathApi.extname('/')).toBe('');
  });

  it('strips trailing slashes before dirname/basename', () => {
    expect(pathApi.dirname('/home/')).toBe('/');
    expect(pathApi.basename('/home/')).toBe('home');
    expect(pathApi.dirname('C:/Users/')).toBe('C:/');
    expect(pathApi.basename('C:/Users/')).toBe('Users');
  });

  it('returns empty basename for windows drive roots', () => {
    expect(pathApi.basename('C:/')).toBe('');
    expect(pathApi.basename('C:')).toBe('');
    expect(pathApi.extname('C:/')).toBe('');
  });

  it('returns . for windows drive-root dirname (Node posix-like)', () => {
    expect(pathApi.dirname('C:/')).toBe('.');
    expect(pathApi.dirname('C:')).toBe('.');
  });

  it('supports suffix stripping on basename', () => {
    expect(pathApi.basename('/tmp/archive.tar.gz', '.gz')).toBe('archive.tar');
    expect(pathApi.extname('/tmp/archive.tar.gz')).toBe('.gz');
  });
});
