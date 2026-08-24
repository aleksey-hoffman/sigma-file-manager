// SPDX-License-Identifier: GPL-3.0-or-later
// License: GNU GPLv3 or later. See the license file in the project root for more information.
// Copyright © 2021 - present Aleksey Hoffman. All rights reserved.

import { describe, expect, it, vi } from 'vitest';
import type { DefaultDirectoryKind } from '@/types/user-settings';
import { LOCATIONS_VIRTUAL_PATH } from '@/utils/virtual-path-constants';
import {
  createDefaultDirectoryResolveInput,
  resolveDefaultDirectory,
  resolveDefaultDirectoryPath,
} from '@/utils/resolve-default-directory';

const HOME_DIR = 'C:/Users/aleks';

describe('createDefaultDirectoryResolveInput', () => {
  it('fills defaults when the setting is missing', () => {
    expect(createDefaultDirectoryResolveInput(undefined, HOME_DIR)).toEqual({
      kind: 'userHome',
      customPath: '',
      homeDir: HOME_DIR,
    });
  });

  it('passes through a saved custom directory', () => {
    expect(createDefaultDirectoryResolveInput({
      kind: 'custom',
      customPath: 'D:/Work',
    }, HOME_DIR)).toEqual({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
    });
  });
});

describe('resolveDefaultDirectoryPath', () => {
  it('returns the user home directory by default', () => {
    expect(resolveDefaultDirectoryPath({
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });

  it('returns the user home directory for the userHome kind', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'userHome',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });

  it('returns the Locations virtual path', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'locations',
      homeDir: HOME_DIR,
    })).toBe(LOCATIONS_VIRTUAL_PATH);
  });

  it('returns a normalized custom path', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'custom',
      customPath: 'D:\\Work\\Projects',
      homeDir: HOME_DIR,
    })).toBe('D:/Work/Projects');
  });

  it('falls back to user home when the custom path is empty', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'custom',
      customPath: '   ',
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });

  it('falls back to user home for an unknown kind', () => {
    expect(resolveDefaultDirectoryPath({
      kind: 'desktop' as unknown as DefaultDirectoryKind,
      homeDir: HOME_DIR,
    })).toBe(HOME_DIR);
  });
});

describe('resolveDefaultDirectory', () => {
  it('returns Locations without checking whether the path exists', async () => {
    const pathExists = vi.fn();

    await expect(resolveDefaultDirectory({
      kind: 'locations',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(LOCATIONS_VIRTUAL_PATH);

    expect(pathExists).not.toHaveBeenCalled();
  });

  it('returns the custom path when it exists', async () => {
    const pathExists = vi.fn().mockResolvedValue(true);

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe('D:/Work');

    expect(pathExists).toHaveBeenCalledWith('D:/Work');
  });

  it('falls back to user home when the custom path is missing', async () => {
    const pathExists = vi.fn().mockResolvedValue(false);

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Missing',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);
  });

  it('falls back to user home when the existence check fails', async () => {
    const pathExists = vi.fn().mockRejectedValue(new Error('unavailable'));

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: 'D:/Work',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);
  });

  it('does not check existence for an empty custom path', async () => {
    const pathExists = vi.fn();

    await expect(resolveDefaultDirectory({
      kind: 'custom',
      customPath: '',
      homeDir: HOME_DIR,
      pathExists,
    })).resolves.toBe(HOME_DIR);

    expect(pathExists).not.toHaveBeenCalled();
  });
});
