// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it } from 'vitest';
import { getFileExtensionCandidates, resolveLoadedIconThemeIcon } from '@/modules/icon-theme/resolver';
import type { LoadedIconThemeDefinition } from '@/types/icon-theme';

function createTheme(): LoadedIconThemeDefinition {
  return {
    iconDefinitions: {
      file: { src: 'file.svg' },
      folder: { src: 'folder.svg' },
      readme: { src: 'readme.svg' },
      readmeDocs: { src: 'readme-docs.svg' },
      typescript: { src: 'ts.svg' },
      declaration: { src: 'dts.svg' },
      testsFolder: { src: 'tests.svg' },
    },
    file: 'file',
    folder: 'folder',
    fileNames: {
      'README.md': 'readme',
      'docs/README.md': 'readmeDocs',
    },
    fileExtensions: {
      'ts': 'typescript',
      'd.ts': 'declaration',
    },
    folderNames: {
      __tests__: 'testsFolder',
    },
  };
}

describe('icon theme resolver', () => {
  it('prefers parent-specific file names over generic file name matches', () => {
    const icon = resolveLoadedIconThemeIcon(createTheme(), {
      name: 'README.md',
      parentName: 'docs',
      extension: 'md',
      isDirectory: false,
    });

    expect(icon).toBe('readme-docs.svg');
  });

  it('matches multi-part file extensions before shorter extensions', () => {
    const icon = resolveLoadedIconThemeIcon(createTheme(), {
      name: 'index.d.ts',
      parentName: 'src',
      extension: 'ts',
      isDirectory: false,
    });

    expect(icon).toBe('dts.svg');
  });

  it('matches folder names case-insensitively', () => {
    const icon = resolveLoadedIconThemeIcon(createTheme(), {
      name: '__TESTS__',
      parentName: 'src',
      extension: null,
      isDirectory: true,
    });

    expect(icon).toBe('tests.svg');
  });

  it('falls back to the generic file icon when no specific association matches', () => {
    const icon = resolveLoadedIconThemeIcon(createTheme(), {
      name: 'archive.zip',
      parentName: 'downloads',
      extension: 'zip',
      isDirectory: false,
    });

    expect(icon).toBe('file.svg');
  });

  it('produces extension candidates from longest to shortest', () => {
    expect(getFileExtensionCandidates('archive.tar.gz')).toEqual(['tar.gz', 'gz']);
  });
});
