// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import type { DirEntry } from '@/types/dir-entry';
import { getPrioritizedDirSizeEntries } from '../use-file-browser-dir-sizes';

function createFolder(name: string): DirEntry {
  return {
    name,
    ext: null,
    path: `/home/${name}`,
    size: 0,
    item_count: null,
    modified_time: 0,
    accessed_time: 0,
    created_time: 0,
    mime: null,
    is_file: false,
    is_dir: true,
    is_symlink: false,
    is_hidden: false,
  };
}

function createFile(name: string): DirEntry {
  return {
    ...createFolder(name),
    is_file: true,
    is_dir: false,
  };
}

describe('getPrioritizedDirSizeEntries', () => {
  it('requests the folders on screen before the first folders of the listing', () => {
    const hiddenFolders = Array.from({ length: 60 }, (_value, index) => createFolder(`.config-${index}`));
    const documents = createFolder('Documents');
    const downloads = createFolder('Downloads');
    const displayEntries = [...hiddenFolders, documents, downloads];

    const paths = getPrioritizedDirSizeEntries([documents, downloads], displayEntries, 50)
      .map(entry => entry.path);

    expect(paths).toHaveLength(50);
    expect(paths.slice(0, 2)).toEqual(['/home/Documents', '/home/Downloads']);
    expect(paths[2]).toBe('/home/.config-0');
  });

  it('skips files and does not request a visible folder twice', () => {
    const photos = createFolder('photos');
    const notes = createFile('notes.txt');
    const music = createFolder('music');

    const paths = getPrioritizedDirSizeEntries([photos, notes], [photos, notes, music], 50)
      .map(entry => entry.path);

    expect(paths).toEqual(['/home/photos', '/home/music']);
  });
});
